import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Setting } from '@/models/Setting';
import {
  DEFAULT_OLLAMA_MODEL_LIST,
  OLLAMA_MODELS_SETTING,
  getPullProgress,
  listPulledModels,
  ollamaReachable,
} from '@/lib/ollama';

export const dynamic = 'force-dynamic';

/**
 * GET /api/settings/ollama — daemon reachability, pulled models, the model
 * chain (first = default), and live pull progress for in-flight downloads.
 * POST /api/settings/ollama — actions:
 *   { action:'add-model', model }
 *   { action:'remove-model', model }
 *   { action:'move-model', model, dir: -1|1 }
 *   { action:'reset-models' }
 */

async function getModelSetting() {
  const doc = await Setting.findOne({ name: OLLAMA_MODELS_SETTING }).lean();
  const list = Array.isArray(doc?.value) ? (doc!.value as any[]).map(String).filter(Boolean) : [];
  return { models: list.length ? list : [...DEFAULT_OLLAMA_MODEL_LIST], custom: list.length > 0 };
}

async function saveModels(models: string[]) {
  if (models.length === 0) {
    await Setting.deleteOne({ name: OLLAMA_MODELS_SETTING });
  } else {
    await Setting.findOneAndUpdate(
      { name: OLLAMA_MODELS_SETTING },
      { $set: { value: models } },
      { upsert: true }
    );
  }
}

async function state() {
  const [reachable, pulled, m] = await Promise.all([
    ollamaReachable(),
    listPulledModels(),
    getModelSetting(),
  ]);
  return {
    reachable,
    pulled,
    models: m.models,
    defaultModel: m.models[0] || null,
    customModels: m.custom,
    defaultModels: DEFAULT_OLLAMA_MODEL_LIST,
    pulling: getPullProgress(),
  };
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
      case 'add-model': {
        const model = String(body.model || '').trim();
        if (!model || /\s/.test(model)) {
          return NextResponse.json({ success: false, error: 'Invalid model name' }, { status: 400 });
        }
        if (!models.includes(model)) models.push(model);
        await saveModels(models);
        break;
      }
      case 'remove-model':
        await saveModels(models.filter((m) => m !== body.model));
        break;
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
        await Setting.deleteOne({ name: OLLAMA_MODELS_SETTING });
        break;
      default:
        return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: await state() });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
