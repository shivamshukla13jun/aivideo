import { NextRequest, NextResponse } from 'next/server';
import { getChapterPages, resolveSuwayomiInternalUrl } from '@/lib/suwayomi';
import { connectDB } from '@/lib/mongodb';
import { Page } from '@/models/Page';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const numericId = parseInt(id, 10);

    if (isNaN(numericId)) {
      return NextResponse.json({ success: false, error: 'Invalid chapter id' }, { status: 400 });
    }

    // 1. Fetch live chapter pages from Suwayomi
    const { pages } = await getChapterPages(numericId);

    // 2. Fetch any locally edited pages or panels from MongoDB if exist
    let localPagesMap: Record<number, any> = {};
    try {
      await connectDB();
      const localPages = await Page.find({ chapterId: id, status: { $ne: 'deleted' } });
      localPages.forEach(lp => {
        localPagesMap[lp.order] = lp;
      });
    } catch {
      // Local db connection optional for reading Suwayomi pages
    }

    // 3. Construct unified page list
    const resultPages = pages.map((pageUrl, idx) => {
      const order = idx + 1;
      const local = localPagesMap[order];
      return {
        _id: local?._id ? String(local._id) : `${id}_page_${idx}`,
        chapterId: id,
        order,
        originalUrl: pageUrl,
        editedUrl: local?.editedUrl || pageUrl,
        panels: local?.panels || [],
        extractedText: local?.extractedText || '',
        status: local?.status || 'active',
      };
    });

    return NextResponse.json({
      success: true,
      data: resultPages,
      total: resultPages.length,
      source: 'suwayomi',
    });
  } catch (error: any) {
    console.error(`Error fetching pages for chapter ${params}:`, error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { pageId, cropBox, splitBoxes, action } = body;

    await connectDB();

    // Determine page order
    let pageOrder = 1;
    if (typeof pageId === 'string' && pageId.includes('_page_')) {
      const parts = pageId.split('_page_');
      pageOrder = parseInt(parts[1], 10) + 1;
    }

    // Find existing page or query Suwayomi to get originalUrl
    let pageDoc = await Page.findOne({ chapterId: id, order: pageOrder });
    let originalUrl = pageDoc?.originalUrl || '';

    if (!originalUrl) {
      const numericId = parseInt(id, 10);
      if (!isNaN(numericId)) {
        const { pages } = await getChapterPages(numericId);
        if (pages[pageOrder - 1]) {
          originalUrl = pages[pageOrder - 1];
        }
      }
    }

    let editedUrl = pageDoc?.editedUrl || '';
    let panels: any[] = [];

    if (action === 'crop' && cropBox) {
      panels = [
        {
          id: `panel_${Date.now()}`,
          x: cropBox.x,
          y: cropBox.y,
          width: cropBox.width,
          height: cropBox.height,
        },
      ];

      // Perform actual image crop using sharp if originalUrl is reachable
      if (originalUrl) {
        try {
          const sharp = (await import('sharp')).default;
          const fs = (await import('fs')).default;
          const path = (await import('path')).default;

          const imgRes = await fetch(resolveSuwayomiInternalUrl(originalUrl));
          if (imgRes.ok) {
            const arrBuf = await imgRes.arrayBuffer();
            const imgBuffer = Buffer.from(arrBuf);
            const metadata = await sharp(imgBuffer).metadata();

            if (metadata.width && metadata.height) {
              const left = Math.max(0, Math.min(metadata.width - 1, Math.round((cropBox.x / 100) * metadata.width)));
              const top = Math.max(0, Math.min(metadata.height - 1, Math.round((cropBox.y / 100) * metadata.height)));
              const width = Math.max(1, Math.min(metadata.width - left, Math.round((cropBox.width / 100) * metadata.width)));
              const height = Math.max(1, Math.min(metadata.height - top, Math.round((cropBox.height / 100) * metadata.height)));

              const croppedBuffer = await sharp(imgBuffer)
                .extract({ left, top, width, height })
                .png()
                .toBuffer();

              const cropsDir = path.join(process.cwd(), 'public', 'crops');
              if (!fs.existsSync(cropsDir)) {
                fs.mkdirSync(cropsDir, { recursive: true });
              }

              const filename = `crop_${id}_${pageOrder}_${Date.now()}.png`;
              fs.writeFileSync(path.join(cropsDir, filename), croppedBuffer);
              editedUrl = `/public/crops/${filename}`;
              panels[0].imageUrl = editedUrl;
            }
          }
        } catch (cropErr) {
          console.warn('Sharp cropping skipped/failed, keeping panel metadata:', cropErr);
        }
      }
    } else if (action === 'split' && splitBoxes) {
      panels = splitBoxes.map((box: any, idx: number) => ({
        id: box.id || `panel_${idx + 1}`,
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
      }));
    }

    if (!pageDoc) {
      pageDoc = await Page.create({
        chapterId: id,
        order: pageOrder,
        originalUrl: originalUrl || '',
        editedUrl: editedUrl || originalUrl,
        panels,
        status: action === 'split' ? 'split' : 'active',
      });
    } else {
      pageDoc.panels = panels;
      if (editedUrl) pageDoc.editedUrl = editedUrl;
      pageDoc.status = action === 'split' ? 'split' : 'active';
      await pageDoc.save();
    }

    return NextResponse.json({ success: true, data: pageDoc });
  } catch (error: any) {
    console.error('Error saving cropped page:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
