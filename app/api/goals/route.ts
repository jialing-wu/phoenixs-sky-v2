export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { validateAuth } from '@/lib/auth';

const GOALS_KEY = 'goals-dashboard';

function getRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const IS_DEMO = process.env.NEXT_PUBLIC_DEMO === 'true';

// GET /api/goals — full dashboard or weekly/monthly only
export async function GET(req: NextRequest) {
  if (IS_DEMO) {
    const { getDemoGoals } = await import('@/lib/demoData');
    return NextResponse.json(getDemoGoals());
  }
  const redis = getRedis();
  if (!redis) return NextResponse.json({ boards: [], weekly_current: null, monthly_current: null });

  try {
    const data = await redis.get(GOALS_KEY) as Record<string, unknown> | null;
    if (!data) return NextResponse.json({ boards: [], weekly_current: null, monthly_current: null });

    const { searchParams } = new URL(req.url);
    const view = searchParams.get('view'); // 'full' | 'weekly' | 'monthly' | null

    if (view === 'weekly') {
      return NextResponse.json({ weekly: (data as Record<string, unknown>).weekly_current || null });
    }
    if (view === 'monthly') {
      return NextResponse.json({ monthly: (data as Record<string, unknown>).monthly_current || null });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ boards: [], weekly_current: null, monthly_current: null }, { status: 500 });
  }
}

// PATCH /api/goals — update goals data
export async function PATCH(req: NextRequest) {

  const redis = getRedis();
  if (!redis) return NextResponse.json({ error: 'No Redis' }, { status: 500 });

  try {
    const body = await req.json();
    const { action } = body;

    const existing = await redis.get(GOALS_KEY) as Record<string, unknown> | null || {};

    switch (action) {
      // Replace entire dashboard
      case 'replace': {
        await redis.set(GOALS_KEY, body.data);
        return NextResponse.json({ ok: true });
      }

      // Update a specific goal's field
      case 'update_goal': {
        const { boardId, goalId, field, value } = body;
        const data = existing as Record<string, unknown>;
        const boards = (data.boards || []) as Array<Record<string, unknown>>;
        const board = boards.find((b: Record<string, unknown>) => b.id === boardId);
        if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 });
        const goals = (board.goals_2026 || []) as Array<Record<string, unknown>>;
        const goal = goals.find((g: Record<string, unknown>) => g.id === goalId);
        if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
        goal[field] = value;
        await redis.set(GOALS_KEY, data);
        return NextResponse.json({ ok: true, goal });
      }

      // Add a weekly log entry to a goal
      case 'add_log': {
        const { boardId: bid, goalId: gid, log } = body;
        const data = existing as Record<string, unknown>;
        const boards = (data.boards || []) as Array<Record<string, unknown>>;
        const board = boards.find((b: Record<string, unknown>) => b.id === bid);
        if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 });
        const goals = (board.goals_2026 || []) as Array<Record<string, unknown>>;
        const goal = goals.find((g: Record<string, unknown>) => g.id === gid);
        if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
        if (!goal.weekly_logs) goal.weekly_logs = [];
        (goal.weekly_logs as Array<unknown>).push({ ...log, date: new Date().toISOString() });
        await redis.set(GOALS_KEY, data);
        return NextResponse.json({ ok: true });
      }

      // Update weekly_current
      case 'update_weekly': {
        const data = existing as Record<string, unknown>;
        data.weekly_current = body.weekly;
        await redis.set(GOALS_KEY, data);
        return NextResponse.json({ ok: true });
      }

      // Update monthly_current
      case 'update_monthly': {
        const data = existing as Record<string, unknown>;
        data.monthly_current = body.monthly;
        await redis.set(GOALS_KEY, data);
        return NextResponse.json({ ok: true });
      }

      // Increment a frequency/count goal
      case 'increment': {
        const { boardId: incBid, goalId: incGid, amount = 1 } = body;
        const data = existing as Record<string, unknown>;
        const boards = (data.boards || []) as Array<Record<string, unknown>>;
        const board = boards.find((b: Record<string, unknown>) => b.id === incBid);
        if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 });
        const goals = (board.goals_2026 || []) as Array<Record<string, unknown>>;
        const goal = goals.find((g: Record<string, unknown>) => g.id === incGid);
        if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
        goal.completed = ((goal.completed as number) || 0) + amount;
        await redis.set(GOALS_KEY, data);
        return NextResponse.json({ ok: true, completed: goal.completed });
      }

      // Update board-level fields (ten_year, five_year, etc.)
      case 'update_board': {
        const { boardId: ubBid, field: ubField, value: ubValue } = body;
        const data = existing as Record<string, unknown>;
        const boards = (data.boards || []) as Array<Record<string, unknown>>;
        const board = boards.find((b: Record<string, unknown>) => b.id === ubBid);
        if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 });
        board[ubField] = ubValue;
        await redis.set(GOALS_KEY, data);
        return NextResponse.json({ ok: true });
      }

      // Update weekly_all[weekKey] goals array
      case 'update_week_goals': {
        const { boardId: wgBid, weekKey, goals: wgGoals } = body;
        const data = existing as Record<string, unknown>;
        const boards = (data.boards || []) as Array<Record<string, unknown>>;
        const board = boards.find((b: Record<string, unknown>) => b.id === wgBid);
        if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 });
        if (!board.weekly_all) board.weekly_all = {};
        (board.weekly_all as Record<string, unknown>)[weekKey] = { goals: wgGoals };
        await redis.set(GOALS_KEY, data);
        return NextResponse.json({ ok: true });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
