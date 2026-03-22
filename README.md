# Phoenix's Sky

An agent-native calendar you can fully customize with AI.

Phoenix is a busy bird — delivering letters, training with the flock, and sneaking into human cafés. Two AI agents help manage the chaos: **Piper** 🐦 handles deliveries and patrol logistics, **Robin** 🪺 watches out for rest and wellbeing. They leave notes on your calendar, send you letters with updates, and help track long-term goals through the Captain's Log.

> Zero UI libraries. Pure CSS Modules. Built to be read and rewritten by AI.

https://github.com/user-attachments/assets/afe7df82-45ee-44cd-b97d-db0a64cce5ec

## Quick Start

```bash
git clone https://github.com/jialing-wu/phoenixs-sky-v2.git
cd phoenixs-sky-v2
npm install
npm run dev
```

Opens at `localhost:3000` with mock data — no API keys needed.

## What You Get

### Calendar Views
- **Day / Week / Month views** with click-to-create, drag-to-resize, and keyboard arrow navigation
- **Weather forecast** in the header and week view (powered by Open-Meteo)
- **Splash screen** — a random agent greets you on each launch

### Agents
- **Piper** 🐦 — Delivery & Patrol coordinator. Leaves notes about routes, schedules, and efficiency
- **Robin** 🪺 — Rest & Wellness advocate. Reminds you to take breaks, socialize, and enjoy the sunset

### Letters
- **Agent letters** — Piper and Robin send you letters with route reports, wellness check-ins, and weekly summaries
- **Item assignment** — assign calendar items to agents, add notes, track their status (pending → accepted / modified / ignored)
- **Read/unread tracking** and reply system

### Captain's Log
- **Goals dashboard** — one board per agent (e.g., "Flight & Delivery" for Piper, "Nest & Wellness" for Robin)
- **Multi-level vision** — 10-year, 5-year, 3-year goals per board
- **Yearly goals** with count, milestone, and progress types
- **Weekly goals** with per-week tracking and completion percentages
- **Milestones** at 3 levels with completion tracking
- **Focus / Overview / Milestone** view modes

### Sidebar
- **Todoist sync** — tasks with range filters (Today / Tomorrow / Week / Month), postpone menu, tree structure, and task-to-event linking
- **Notion tracker** — projects, deadlines, weekly goals, and monthly goals at a glance

### UI
- **Right-click menu** — hide events, recolor, link to tasks, duplicate, feather (bookmark), move to Sky Life
- **Sky / Land toggle** — show or hide your "Sky Life" calendar (human café adventures)
- **Dark mode** — `prefers-color-scheme` toggles a full cyberpunk 80s theme with neon colors, scanlines, glitch animations, and terminal fonts (Orbitron, VT323)
- **Mobile-ready** — tab navigation (Calendar / Letters / Log / Tasks), floating action buttons, swipe navigation, long-press context menu

## Make It Yours

This project is designed to be customized by you and your AI. Open it in Claude Code, Cursor, Copilot — whatever you use — and start prompting:

- *"Add a third agent called Sparrow that tracks my fitness goals"*
- *"Change the color palette to ocean blues"*
- *"Connect my Outlook calendar instead of Google"*
- *"Add a habit tracker in the Captain's Log"*
- *"Create a focus mode that dims everything except the next 2 hours"*

### Connect Real Data

When you're ready to go beyond demo mode, set `NEXT_PUBLIC_DEMO=false` in `.env.local` and fill in your keys:

| Service | What it does | Required? |
|---|---|---|
| Google Calendar | Read & write events | Yes, for real data |
| Todoist | Task management | Optional |
| Notion | Project tracking | Optional |
| Upstash Redis | Sync preferences & goals across devices | Optional |
| Open-Meteo | Weather forecast (free, no key needed) | Auto |

See `.env.example` for all variables.

---

# For Agents

*The section below is written for AI coding agents who will help users customize this project. If you're a human, you can skip this — or read it to understand how things fit together.*

## Architecture at a Glance

