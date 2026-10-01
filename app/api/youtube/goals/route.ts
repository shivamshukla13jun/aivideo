import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { MonetizationGoal } from '@/models/MonetizationGoal';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const accountId = req.nextUrl.searchParams.get('accountId');
    const filter: any = {};
    if (accountId) filter.accountId = accountId;
    const goals = await MonetizationGoal.find(filter).lean();
    return NextResponse.json({ success: true, data: goals });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { accountId } = body;
    if (!accountId) return NextResponse.json({ success: false, error: 'accountId is required' }, { status: 400 });
    await connectDB();
    const goal = await MonetizationGoal.findOneAndUpdate(
      { accountId },
      {
        accountId,
        targetSubscribers: Number(body.targetSubscribers) || 1000,
        targetWatchHours: Number(body.targetWatchHours) || 4000,
        targetShortsViews: Number(body.targetShortsViews) || 10_000_000,
        targetUploadsPerMonth: Number(body.targetUploadsPerMonth) || 4,
        deadline: body.deadline ? new Date(body.deadline) : undefined,
        note: body.note || '',
      },
      { upsert: true, new: true }
    );
    return NextResponse.json({ success: true, data: goal });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
