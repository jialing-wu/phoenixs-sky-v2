import type { CalendarEvent, TodoItem, NotionEntry } from './mockData';

// ── Helpers ────────────────────────────────────────────────
function relDate(dayOffset: number, hour?: number, min = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  if (hour !== undefined) {
    d.setHours(hour, min, 0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateOnly(dayOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

let _id = 0;
function id(prefix = 'demo') { return `${prefix}-${++_id}`; }

// ── Events — Phoenix's bird life ──────────────────────────
export function getDemoEvents(): CalendarEvent[] {
  _id = 0;
  const dow = new Date().getDay(); // 0=Sun

  return [
    // ── All-day events ──
    { id: id(), title: 'Spring Migration Planning', start: dateOnly(0), end: dateOnly(2), calendar: 'work', allDay: true },
    { id: id(), title: 'Feather Molt Season', start: dateOnly(3), end: dateOnly(5), calendar: 'personal', allDay: true },

    // ── Work: Delivery & Patrol (Piper) ──
    { id: id(), title: 'Deliver Letters to the Valley', start: relDate(1 - dow, 8), end: relDate(1 - dow, 11), calendar: 'work', location: 'Cedar Valley Post Route' },
    { id: id(), title: 'Sky Patrol — East Sector', start: relDate(3 - dow, 14), end: relDate(3 - dow, 16), calendar: 'work', location: 'East Forest Boundary' },
    { id: id(), title: 'Weekly Sky Patrol Debrief', start: relDate(5 - dow, 11), end: relDate(5 - dow, 12, 30), calendar: 'work' },

    // ── School: Training & Learning ──
    { id: id(), title: 'Aerial Navigation Training', start: relDate(2 - dow, 7), end: relDate(2 - dow, 8, 30), calendar: 'school', location: 'Windridge Cliffs' },
    { id: id(), title: 'Foraging Expedition — Study Group', start: relDate(4 - dow, 10, 30), end: relDate(4 - dow, 12, 30), calendar: 'school', location: 'Bramble Thicket' },

    // ── Personal: Rest & Social (Robin) ──
    { id: id(), title: 'Buffet with Sparrow & Finch', start: relDate(2 - dow, 12), end: relDate(2 - dow, 14), calendar: 'personal', location: 'Union Station Food Hall' },
    { id: id(), title: 'Sunset Singing Practice', start: relDate(4 - dow, 18), end: relDate(4 - dow, 19), calendar: 'personal' },
    { id: id(), title: 'Community Flock Meeting', start: relDate(6 - dow, 10), end: relDate(6 - dow, 12), calendar: 'personal', location: 'Great Oak Assembly' },

    // ── Sky Life (Phoenix among humans) ──
    { id: id(), title: 'Café People-Watching', start: relDate(3 - dow, 9), end: relDate(3 - dow, 10, 30), calendar: 'sky', location: 'Third Wave Coffee' },
    { id: id(), title: 'Night Market Stroll', start: relDate(5 - dow, 19), end: relDate(5 - dow, 21), calendar: 'sky', location: 'Riverside Night Market' },

    // ── Agent Notes ──
    { id: id(), title: 'piper — Strong east gusts expected after noon. Adjust delivery route to stay below the ridge line.', start: dateOnly(0), end: dateOnly(0), calendar: 'notes', allDay: true },
    { id: id(), title: 'robin — You flew 3 hours straight yesterday. Take a perch break between routes today.', start: dateOnly(0), end: dateOnly(0), calendar: 'notes', allDay: true },
    { id: id(), title: 'piper — Owl Post reported a backlog. Consider doubling tomorrow\'s first run.', start: dateOnly(1), end: dateOnly(1), calendar: 'notes', allDay: true },
    { id: id(), title: 'robin — The birdbath near the park was refilled. Good spot for afternoon rest.', start: dateOnly(1), end: dateOnly(1), calendar: 'notes', allDay: true },
  ];
}

// ── Todos — Phoenix's task list ───────────────────────────
export function getDemoTodos(): TodoItem[] {
  return [
    { id: 'todo-1', title: 'Sharpen beak on the granite rock', due: dateOnly(0), priority: 2, done: false, project: 'Grooming', labels: ['daily'] },
    { id: 'todo-2', title: 'Collect twigs for nest repair', due: dateOnly(1), priority: 3, done: false, project: 'Nest', labels: ['side'] },
    { id: 'todo-3', title: 'Deliver urgent letter to Owl Post', due: dateOnly(0), priority: 1, done: false, project: 'Delivery', labels: ['main'] },
    { id: 'todo-4', title: 'Find the lost seed stash by the creek', due: dateOnly(2), priority: 3, done: false, project: 'Foraging', labels: ['side'] },
    { id: 'todo-5', title: 'Practice the new dawn song melody', due: dateOnly(5), priority: 4, done: false, project: 'Personal', labels: ['daily'] },
    { id: 'todo-6', title: 'Scout new thermal currents — west ridge', due: dateOnly(0), priority: 2, done: false, project: 'Delivery', labels: ['side'] },
    { id: 'todo-7', title: 'Preen tail feathers', due: dateOnly(0), priority: 4, done: true, project: 'Grooming', labels: ['daily'] },
    { id: 'todo-8', title: 'Check birdbath water level', due: dateOnly(1), priority: 3, done: false, project: 'Nest', labels: ['daily'] },
    { id: 'todo-9', title: 'Map southern migration waypoint #3', due: dateOnly(3), priority: 1, done: false, project: 'Delivery', labels: ['main'] },
    { id: 'todo-10', title: 'Attend sparrow community sing-along', due: dateOnly(4), priority: 4, done: false, project: 'Personal', labels: ['side'] },
  ];
}

// ── Notion Entries — Phoenix's projects, goals & deadlines ─
export function getDemoNotionEntries(): NotionEntry[] {
  return [
    // Projects
    { id: 'notion-1', title: 'Southern Migration Route Map', status: 'Drafting', deadline: dateOnly(14), database: 'Projects' },
    { id: 'notion-2', title: 'Flock Communication Signals Guide', status: 'Researching', database: 'Projects' },
    { id: 'notion-3', title: 'Human Behavior Field Notes', status: 'Writing', deadline: dateOnly(21), database: 'Projects' },
    // Deadlines
    { id: 'notion-4', title: 'Nest Winterization', status: 'Due in 3d', deadline: dateOnly(3), database: 'Deadlines' },
    { id: 'notion-5', title: 'Annual Feather Molt Prep', status: 'Due in 7d', deadline: dateOnly(7), database: 'Deadlines' },
    { id: 'notion-6', title: 'Flock Census Report', status: 'Due in 10d', deadline: dateOnly(10), database: 'Deadlines' },
    // Weekly Goals
    { id: 'notion-7', title: 'Complete 5 delivery routes without detour', status: '3 / 5', database: 'Weekly Goals' },
    { id: 'notion-8', title: 'Practice dawn song 3 mornings this week', status: '1 / 3', database: 'Weekly Goals' },
    { id: 'notion-9', title: 'Visit 2 new human locations', status: '1 / 2', database: 'Weekly Goals' },
    // Monthly Goals
    { id: 'notion-10', title: 'Map 2 new migration waypoints', status: '0 / 2', database: 'Monthly Goals' },
    { id: 'notion-11', title: 'Visit 4 human locations for recon', status: '1 / 4', database: 'Monthly Goals' },
    { id: 'notion-12', title: 'Learn 3 new regional bird calls', status: '2 / 3', database: 'Monthly Goals' },
  ];
}

// ── Letters — agent messages ──────────────────────────────
export function getDemoLetters() {
  const now = new Date();
  const ago = (hours: number) => new Date(now.getTime() - hours * 3600000).toISOString();

  return [
    {
      id: 'letter-1',
      sender: 'piper',
      title: 'Morning Route Report',
      content: 'The east valley delivery went smoothly today. Strong tailwinds cut travel time by 20%. I noticed a new thermal near the ridge — could shave another 5 minutes off tomorrow.\n\nOne package for the owl post is overdue. Suggest we prioritize it first thing.',
      items: [
        { id: 'item-1', text: 'Prioritize owl post delivery tomorrow AM', status: 'pending' },
        { id: 'item-2', text: 'Map the new thermal near Windridge', status: 'pending' },
      ],
      timestamp: ago(1),
      read: false,
    },
    {
      id: 'letter-2',
      sender: 'robin',
      title: 'Nest & Rest Check-in',
      content: 'You\'ve been flying 6 hours straight — that\'s above the recommended daily limit. The cafe on Third Street has fresh breadcrumbs today, and the sunset viewing spot by the river is clear.\n\nAlso, the sparrows mentioned a community gathering this weekend. Might be a good chance to socialize!',
      items: [
        { id: 'item-3', text: 'Take a 30-minute perch break this afternoon', status: 'accepted' },
        { id: 'item-4', text: 'RSVP to the sparrow community gathering', status: 'pending' },
      ],
      timestamp: ago(3),
      read: false,
    },
    {
      id: 'letter-3',
      sender: 'piper',
      title: 'Weekly Delivery Summary',
      content: '**This week\'s stats:**\n- Routes completed: 12\n- On-time rate: 92%\n- New thermals discovered: 2\n\nThe southern route is getting predictable. I recommend we test the canyon shortcut next week — it could cut 15 minutes off the daily run.\n\nAlso, the hawk was spotted near Sector 7 again. Stay alert on afternoon runs.',
      items: [
        { id: 'item-5', text: 'Test canyon shortcut route on Monday', status: 'pending' },
        { id: 'item-6', text: 'Update hawk avoidance protocol for Sector 7', status: 'pending' },
        { id: 'item-7', text: 'File route performance report', status: 'accepted' },
      ],
      timestamp: ago(8),
      read: true,
    },
    {
      id: 'letter-4',
      sender: 'robin',
      title: 'Wellness Reminder',
      content: 'Your sleep pattern has been irregular this week — 3 late nights in a row. The dawn chorus works best when you\'re well-rested.\n\nI reserved a quiet perch at the old willow tree for tonight. Sometimes the best thing you can do is just sit and listen to the evening sounds.',
      items: [
        { id: 'item-8', text: 'Lights out by sunset tonight', status: 'pending' },
      ],
      timestamp: ago(24),
      read: true,
    },
    {
      id: 'letter-5',
      sender: 'piper',
      title: 'Old Route Update',
      content: 'The northern pass route has been closed due to hawk activity. We\'ll need to reroute through the canyon for the next few days.',
      timestamp: ago(48),
      read: true,
      replyStatus: 'ignored' as const,
    },
  ];
}

// ── Goals — captain's log data ───────────────────────────
export function getDemoGoals() {
  const now = new Date();
  // CaptainsLog week key
  const thu1 = new Date(now);
  thu1.setDate(thu1.getDate() + 3 - ((thu1.getDay() + 6) % 7));
  const ys1 = new Date(thu1.getFullYear(), 0, 1);
  const wn1 = Math.ceil(((thu1.getTime() - ys1.getTime()) / 86400000 + 1) / 7);
  const captainKey = `${thu1.getFullYear()}-W${String(wn1).padStart(2, '0')}`;
  const prevCaptainKey = `${thu1.getFullYear()}-W${String(wn1 - 1).padStart(2, '0')}`;

  // WeekView week key (different algorithm)
  const ws = new Date(now);
  ws.setDate(now.getDate() - now.getDay());
  ws.setHours(0, 0, 0, 0);
  const d2 = new Date(ws);
  d2.setDate(d2.getDate() + 3);
  const jan1 = new Date(d2.getFullYear(), 0, 1);
  const wn2 = Math.ceil(((d2.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  const weekViewKey = `${d2.getFullYear()}-W${String(wn2).padStart(2, '0')}`;

  // Use both keys to ensure goals show in both CaptainsLog and WeekView editorial
  const weekKey = captainKey;
  const prevWeekKey = prevCaptainKey;
  const yr = now.getFullYear();
  const curMonth = `${yr}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  return {
    boards: [
      {
        id: 'flight',
        name: 'Flight & Delivery',
        agent: 'piper',
        emoji: '🐦',
        color: '#2D5F7C',
        ten_year: 'Become the most reliable courier in the valley — every letter delivered, every route mapped.',
        five_year: 'Map all migration routes. Train 3 apprentice couriers. Establish overnight relay stations.',
        goals_2026: [
          // Yearly goals (no target_month)
          { id: 'g1', text: 'Complete 100 delivery routes', type: 'count', completed: 34 },
          { id: 'g11', text: 'Establish 3 relay stations', type: 'count', completed: 1 },
          // Monthly goals (with target_month in YYYY-MM format)
          { id: 'g2', text: 'Map all valley thermals', type: 'milestone', target_month: `${yr}-04` },
          { id: 'g3', text: 'Achieve zero-delay month', type: 'milestone', target_month: curMonth },
          { id: 'g7', text: 'Scout 6 new shortcuts', type: 'count', target_month: `${yr}-08`, completed: 2 },
          { id: 'g8', text: 'Finish spring route survey', type: 'milestone', target_month: curMonth },
        ],
        milestones: [
          { id: 'ms1', text: '50th delivery route completed', date: dateOnly(-10), level: 2, done: true },
          { id: 'ms2', text: 'First canyon shortcut mapped', date: dateOnly(7), level: 1 },
          { id: 'ms3', text: 'Valley thermal map v1.0 complete', date: dateOnly(21), level: 3 },
        ],
        weekly_all: {
          [prevWeekKey]: { goals: [{ text: '4 deliveries', completed: 4 }, { text: 'Map east thermal', completed: 1 }] },
          [weekKey]: { goals: ['5 deliveries this week', 'Test new east route', 'Scout canyon shortcut'] },
          ...(weekViewKey !== weekKey ? { [weekViewKey]: { goals: ['5 deliveries this week', 'Test new east route', 'Scout canyon shortcut'] } } : {}),
        },
      },
      {
        id: 'nest',
        name: 'Nest & Wellness',
        agent: 'robin',
        emoji: '🪺',
        color: '#2D6E4E',
        ten_year: 'Build the coziest, most welcoming nest in the forest. Know every birdbath, cafe, and sunset spot.',
        five_year: 'Master 20 songs. Build a network of rest stops. Become the go-to social coordinator for the flock.',
        goals_2026: [
          // Yearly goals (no target_month)
          { id: 'g4', text: 'Visit 20 human cafes', type: 'count', completed: 7 },
          { id: 'g12', text: 'Master 5 new songs', type: 'count', completed: 2 },
          // Monthly goals (with target_month in YYYY-MM format)
          { id: 'g5', text: 'Learn the cardinal\'s song', type: 'milestone', target_month: curMonth },
          { id: 'g6', text: 'Winterize the nest', type: 'milestone', target_month: `${yr}-10` },
          { id: 'g9', text: 'Host spring flock gathering', type: 'milestone', target_month: curMonth },
          { id: 'g10', text: 'Complete morning routine streak — 30 days', type: 'count', target_month: `${yr}-04`, completed: 22 },
        ],
        milestones: [
          { id: 'ms4', text: '10th cafe visited', date: dateOnly(-5), level: 1, done: true },
          { id: 'ms5', text: 'First flock gathering hosted', date: dateOnly(-15), level: 2, done: true },
          { id: 'ms6', text: 'Dawn chorus solo performance', date: dateOnly(14), level: 3 },
        ],
        weekly_all: {
          [prevWeekKey]: { goals: [{ text: 'Dawn song 3x', completed: 2 }, { text: 'Cafe visit', completed: 1 }] },
          [weekKey]: { goals: ['Practice dawn song 3x', 'Cafe visit on Thursday', 'Organize Saturday gathering'] },
          ...(weekViewKey !== weekKey ? { [weekViewKey]: { goals: ['Practice dawn song 3x', 'Cafe visit on Thursday', 'Organize Saturday gathering'] } } : {}),
        },
      },
    ],
    weekly_current: null,
    monthly_current: null,
    milestones: [
      { id: 'ms1', text: '50th delivery route completed', date: dateOnly(-10), level: 2, done: true },
      { id: 'ms2', text: 'First canyon shortcut mapped', date: dateOnly(7), level: 1 },
      { id: 'ms3', text: 'Valley thermal map v1.0 complete', date: dateOnly(21), level: 3 },
      { id: 'ms4', text: '10th cafe visited', date: dateOnly(-5), level: 1, done: true },
      { id: 'ms5', text: 'First flock gathering hosted', date: dateOnly(-15), level: 2, done: true },
      { id: 'ms6', text: 'Dawn chorus solo performance', date: dateOnly(14), level: 3 },
      { id: 'ms7', text: 'Master all regional bird calls', date: dateOnly(45), level: 3 },
    ],
  };
}

// ── Preferences ────────────────────────────────────────────
export function getDemoPreferences() {
  return {};
}
