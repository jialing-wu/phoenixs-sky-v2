'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import styles from './CaptainsLog.module.css';
// Board palette — muted earth tones derived from Phoenix accent
const BOARD_PALETTE = ['#8B3A2A', '#6B5B4F', '#7A6A54', '#5C6B5A', '#8B7355', '#6E5B5B'];

/* ── Types ─────────────────────────────── */

interface WeeklyLogEntry { note?: string; progress?: number; }

interface Goal {
  id: string; text: string;
  type: 'milestone' | 'progress' | 'frequency' | 'count';
  done?: boolean; target_value?: number; target_per_week?: number;
  completed?: number; unit?: string; baseline?: number; status?: string;
  target_month?: string;
  weekly_logs?: Record<string, WeeklyLogEntry> | Array<{ date: string; note: string; week?: string }>;
}

type WeekGoalItem = string | { text: string; completed?: number };
interface WeeklyAll { [weekKey: string]: { goals: WeekGoalItem[] }; }

function normalizeWeekGoal(g: WeekGoalItem): { text: string; completed: number } {
  if (typeof g === 'string') return { text: g, completed: 0 };
  return { text: g.text, completed: g.completed ?? 0 };
}

interface Milestone {
  id: string;
  text: string;
  date: string; // YYYY-MM-DD
  level: 1 | 2 | 3;
  done?: boolean;
}

interface Board {
  id: string; name: string; agent: string; emoji: string; color: string;
  goals_2026: Goal[];
  ten_year?: string; five_year?: string;
  three_year_2027?: string[]; three_year_2028?: string[];
  weekly_all?: WeeklyAll;
}

interface WeeklyCurrent {
  week: string; period: string;
  goals: Array<{ area: string; text: string; priority: string }>;
}

interface MonthlyCurrent {
  month: string;
  highlights: Array<{ area: string; text: string }>;
}

interface GoalsData {
  meta?: { identity?: string; last_updated?: string; current_year?: number };
  boards: Board[];
  weekly_current: WeeklyCurrent | null;
  monthly_current: MonthlyCurrent | null;
  milestones?: Milestone[];
}

/* ── Helpers ─────────────────────────────── */