```
app/
  layout.tsx              Root layout, fonts, metadata
  page.tsx                Main client component — all state lives here
  globals.css             Theme: colors, typography, CSS variables
  api/
    calendar/route.ts     Google Calendar read/write + ICS feeds
    todoist/route.ts      Todoist CRUD
    notion/route.ts       Notion database queries
    preferences/route.ts  Redis key-value for user prefs
    letters/route.ts      Agent letters — CRUD with Redis
    goals/route.ts        Captain's Log goals dashboard — CRUD with Redis
    weather/route.ts      Open-Meteo current + 7-day forecast

components/
  Header.tsx              Nav bar — view switcher, Sky/Land toggle, weather
  DayView.tsx             Hour grid + editorial panel (agent notes, detail)
  WeekView.tsx            7-column hour grid with weather row
  MonthView.tsx           Month grid with event pills
  Sidebar.tsx             Todos, Notion entries, calendar toggles
  EventDetail.tsx         Event inspector + create form
  ContextMenu.tsx         Right-click: hide, recolor, link task, feather, duplicate
  LettersView.tsx         Agent letter inbox with item assignment
  CaptainsLog.tsx         Goals dashboard — visions, yearly/weekly goals, milestones
  BookTabs.tsx            Mobile tab navigation (Calendar / Letters / Log / Tasks)
  SplashScreen.tsx        Agent greeting on launch

lib/
  agentConfig.ts          Agent definitions (names, emoji, colors, quotes, greetings)
  calendarConfig.ts       Calendar definitions, agent mappings, colors
  demoData.ts             Mock data generator (date-relative, always fresh)
  mockData.ts             TypeScript interfaces (CalendarEvent, TodoItem, etc.)
  layoutEvents.ts         Overlap/column layout algorithm for day/week grids
  auth.ts                 Google Calendar JWT auth helper
```

## Key Conventions

1. **No UI libraries.** Every component is plain React + CSS Modules. No Tailwind, no shadcn, no MUI. This makes the code fully readable to any AI without needing library docs.

2. **Demo / Prod dual mode.** `NEXT_PUBLIC_DEMO=true` routes all API calls to `lib/demoData.ts` instead of hitting real services. When a user asks you to add a feature, make it work in demo mode first — it's faster to iterate and doesn't require API keys.

3. **All state in `page.tsx`.** There's no state library. Events, todos, letters, goals, preferences, UI state — it all lives in the root component and flows down as props. Simple to trace, simple to extend.

4. **CSS variables for theming.** Colors, fonts, and spacing are defined in `globals.css` as `--var` tokens. Components reference these, so changing a theme is one file edit. Dark mode uses `prefers-color-scheme` and swaps to cyberpunk fonts + neon colors.

5. **Agent notes are just events.** An agent note is a regular `CalendarEvent` on the `notes` calendar, with the title formatted as `agentName — message`. No special data model needed.

6. **Agent config is separate.** `lib/agentConfig.ts` defines agent identity (name, emoji, color, quotes, greetings). `lib/calendarConfig.ts` maps calendars to agents. This separation makes it easy to add/swap agents.

7. **Preferences sync.** User preferences (hidden events, color overrides, task links, hidden calendars) persist to localStorage and optionally sync via Upstash Redis.

## How to Guide a User Through Customization

When a user asks you to customize this calendar, follow this workflow:

### Step 1 — Understand what they want

Ask about the *outcome*, not the implementation. "What should it look like when it's done?" is better than "Which component should I modify?"

### Step 2 — Pick the right file

