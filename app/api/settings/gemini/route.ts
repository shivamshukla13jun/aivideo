import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { GeminiKey } from '@/models/GeminiKey';
import { Setting } from '@/models/Setting';
import { DEFAULT_GEMINI_MODELS } from '@/lib/gemini';

export const dynamic = 'force-dynamic';

const MODELS_SETTING = 'geminiModels';

/**
 * GET /api/settings/gemini — list stored API keys (masked) + model chain.
 * POST /api/settings/gemini — actions:
 *   { action:'add-key', key, label? }
 *   { action:'remove-key', id }
 *   { action:'toggle-key', id, disabled }
 *   { action:'add-model', model }
 *   { action:'remove-model', model }
 *   { action:'move-model', model, dir: -1|1 }
 *   { action:'reset-models' }
 */

const mask = (k: string) => `••••${k.slice(-4)}`;

async function listKeys() {
  const keys = await GeminiKey.find({}).sort({ createdAt: 1 }).lean();
  return keys.map((k) => ({
    _id: String(k._id),
    label: k.label,
    hint: mask(k.key),
    disabled: !!k.disabled,
    lastError: k.lastError || '',
    lastErrorAt: k.lastErrorAt || null,
    createdAt: k.createdAt,
  }));
}

async function getModelSetting() {
  const doc = await Setting.findOne({ name: MODELS_SETTING }).lean();
  const list = Array.isArray(doc?.value) ? (doc!.value as any[]).map(String).filter(Boolean) : [];
  return { models: list.length ? list : [...DEFAULT_GEMINI_MODELS], custom: list.length > 0 };
}

async function saveModels(models: string[]) {
  if (models.length === 0) {
    await Setting.deleteOne({ name: MODELS_SETTING });
  } else {
    await Setting.findOneAndUpdate(
      { name: MODELS_SETTING },
      { $set: { value: models } },
      { upsert: true }
    );
  }
}

async function state() {
  const [keys, m] = await Promise.all([listKeys(), getModelSetting()]);
  return { keys, models: m.models, customModels: m.custom, defaultModels: DEFAULT_GEMINI_MODELS };
}

export async function GET() {
  try {
    await connectDB();
    return NextResponse.json({ success: true, data: await state() });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    const { models } = await getModelSetting();

    switch (body.action) {
      case 'add-key': {
        const key = String(body.key || '').trim();
        if (key.length < 10) {
          return NextResponse.json({ success: false, error: 'That does not look like an API key' }, { status: 400 });
        }
        try {
          await GeminiKey.create({ key, label: String(body.label || '').trim().slice(0, 80) });
        } catch (e: any) {
          if (e?.code === 11000) {
            return NextResponse.json({ success: false, error: 'This key is already added' }, { status: 409 });
          }
          throw e;
        }
        break;
      }
      case 'remove-key':
        await GeminiKey.deleteOne({ _id: body.id });
        break;
      case 'toggle-key':
        await GeminiKey.updateOne(
          { _id: body.id },
          { $set: { disabled: !!body.disabled, lastError: '', lastErrorAt: null } }
        );
        break;
      case 'add-model': {
        const model = String(body.model || '').trim();
        if (!model || /\s/.test(model)) {
          return NextResponse.json({ success: false, error: 'Invalid model name' }, { status: 400 });
        }
        if (!models.includes(model)) models.push(model);
        await saveModels(models);
        break;
      }
      case 'remove-model': {
        const next = models.filter((m) => m !== body.model);
        await saveModels(next);
        break;
      }
      case 'move-model': {
        const idx = models.indexOf(String(body.model));
        const dir = body.dir === -1 ? -1 : 1;
        const to = idx + dir;
        if (idx >= 0 && to >= 0 && to < models.length) {
          [models[idx], models[to]] = [models[to], models[idx]];
          await saveModels(models);
        }
        break;
      }
      case 'reset-models':
        await Setting.deleteOne({ name: MODELS_SETTING });
        break;
      default:
        return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: await state() });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
