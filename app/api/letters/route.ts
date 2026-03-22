export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { validateAuth } from '@/lib/auth';

const LETTERS_KEY = 'letters';

export interface LetterItem {
  id: string;
  text: string;
  status: 'pending' | 'accepted' | 'modified' | 'ignored';
  assignedAgent?: string;
  userNote?: string;
}

export interface Letter {
  id: string;
  sender: string; // agent name: shinobu, homura, madoka, nadi, luno, elaina, kanae
  title: string;
  content: string;
  items?: LetterItem[];
  timestamp: string; // ISO
  read: boolean;
}

function getRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const IS_DEMO = process.env.NEXT_PUBLIC_DEMO === 'true';

// GET /api/letters — list all letters
// Auto-cleans ignored letters from previous days
export async function GET(req: NextRequest) {
  if (IS_DEMO) {
    const { getDemoLetters } = await import('@/lib/demoData');
    return NextResponse.json({ letters: getDemoLetters() });
  }
  const redis = getRedis();
  if (!redis) return NextResponse.json({ letters: [] });
  try {
    const letters = await redis.get<Letter[]>(LETTERS_KEY) || [];

    // Auto-cleanup: remove ignored letters from before today
    const todayStr = new Date().toISOString().split('T')[0];
    const before = letters.length;
    const cleaned = letters.filter(l => {
      if ((l as Letter & { replyStatus?: string }).replyStatus !== 'ignored') return true;
      // Keep today's ignored letters, remove older ones
      const letterDate = l.timestamp.split('T')[0];
      return letterDate >= todayStr;
    });
    if (cleaned.length < before) {
      await redis.set(LETTERS_KEY, cleaned);
    }

    const url = new URL(req.url);
    const unreadOnly = url.searchParams.get('unread');
    const dateFilter = url.searchParams.get('date');

    let filtered = cleaned;
    if (unreadOnly === 'true') {
      filtered = filtered.filter(l => !l.read);
    }
    if (dateFilter) {
      filtered = filtered.filter(l => l.timestamp.startsWith(dateFilter));
    }

    // newest first
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({ letters: filtered });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST /api/letters — create letter
export async function POST(req: NextRequest) {

  const redis = getRedis();
  if (!redis) return NextResponse.json({ ok: true });
  try {
    const body = await req.json() as Partial<Letter>;
    if (!body.sender || !body.title || !body.content) {
      return NextResponse.json({ error: 'Missing required fields: sender, title, content' }, { status: 400 });
    }

    const letter: Letter = {
      id: body.id || crypto.randomUUID(),
      sender: body.sender,
      title: body.title,
      content: body.content,
      items: body.items || [],
      timestamp: body.timestamp || new Date().toISOString(),
      read: false,
    };

    const letters = await redis.get<Letter[]>(LETTERS_KEY) || [];
    letters.push(letter);
    await redis.set(LETTERS_KEY, letters);

    return NextResponse.json({ ok: true, letter });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// PATCH /api/letters — update letter (mark read, update item)
export async function PATCH(req: NextRequest) {
  if (IS_DEMO) return NextResponse.json({ ok: true });
  const redis = getRedis();
  if (!redis) return NextResponse.json({ ok: true });
  try {
    const { id, action, itemId, status, assignedAgent, userNote, replyStatus } = await req.json() as {
      id: string;
      action: 'read' | 'update_item' | 'reply';
      itemId?: string;
      status?: LetterItem['status'];
      assignedAgent?: string;
      userNote?: string;
      replyStatus?: 'accepted' | 'ignored';
    };

    const letters = await redis.get<Letter[]>(LETTERS_KEY) || [];
    const idx = letters.findIndex(l => l.id === id);
    if (idx === -1) return NextResponse.json({ error: 'Letter not found' }, { status: 404 });

    if (action === 'read') {
      letters[idx].read = true;
    } else if (action === 'reply' && replyStatus) {
      (letters[idx] as unknown as Record<string, unknown>).replyStatus = replyStatus;
      letters[idx].read = true;
    } else if (action === 'update_item' && itemId) {
      const items = letters[idx].items || [];
      const itemIdx = items.findIndex(i => i.id === itemId);
      if (itemIdx !== -1) {
        if (status) items[itemIdx].status = status;
        if (assignedAgent !== undefined) items[itemIdx].assignedAgent = assignedAgent;
        if (userNote !== undefined) items[itemIdx].userNote = userNote;
        letters[idx].items = items;
      }
    }

    await redis.set(LETTERS_KEY, letters);
    return NextResponse.json({ ok: true, letter: letters[idx] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