| User wants to... | Edit this |
|---|---|
| Add/remove a calendar | `lib/calendarConfig.ts` — add entry to the calendar record |
| Add a new agent | `lib/agentConfig.ts` — add to AGENTS record with emoji, color, quotes, greetings; then `lib/calendarConfig.ts` — set `agent` on the relevant calendar |
| Change colors or fonts | `app/globals.css` — update CSS variables |
| Modify a view layout | `components/DayView.tsx`, `WeekView.tsx`, or `MonthView.tsx` |
| Add sidebar content | `components/Sidebar.tsx` |
| Add a new data source | Create `app/api/newSource/route.ts`, add fetch in `page.tsx` |
| Change the right-click menu | `components/ContextMenu.tsx` |
| Customize agent letters | `components/LettersView.tsx` for UI, `lib/demoData.ts` for mock letters |
| Modify goals dashboard | `components/CaptainsLog.tsx` for UI, `lib/demoData.ts` for mock goals |
| Change splash screen | `components/SplashScreen.tsx` for UI, `lib/agentConfig.ts` for greetings |
| Change mobile tabs | `components/BookTabs.tsx` |
| Add mock data for demo | `lib/demoData.ts` — add to the relevant generator function |

### Step 3 — Make it work in demo mode first

Edit `lib/demoData.ts` to include mock data for the new feature. This lets the user see results immediately without configuring external services.

### Step 4 — Show, don't tell

After making changes, use the dev server preview to verify. Take a screenshot or describe what changed. The user should see the result before you move on.

### Step 5 — Small steps

Don't rewrite three components at once. Make one change, confirm it works, then move to the next. If something breaks, it's easy to pinpoint.

## Example: Adding a New Agent

User says: *"Add a Sparrow agent that tracks my exercise."*

1. **`lib/agentConfig.ts`** — Add to the AgentId type and AGENTS record:
   ```ts
   export type AgentId = 'piper' | 'robin' | 'sparrow';

   sparrow: {
     id: 'sparrow',
     name: 'Sparrow',
     emoji: '🦅',
     color: '#D4A017',
     quotes: ['Another mile conquered!', 'Rest day earned.'],
     greetings: ['Ready for a morning run?', 'The trail is calling!'],
   },
   ```

2. **`lib/calendarConfig.ts`** — Add a new calendar entry:
   ```ts
   fitness: {
     label: 'Fitness',
     color: '#D4A017',
     googleId: 'demo-fitness',
     writable: true,
     agent: 'sparrow',
     agentLabel: 'sparrow (agent 3)',
   },
   ```

3. **`lib/demoData.ts`** — Add sample events and an agent note:
   ```ts
   { id: id(), title: 'Morning Run — River Trail', start: relDate(1, 6, 30), end: relDate(1, 7, 30), calendar: 'fitness' },
   { id: id(), title: 'sparrow — Great pace yesterday. Try adding hill intervals today.', start: dateOnly(0), end: dateOnly(0), calendar: 'notes', allDay: true },
   ```

4. **Verify** — the new events appear in all three views, Sparrow's note shows in the editorial panel, and the splash screen can show Sparrow's greeting.

## Example: Connecting a New API

User says: *"I want to see my GitHub issues in the sidebar."*

1. **`app/api/github/route.ts`** — New API route that fetches issues (with a demo guard):
   ```ts
   if (process.env.NEXT_PUBLIC_DEMO === 'true') {
     return Response.json(getMockGitHubIssues());
   }
   // real GitHub API call here
   ```

2. **`lib/demoData.ts`** — Add `getMockGitHubIssues()` with 3-4 sample items.

3. **`app/page.tsx`** — Add state + fetch, pass to Sidebar.

4. **`components/Sidebar.tsx`** — Render the new section below Notion entries.

## Things to Watch Out For

- **Don't break demo mode.** Every API route starts with `if (NEXT_PUBLIC_DEMO === 'true') return mock`. New routes should follow this pattern.
- **CSS Modules scope styles.** Each component has its own `.module.css`. Don't use global class names in components.
- **Mobile matters.** Test at 375px width. The app uses responsive breakpoints in CSS Modules — check that new UI doesn't overflow. New views may need a BookTabs entry.
- **Agent notes have a naming convention.** The title format `agentName — message` is parsed by `DayView.tsx` to render agent-colored notes. Keep this format when adding new agents.
- **Agent config is the source of truth.** When adding agents, always start with `lib/agentConfig.ts`. Other files reference it.
- **Letters and goals use Redis.** In demo mode they return static data. In prod they read/write to Upstash Redis. New features that need persistence should follow this pattern.