function getBoardColor(boards: Board[], board: Board): string {
  const idx = boards.findIndex(b => b.id === board.id);
  return BOARD_PALETTE[idx % BOARD_PALETTE.length];
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function getCurrentWeekKey(): string {
  const now = new Date();
  const thu = new Date(now);
  thu.setDate(thu.getDate() + 3 - ((thu.getDay() + 6) % 7));
  const yearStart = new Date(thu.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((thu.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${thu.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function getWeeksInMonth(year: number, month: number): string[] {
  const weeks: string[] = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    const thu = new Date(d);
    thu.setDate(thu.getDate() + 3 - ((thu.getDay() + 6) % 7));
    const yearStart = new Date(thu.getFullYear(), 0, 1);
    const weekNum = Math.ceil(((thu.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    const key = `${thu.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
    if (!weeks.includes(key)) weeks.push(key);
    d.setDate(d.getDate() + 7);
  }
  return weeks;
}

function getWeekDateRange(weekStr: string): string {
  const match = weekStr.match(/(\d{4})-W(\d+)/);
  if (!match) return weekStr;
  const year = parseInt(match[1]);
  const week = parseInt(match[2]);
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dayOfWeek + 1 + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
  return `${fmt(monday)}\u2013${fmt(sunday)}`;
}

function shiftWeek(weekKey: string, delta: number): string {
  const match = weekKey.match(/(\d{4})-W(\d+)/);
  if (!match) return weekKey;
  let year = parseInt(match[1]);
  let week = parseInt(match[2]) + delta;
  if (week < 1) { year--; week = 52; }
  if (week > 52) { year++; week = 1; }
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/* ── Main Component ─────────────────────────────── */

interface CaptainsLogProps {
  externalData?: GoalsData | null;
  onDataChange?: (data: GoalsData) => void;
}

export default function CaptainsLog({ externalData, onDataChange }: CaptainsLogProps) {
  const [internalData, setInternalData] = useState<GoalsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'focus' | 'overview' | 'milestone'>('focus');
  const [focusMonth, setFocusMonth] = useState(() => new Date().getMonth());
  const [focusWeek, setFocusWeek] = useState(() => getCurrentWeekKey());
  const [visionOpen, setVisionOpen] = useState<Record<string, boolean>>({});
  const [yearSummaryOpen, setYearSummaryOpen] = useState(false);
  const [yearGoalsOpen, setYearGoalsOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<{ boardId: string; goalId: string } | null>(null);
  const [editText, setEditText] = useState('');
  const [visionEditValues, setVisionEditValues] = useState<Record<string, Record<string, string>>>({});
  const [prevMode, setPrevMode] = useState<'focus' | 'overview' | 'milestone'>('focus');
  const [inlineEdit, setInlineEdit] = useState(false);
  const isEditing = inlineEdit;
  const prevEditing = useRef(false);

  const data = externalData !== undefined ? externalData : internalData;
  const setData = useCallback((updater: GoalsData | ((prev: GoalsData | null) => GoalsData | null)) => {
    const newData = typeof updater === 'function' ? updater(data) : updater;
    if (newData) onDataChange?.(newData);
    setInternalData(typeof updater === 'function' ? updater : () => updater);
  }, [data, onDataChange]);

  const fetchGoals = useCallback(async () => {
    try {
      const res = await fetch('/api/goals');
      const json = await res.json();
      setData(json);
    } catch { /* ignore */ }
    setLoading(false);
  }, [setData]);

  useEffect(() => {
    if (externalData === undefined) fetchGoals(); else setLoading(false);
  }, [externalData, fetchGoals]);

  // Save vision edits when leaving edit mode (either mode toggle or inline edit)
  useEffect(() => {
    const wasEditing = prevEditing.current;
    const nowEditing = inlineEdit;
    if (wasEditing && !nowEditing) {
      Object.entries(visionEditValues).forEach(([boardId, fields]) => {
        Object.entries(fields).forEach(([field, value]) => {
          handleVisionUpdate(boardId, field, value);
        });
      });
      setVisionEditValues({});
    }
    prevEditing.current = nowEditing;
    setPrevMode(mode);
  }, [mode, inlineEdit]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Handlers ── */

  const handleAddGoal = useCallback(async (boardId: string, text: string, targetMonth?: string) => {
    const goalId = `g-${Date.now()}`;
    const newGoal: Goal = { id: goalId, text, type: 'milestone', target_month: targetMonth };
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        boards: prev.boards.map(b =>
          b.id === boardId ? { ...b, goals_2026: [...b.goals_2026, newGoal] } : b
        ),
      };
    });
    await fetch('/api/goals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_goal', boardId, goalId, field: '__add', value: newGoal }),
    }).catch(() => fetchGoals());
  }, [fetchGoals, setData]);

  const handleDeleteGoal = useCallback(async (boardId: string, goalId: string) => {
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        boards: prev.boards.map(b =>
          b.id === boardId ? { ...b, goals_2026: b.goals_2026.filter(g => g.id !== goalId) } : b
        ),
      };
    });
    await fetch('/api/goals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_goal', boardId, goalId, field: '__delete', value: true }),
    }).catch(() => fetchGoals());
  }, [fetchGoals, setData]);

  const handleUpdateGoal = useCallback(async (boardId: string, goalId: string, field: string, value: unknown) => {
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        boards: prev.boards.map(b =>
          b.id === boardId
            ? { ...b, goals_2026: b.goals_2026.map(g => g.id === goalId ? { ...g, [field]: value } : g) }
            : b
        ),
      };
    });
    await fetch('/api/goals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_goal', boardId, goalId, field, value }),
    }).catch(() => fetchGoals());
  }, [fetchGoals, setData]);

  const handleWeekGoalAdd = useCallback(async (boardId: string, weekKey: string, text: string) => {
    const newGoal = { text, completed: 0 };
    const board = data?.boards.find(b => b.id === boardId);
    const existingNorm = (board?.weekly_all?.[weekKey]?.goals || []).map(normalizeWeekGoal);
    const allGoals = [...existingNorm, newGoal];
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        boards: prev.boards.map(b => {
          if (b.id !== boardId) return b;
          const wa = { ...(b.weekly_all || {}) };
          wa[weekKey] = { goals: allGoals };
          return { ...b, weekly_all: wa };
        }),
      };
    });
    await fetch('/api/goals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_week_goals', boardId, weekKey, goals: allGoals }),
    }).catch(() => fetchGoals());
  }, [fetchGoals, setData, data]);

  const handleWeekGoalDelete = useCallback(async (boardId: string, weekKey: string, index: number) => {
    const board = data?.boards.find(b => b.id === boardId);
    const existing = (board?.weekly_all?.[weekKey]?.goals || []).map(normalizeWeekGoal);
    const updated = existing.filter((_, i) => i !== index);
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        boards: prev.boards.map(b => {
          if (b.id !== boardId) return b;
          const wa = { ...(b.weekly_all || {}) };
          wa[weekKey] = { goals: updated };
          return { ...b, weekly_all: wa };
        }),
      };
    });
    await fetch('/api/goals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_week_goals', boardId, weekKey, goals: updated }),
    }).catch(() => fetchGoals());
  }, [fetchGoals, setData, data]);

  const handleWeekGoalPctUpdate = useCallback(async (boardId: string, weekKey: string, index: number, pct: number) => {
    const board = data?.boards.find(b => b.id === boardId);
    const existing = (board?.weekly_all?.[weekKey]?.goals || []).map(normalizeWeekGoal);
    const updated = existing.map((g, i) => i === index ? { text: g.text, completed: pct } : g);
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        boards: prev.boards.map(b => {
          if (b.id !== boardId) return b;
          const wa = { ...(b.weekly_all || {}) };
          wa[weekKey] = { goals: updated };
          return { ...b, weekly_all: wa };
        }),
      };
    });
    await fetch('/api/goals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_week_goals', boardId, weekKey, goals: updated }),
    }).catch(() => fetchGoals());
  }, [fetchGoals, setData, data]);

  // Milestone CRUD — stored locally in GoalsData.milestones
  const milestones = useMemo(() => (data?.milestones || []).sort((a, b) => a.date.localeCompare(b.date)), [data]);

  const handleMilestoneAdd = useCallback(async (text: string, date: string, level: 1 | 2 | 3) => {
    const ms: Milestone = { id: `ms-${Date.now()}`, text, date, level, done: false };
    setData(prev => prev ? { ...prev, milestones: [...(prev.milestones || []), ms] } : prev);
    await fetch('/api/goals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_milestones', milestones: [...milestones, ms] }),
    }).catch(() => fetchGoals());
  }, [fetchGoals, setData, milestones]);

  const handleMilestoneDelete = useCallback(async (id: string) => {
    const updated = milestones.filter(m => m.id !== id);
    setData(prev => prev ? { ...prev, milestones: updated } : prev);
    await fetch('/api/goals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_milestones', milestones: updated }),
    }).catch(() => fetchGoals());
  }, [fetchGoals, setData, milestones]);

  const handleMilestoneToggle = useCallback(async (id: string) => {
    const updated = milestones.map(m => m.id === id ? { ...m, done: !m.done } : m);
    setData(prev => prev ? { ...prev, milestones: updated } : prev);
    await fetch('/api/goals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_milestones', milestones: updated }),
    }).catch(() => fetchGoals());
  }, [fetchGoals, setData, milestones]);

  const handleVisionUpdate = useCallback(async (boardId: string, field: string, value: string) => {
    if (!data) return;
    const updated: GoalsData = {
      ...data,
      boards: data.boards.map(b =>
        b.id === boardId ? { ...b, [field]: value } : b
      ),
    };
    onDataChange?.(updated);
    setInternalData(updated);
    try {
      await fetch('/api/goals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_board', boardId, field, value }),
      });
    } catch { /* silent */ }
  }, [data, onDataChange]);

  /* ── Render ── */

  if (loading) return <div className={styles.loading}>Loading...</div>;
  if (!data || !data.boards?.length) return <div className={styles.loading}>No data</div>;

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = data.meta?.current_year || now.getFullYear();
  const currentWeekKey = getCurrentWeekKey();
  const boards = data.boards;

  // Get goals for a specific month
  const getMonthGoals = (monthIdx: number): { board: Board; goals: Goal[] }[] => {
    const monthStr = `${currentYear}-${String(monthIdx + 1).padStart(2, '0')}`;
    return boards.map(b => ({
      board: b,
      goals: b.goals_2026.filter(g => {
        // Goals with target_month matching this month
        if (g.target_month?.startsWith(monthStr)) return true;
        // Goals with NO target_month show in every month (year-level goals)
        if (!g.target_month) return true;
        return false;
      }),
    })).filter(item => item.goals.length > 0);
  };

  // Vision horizons
  const horizons = [
    {
      label: '10 Years', years: '2036', field: 'ten_year',
      boards: boards.filter(b => b.ten_year).map(b => ({ board: b, text: b.ten_year! })),
    },
    {
      label: '5 Years', years: '2031', field: 'five_year',
      boards: boards.filter(b => b.five_year).map(b => ({ board: b, text: b.five_year! })),
    },
    {
      label: '3 Years', years: '2028\u20132029', field: 'three_year',
      boards: boards.filter(b => b.three_year_2027?.length || b.three_year_2028?.length).map(b => ({
        board: b,
        text: [...(b.three_year_2027 || []), ...(b.three_year_2028 || [])].join('\n'),
      })),
    },
  ];

  const renderGoalItem = (board: Board, g: Goal, monthIdx: number) => (
    <div key={g.id} className={styles.goalItem}>
      <span className={styles.goalDot} style={{ background: getBoardColor(boards, board) }} />
      {isEditing && editingGoal?.boardId === board.id && editingGoal?.goalId === g.id ? (
        <input
          className={styles.editInput}
          value={editText}
          onChange={e => setEditText(e.target.value)}
          onBlur={() => {
            if (editText.trim() && editText !== g.text) handleUpdateGoal(board.id, g.id, 'text', editText.trim());
            setEditingGoal(null);
          }}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          autoFocus
        />
      ) : (
        <>
          <span
            className={`${styles.goalText} ${g.done ? styles.goalDone : ''}`}
            onClick={() => {
              if (isEditing) { setEditingGoal({ boardId: board.id, goalId: g.id }); setEditText(g.text); }
            }}
          >{g.text}</span>
          <GoalPctBadge goal={g} boardId={board.id} onUpdate={handleUpdateGoal} />
        </>
      )}
      {isEditing && <button className={styles.deleteBtn} onClick={() => handleDeleteGoal(board.id, g.id)}>×</button>}
    </div>
  );

  const renderMonth = (monthIdx: number) => {
    const monthGoals = getMonthGoals(monthIdx);
    const isCurrent = monthIdx === currentMonth;
    const isPast = monthIdx < currentMonth;
    const monthStr = `${currentYear}-${String(monthIdx + 1).padStart(2, '0')}`;

    const showMonthHeader = mode !== 'focus';
    return (
      <div key={monthIdx} className={`${showMonthHeader ? styles.monthBlock : ''} ${isPast && showMonthHeader ? styles.monthPast : ''}`}>
        {showMonthHeader && (
          <div className={styles.monthHeader}>
            <div className={`${styles.monthDot} ${isCurrent ? styles.monthDotCurrent : ''}`} />
            <span className={isCurrent ? styles.monthLabelCurrent : styles.monthLabel}>
              {MONTH_NAMES[monthIdx]}
            </span>
            {isCurrent && <span className={styles.currentBadge}>now</span>}
            {monthGoals.length > 0 && (
              <span className={styles.monthCount}>
                {(() => {
                  const done = monthGoals.reduce((sum, mg) => sum + mg.goals.filter(g => g.done).length, 0);
                  const total = monthGoals.reduce((sum, mg) => sum + mg.goals.length, 0);
                  return total > 0 ? `${Math.round((done / total) * 100)}% ${done}/${total}` : '';
                })()}
              </span>
            )}
          </div>
        )}
        <div className={showMonthHeader ? styles.monthContent : styles.yearGoalsGrid}>
          {monthGoals.length === 0 && !isEditing && <div className={styles.emptyNote}>—</div>}
          {monthGoals.map(({ board, goals }) => {
            const doneCount = goals.filter(g => g.done).length;
            const boardColor = getBoardColor(boards, board);
            return (
              <div key={board.id} className={styles.boardCard}>
                <div className={styles.boardCardHeader}>
                  <span className={styles.boardTag} style={{ color: boardColor }}>{board.name}</span>
                  <span className={styles.boardCardCount}>{goals.length > 0 ? `${Math.round((doneCount / goals.length) * 100)}%` : ''} {doneCount}/{goals.length}</span>
                </div>
                <div className={styles.boardGoals}>
                  {goals.map(g => renderGoalItem(board, g, monthIdx))}
                  {isEditing && <AddGoalInput onAdd={(text) => handleAddGoal(board.id, text, monthStr)} />}
                </div>
              </div>
            );
          })}
          {isEditing && boards.filter(b => !monthGoals.find(mg => mg.board.id === b.id)).map(board => (
            <div key={board.id} className={styles.boardCard} style={{ opacity: 0.35 }}>
              <div className={styles.boardCardHeader}>
                <span className={styles.boardTag} style={{ color: getBoardColor(boards, board) }}>{board.name}</span>
              </div>
              <div className={styles.boardGoals}>
                <AddGoalInput onAdd={(text) => handleAddGoal(board.id, text, monthStr)} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Captain's Log</h1>
          <button
            className={inlineEdit ? styles.featherEditBtnActive : styles.featherEditBtn}
            onClick={() => setInlineEdit(v => !v)}
            title={inlineEdit ? 'Exit edit' : 'Edit'}
          />
        </div>
        <div className={styles.modeToggle}>
          <button className={mode === 'focus' ? styles.modeBtnActive : styles.modeBtn} onClick={() => setMode('focus')}>Focus</button>
          <button className={mode === 'overview' ? styles.modeBtnActive : styles.modeBtn} onClick={() => setMode('overview')}>Overview</button>
          <button className={mode === 'milestone' ? styles.modeBtnActive : styles.modeBtn} onClick={() => setMode('milestone')}>Milestones</button>
        </div>
      </div>
      {mode !== 'milestone' && (() => {
        const allGoals = boards.flatMap(b => b.goals_2026);
        const doneCount = allGoals.filter(g => g.done).length;
        const totalCount = allGoals.length;
        const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
        return (
          <div className={styles.yearProgress}>
            <div className={styles.yearProgressBar}>
              <div className={styles.yearProgressFill} style={{ width: `${pct}%` }} />
            </div>
            <span className={styles.yearProgressLabel}>{pct}% ({doneCount}/{totalCount})</span>
          </div>
        );
      })()}

      {/* Vision Section - horizontal cards (overview only) */}
      {mode === 'overview' && <div className={styles.section}>
        <div className={styles.horizonCards}>
          {horizons.map(horizon => {
            const isOpen = !!visionOpen[horizon.field];
            return (
              <div
                key={horizon.field}
                className={styles.horizonScroll}
                onClick={() => setVisionOpen(prev => ({ ...prev, [horizon.field]: !prev[horizon.field] }))}
              >
                <div className={styles.horizonScrollRod} />
                <div className={styles.horizonScrollBody}>
                  <div className={styles.horizonCardTitle}>
                    <span className={styles.horizonCardLabel}>{horizon.label}</span>
                    <span className={styles.horizonCardYears}>{horizon.years}</span>
                    <span className={styles.horizonCardCount}>{horizon.boards.length} boards</span>
                  </div>
                  {isOpen && (
                    <div className={styles.horizonCardBody} onClick={e => e.stopPropagation()}>
                      {(isEditing ? boards : horizon.boards.map(hb => hb.board)).map(board => {
                        const hb = horizon.boards.find(h => h.board.id === board.id);
                        const text = hb?.text || '';
                        if (!isEditing && !text) return null;
                        return (
                          <div key={board.id} className={styles.boardRow}>
                            <span className={styles.boardTag} style={{ color: getBoardColor(boards, board) }}>{board.name}</span>
                            {isEditing ? (
                              <div className={styles.editArea}>
                                <textarea
                                  value={visionEditValues[board.id]?.[horizon.field] ?? text}
                                  onChange={e => {
                                    setVisionEditValues(prev => ({
                                      ...prev,
                                      [board.id]: { ...(prev[board.id] || {}), [horizon.field]: e.target.value },
                                    }));
                                  }}
                                  placeholder={`${horizon.label} vision...`}
                                  rows={3}
                                />
                              </div>
                            ) : (
                              <div className={styles.visionText}>
                                {text.split('\n').map((line, i) => (
                                  <div key={i}>{line}</div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                {isOpen && <div className={styles.horizonScrollRod} />}
              </div>
            );
          })}
        </div>
      </div>}

      {/* Year Goals — scroll */}
      {mode !== 'milestone' && (() => {
        const yearGoals = boards.map(board => ({
          board,
          goals: board.goals_2026.filter(g => !g.target_month),
        })).filter(item => item.goals.length > 0);
        if (yearGoals.length === 0 && !isEditing) return null;
        const totalGoals = yearGoals.reduce((s, yg) => s + yg.goals.length, 0);
        const doneGoals = yearGoals.reduce((s, yg) => s + yg.goals.filter(g => g.done).length, 0);
        return (
          <div className={styles.yearGoalsScroll}>
            <div className={styles.yearGoalsScrollRod} onClick={() => setYearGoalsOpen(v => !v)} />
            <div className={styles.yearGoalsScrollBody}>
              <div className={styles.yearGoalsScrollHeader} onClick={() => setYearGoalsOpen(v => !v)}>
                <span className={styles.yearGoalsScrollChevron}>{yearGoalsOpen ? '▾' : '▸'}</span>
                <span className={styles.yearGoalsScrollTitle}>{currentYear} Yearly Goals</span>
                <span className={styles.yearGoalsScrollCount}>{totalGoals > 0 ? `${Math.round((doneGoals / totalGoals) * 100)}%` : ''} {doneGoals}/{totalGoals}</span>
              </div>
              {yearGoalsOpen && (
                <div className={styles.yearGoalsGrid}>
                  {yearGoals.map(({ board, goals }) => {
                    const doneCount = goals.filter(g => g.done).length;
                    const boardColor = getBoardColor(boards, board);
                    return (
                      <div key={board.id} className={styles.boardCard}>
                        <div className={styles.boardCardHeader}>
                          <span className={styles.boardTag} style={{ color: boardColor }}>{board.name}</span>
                          <span className={styles.boardCardCount}>{goals.length > 0 ? `${Math.round((doneCount / goals.length) * 100)}%` : ''} {doneCount}/{goals.length}</span>
                        </div>
                        <div className={styles.boardGoals}>
                          {goals.map(g => renderGoalItem(board, g, -1))}
                          {isEditing && <AddGoalInput onAdd={(text) => handleAddGoal(board.id, text)} />}
                        </div>
                      </div>
                    );
                  })}
                  {isEditing && boards.filter(b => !yearGoals.find(yg => yg.board.id === b.id)).map(board => (
                    <div key={board.id} className={styles.boardCard} style={{ opacity: 0.35 }}>
                      <div className={styles.boardCardHeader}>
                        <span className={styles.boardTag} style={{ color: getBoardColor(boards, board) }}>{board.name}</span>
                      </div>
                      <div className={styles.boardGoals}>
                        <AddGoalInput onAdd={(text) => handleAddGoal(board.id, text)} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {yearGoalsOpen && <div className={styles.yearGoalsScrollRod} />}
          </div>
        );
      })()}

      {/* Month Section */}
      {mode !== 'milestone' && (
      <div className={styles.section}>
        {mode === 'focus' ? (
          <>
            <div className={styles.sectionHeader}>
              <button className={styles.navBtn} onClick={() => setFocusMonth(m => Math.max(0, m - 1))}>◀</button>
              <span>{MONTH_NAMES[focusMonth]}</span>
              <button className={styles.navBtn} onClick={() => setFocusMonth(m => Math.min(11, m + 1))}>▶</button>
              {focusMonth === currentMonth && <span className={styles.currentBadge}>Current</span>}
            </div>
            {renderMonth(focusMonth)}
          </>
        ) : (
          <>
            {boards.map(board => {
              const boardColor = getBoardColor(boards, board);
              const allDone = board.goals_2026.filter(g => g.done && g.target_month).length;
              const allTotal = board.goals_2026.filter(g => g.target_month).length;
              return (
                <div key={board.id} className={styles.overviewBoard}>
                  <div className={styles.overviewBoardHeader} style={{ borderLeftColor: boardColor }}>
                    <span className={styles.overviewBoardTitle} style={{ color: boardColor }}>{board.emoji} {board.name}</span>
                    <span className={styles.boardCardCount}>{allTotal > 0 ? `${Math.round((allDone / allTotal) * 100)}%` : ''} {allDone}/{allTotal}</span>
                  </div>
                  <div className={styles.overviewMonthGrid}>
                    {Array.from({ length: 12 }, (_, monthIdx) => {
                      const monthStr = `${currentYear}-${String(monthIdx + 1).padStart(2, '0')}`;
                      const goals = board.goals_2026.filter(g => g.target_month?.startsWith(monthStr));
                      const isCurrent = monthIdx === currentMonth;
                      return (
                        <div key={monthIdx} className={`${styles.overviewMonthCell} ${isCurrent ? styles.overviewMonthCellCurrent : ''}`}>
                          <div className={styles.overviewMonthLabel}>{MONTH_SHORT[monthIdx]}</div>
                          {goals.map(g => (
                            <div key={g.id} className={styles.overviewGoalRow}>
                              <span className={styles.goalDot} style={{ background: boardColor }} />
                              {isEditing && editingGoal?.boardId === board.id && editingGoal?.goalId === g.id ? (
                                <input
                                  className={styles.overviewEditInput}
                                  value={editText}
                                  onChange={e => setEditText(e.target.value)}
                                  onBlur={() => {
                                    if (editText.trim() && editText !== g.text) handleUpdateGoal(board.id, g.id, 'text', editText.trim());
                                    setEditingGoal(null);
                                  }}
                                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                  autoFocus
                                />
                              ) : (
                                <span
                                  className={`${styles.overviewGoalText} ${g.done ? styles.goalDone : ''}`}
                                  onClick={() => { if (isEditing) { setEditingGoal({ boardId: board.id, goalId: g.id }); setEditText(g.text); } }}
                                >{g.text}</span>
                              )}
                              {isEditing && <GoalPctBadge goal={g} boardId={board.id} onUpdate={handleUpdateGoal} />}
                              {isEditing && <button className={styles.deleteBtn} onClick={() => handleDeleteGoal(board.id, g.id)}>×</button>}
                            </div>
                          ))}
                          {isEditing && <AddGoalInput onAdd={(text) => handleAddGoal(board.id, text, monthStr)} />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
      )}

      {/* Week Section - show all weeks of current month */}
      {(mode === 'focus') && (() => {
        const monthWeeks = getWeeksInMonth(currentYear, focusMonth);
        return (
          <div className={styles.section}>
            <div className={styles.sectionHeader}><span>Weekly Goals</span></div>
            <div className={styles.horizonCards}>
              {monthWeeks.map(weekKey => {
                const isCurrent = weekKey === currentWeekKey;
                const hasGoals = boards.some(b => (b.weekly_all?.[weekKey]?.goals || []).length > 0);
                if (!hasGoals && !isEditing) return null;
                return (
                  <div key={weekKey} className={styles.weekColumn}>
                    <div className={styles.weekColumnHeader}>
                      <span className={styles.weekColumnLabel}>{weekKey.replace(/^\d+-/, '')}</span>
                      <span className={styles.horizonCardYears}>{getWeekDateRange(weekKey)}</span>
                      {isCurrent && <span className={styles.currentBadge}>now</span>}
                    </div>
                    {boards.map(board => {
                      const rawWeekGoals = board.weekly_all?.[weekKey]?.goals || [];
                      const weekGoals = rawWeekGoals.map(normalizeWeekGoal);
                      if (weekGoals.length === 0 && !isEditing) return null;
                      const boardColor = getBoardColor(boards, board);
                      return (
                        <div key={board.id} className={styles.boardRow}>
                          <span className={styles.boardTag} style={{ color: boardColor }}>{board.name}</span>
                          <div className={styles.boardGoals}>
                            {weekGoals.map((g, i) => (
                              <div key={i} className={styles.goalItem}>
                                <span className={styles.goalDot} style={{ background: boardColor }} />
                                <span className={`${styles.goalText} ${g.completed >= 100 ? styles.goalDone : ''}`}>{g.text}</span>
                                <WeekGoalPctBadge
                                  completed={g.completed}
                                  onUpdate={(pct) => handleWeekGoalPctUpdate(board.id, weekKey, i, pct)}
                                />
                                {isEditing && <button className={styles.deleteBtn} onClick={() => handleWeekGoalDelete(board.id, weekKey, i)}>×</button>}
                              </div>
                            ))}
                            {isEditing && (
                              <WeekAddInput onAdd={(text) => handleWeekGoalAdd(board.id, weekKey, text)} />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Milestone Timeline — independent data */}
      {mode === 'milestone' && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}><span>Milestone Timeline</span></div>
          {milestones.length === 0 && !isEditing && <div className={styles.emptyNote}>No milestones yet</div>}
          {milestones.map(ms => {
            const isPast = ms.date < new Date().toISOString().slice(0, 10);
            const levelLabels = ['', '★', '★★', '★★★'];
            return (
              <div key={ms.id} className={`${styles.milestoneItem} ${isPast && !ms.done ? styles.monthPast : ''}`} data-level={ms.level}>
                <div className={`${styles.milestoneDot} ${ms.done ? styles.milestoneDotDone : ''}`} data-level={ms.level} />
                <div className={styles.milestoneBody}>
                  <div className={styles.milestoneRow}>
                    <span className={styles.milestoneLevel}>{levelLabels[ms.level]}</span>
                    <span
                      className={`${styles.milestoneText} ${ms.done ? styles.milestoneDone : ''}`}
                      onClick={() => handleMilestoneToggle(ms.id)}
                    >{ms.text}</span>
                    <span className={styles.milestoneDate}>{ms.date}</span>
                    {isEditing && <button className={styles.deleteBtn} onClick={() => handleMilestoneDelete(ms.id)}>×</button>}
                  </div>
                </div>
              </div>
            );
          })}
          {isEditing && <MilestoneAddInput onAdd={handleMilestoneAdd} />}
        </div>
      )}

      {/* Milestone Overview — not shown in milestone tab */}
      {mode !== 'milestone' && milestones.filter(m => m.level === 1).length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}><span>Milestone Overview</span></div>
          <div className={styles.milestoneOverview}>
            {(mode === 'focus'
              ? milestones.filter(m => m.level === 1 && m.date.startsWith(String(currentYear)))
              : milestones.filter(m => m.level === 1)
            ).map(ms => (
              <div key={ms.id} className={styles.milestoneOverviewItem}>
                <span className={`${styles.milestoneDot} ${ms.done ? styles.milestoneDotDone : ''}`} data-level={ms.level} />
                <span className={`${styles.milestoneOverviewText} ${ms.done ? styles.milestoneDone : ''}`}>{ms.text}</span>
                <span className={styles.milestoneDate}>{ms.date}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Small Input Components ── */

function WeekAddInput({ onAdd }: { onAdd: (text: string) => void }) {
  const [text, setText] = useState('');
  return (
    <form className={styles.weekAddForm} onSubmit={e => { e.preventDefault(); if (text.trim()) { onAdd(text.trim()); setText(''); } }}>
      <input className={styles.weekAddInput} value={text} onChange={e => setText(e.target.value)} placeholder="Add week goal..." />
    </form>
  );
}

function AddGoalInput({ onAdd }: { onAdd: (text: string) => void }) {
  const [text, setText] = useState('');
  return (
    <form className={styles.addGoalForm} onSubmit={e => { e.preventDefault(); if (text.trim()) { onAdd(text.trim()); setText(''); } }}>
      <input className={styles.addGoalInput} value={text} onChange={e => setText(e.target.value)} placeholder="Add goal..." />
    </form>
  );
}

function MilestoneAddInput({ onAdd }: { onAdd: (text: string, date: string, level: 1 | 2 | 3) => void }) {
  const [text, setText] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [level, setLevel] = useState<1 | 2 | 3>(2);
  return (
    <form className={styles.milestoneAddForm} onSubmit={e => { e.preventDefault(); if (text.trim()) { onAdd(text.trim(), date, level); setText(''); } }}>
      <select className={styles.milestoneLevelSelect} value={level} onChange={e => setLevel(Number(e.target.value) as 1 | 2 | 3)}>
        <option value={1}>★ Level 1</option>
        <option value={2}>★★ Level 2</option>
        <option value={3}>★★★ Level 3</option>
      </select>
      <input className={styles.milestoneAddDate} type="date" value={date} onChange={e => setDate(e.target.value)} />
      <input className={styles.milestoneAddText} value={text} onChange={e => setText(e.target.value)} placeholder="New milestone..." />
      <button className={styles.milestoneAddBtn} type="submit">+</button>
    </form>
  );
}

function GoalPctBadge({ goal, boardId, onUpdate }: {
  goal: { id: string; completed?: number; done?: boolean };
  boardId: string;
  onUpdate: (boardId: string, goalId: string, field: string, value: unknown) => void;
}) {
  const [editing, setEditing] = useState(false);
  const pct = goal.completed ?? (goal.done ? 100 : 0);
  const [val, setVal] = useState(String(pct));

  useEffect(() => { setVal(String(goal.completed ?? (goal.done ? 100 : 0))); }, [goal.completed, goal.done]);

  if (editing) {
    return (
      <input
        className={styles.pctInput}
        type="number" min="0" max="100"
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={() => {
          const n = Math.max(0, Math.min(100, parseInt(val) || 0));
          onUpdate(boardId, goal.id, 'completed', n);
          onUpdate(boardId, goal.id, 'done', n >= 100);
          setEditing(false);
        }}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        autoFocus
      />
    );
  }

  return (
    <span className={styles.pctBadge} onClick={() => setEditing(true)}>
      {pct}%
    </span>
  );
}

function WeekGoalPctBadge({ completed, onUpdate }: {
  completed: number;
  onUpdate: (pct: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(completed));

  useEffect(() => { setVal(String(completed)); }, [completed]);

  if (editing) {
    return (
      <input
        className={styles.pctInput}
        type="number" min="0" max="100"
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={() => {
          const n = Math.max(0, Math.min(100, parseInt(val) || 0));
          onUpdate(n);
          setEditing(false);
        }}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        autoFocus
      />
    );
  }

  return (
    <span className={styles.pctBadge} onClick={() => setEditing(true)}>
      {completed}%
    </span>
  );
}
