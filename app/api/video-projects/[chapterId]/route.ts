import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { VideoProject } from '@/models/VideoProject';
import { Chapter } from '@/models/Chapter';

export async function GET(req: NextRequest, { params }: { params: Promise<{ chapterId: string }> }) {
  try {
    const { chapterId } = await params;
    await connectDB();
    let project = await VideoProject.findOne({ chapterId }).populate('scenes');
    if (!project) {
      // Create default project if none exists
      project = await VideoProject.create({
        chapterId,
        scenes: [],
        timelineZoom: 1,
        versionHistory: [],
      });
      await Chapter.findByIdAndUpdate(chapterId, { videoProject: project._id });
    }
    return NextResponse.json({ success: true, data: project });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ chapterId: string }> }) {
  try {
    const { chapterId } = await params;
    const body = await req.json();
    await connectDB();

    let project = await VideoProject.findOne({ chapterId });
    if (!project) {
      project = await VideoProject.create({ chapterId, scenes: body.scenes || [] });
    }

    // Add version history snapshot
    const versionEntry = {
      version: (project.versionHistory?.length || 0) + 1,
      timestamp: new Date(),
      snapshot: body,
    };

    project.scenes = body.scenes || project.scenes;
    project.timelineZoom = body.timelineZoom ?? project.timelineZoom;
    project.audioTrack = body.audioTrack ?? project.audioTrack;
    project.versionHistory.push(versionEntry);

    await project.save();
    return NextResponse.json({ success: true, data: project });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
