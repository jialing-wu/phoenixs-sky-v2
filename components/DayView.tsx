'use client';

import { useMemo, useRef, useCallback, useState, useEffect } from 'react';
import styles from './DayView.module.css';
import { CalendarEvent, CALENDAR_META, formatTime, getConferenceLabel } from '@/lib/mockData';
import { CALENDARS, CalendarSource } from '@/lib/calendarConfig';
import { layoutOverlapping } from '@/lib/layoutEvents';

interface DayViewProps {
  date: Date;
  events: CalendarEvent[];
  noteEvents?: CalendarEvent[];
  hiddenEvents?: Set<string>;
  colorOverrides?: Map<string, string>;
  taskLinks?: Map<string, string>;
  featheredEvents?: Set<string>;
  onToggleTask?: (eventId: string, done: boolean) => void;
  onEventClick: (event: CalendarEvent) => void;
  onSlotClick: (start: string, end: string) => void;
  onEventMove: (id: string, newStart: string, newEnd: string) => void;
  onEventResize: (id: string, newEnd: string, newStart?: string) => void;
  onContextMenu?: (event: CalendarEvent, x: number, y: number) => void;
  onNavigate?: (dir: -1 | 1) => void;
  showEditorial?: boolean;
  questStats?: { xp: number; level: number; streak: number; totalCompleted: number };
  onCreateNote?: (title: string, date: Date) => void;
}

const TOTAL_HOURS = 24;
const EARLY_END = 7;
const COLLAPSE_WEIGHT = 1;
const VISIBLE_HOURS = [0, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

// Agent name → color for notes (check both romaji and kanji)
const AGENT_COLORS: Record<string, string> = {};
const AGENT_ALIASES: Record<string, string> = {
  // Homura (焰/焔/炎 / ほむら/ホムラ / 暁美ほむら)
  '\u7130': 'homura', '\u7114': 'homura', '\u708e': 'homura',
  '\u307b\u3080\u3089': 'homura', '\u30db\u30e0\u30e9': 'homura',
  '\u66c9\u7f8e\u307b\u3080\u3089': 'homura',
  // Madoka (円 / まどか / 鹿目まどか)
  '\u5186': 'madoka', '\u307e\u3069\u304b': 'madoka',
  '\u9e7f\u76ee\u307e\u3069\u304b': 'madoka',
  // Shinobu (忍 / しのぶ / 胡蝶しのぶ)
  '\u5fcd': 'shinobu', '\u3057\u306e\u3076': 'shinobu',
  '\u80e1\u8776\u3057\u306e\u3076': 'shinobu',
  '\u90a3\u8fad': 'nadi',
  '\u7ed8\u854a\u5a1c': 'elaina', '\u30a8\u30ec\u30a4\u30ca': 'elaina',
  '\u9732\u8bfa': 'luno',
};
for (const [, meta] of Object.entries(CALENDARS)) {
  if (meta.agent) AGENT_COLORS[meta.agent.toLowerCase()] = meta.color;
}

function getNoteAgentColor(title: string, description?: string): string | undefined {
  const text = `${title}\n${description || ''}`.toLowerCase();
  // Check romaji agent names
  for (const [agent, color] of Object.entries(AGENT_COLORS)) {
    if (text.includes(agent)) return color;
  }
  // Check kanji/kana aliases
  const fullText = `${title}\n${description || ''}`;
  for (const [alias, agent] of Object.entries(AGENT_ALIASES)) {
    if (fullText.includes(alias)) return AGENT_COLORS[agent];
  }
  return undefined;
}

const AGENT_CN: Record<string, string> = {
  homura: '焰', madoka: '圆', shinobu: '忍', nadi: '娜迪', luno: '鹿野', elaina: '伊莲娜', eliana: '伊莲娜', kanae: '香奈惠',
};

function toChineseName(name: string): string {
  if (!name) return 'You';
  const lower = name.toLowerCase().trim();
  // Direct English match
  if (AGENT_CN[lower]) return AGENT_CN[lower];
  // Check if name contains an English agent name
  for (const [eng, cn] of Object.entries(AGENT_CN)) {
    if (lower.includes(eng)) return cn;
  }
  // Check kanji/kana aliases
  for (const [alias, agent] of Object.entries(AGENT_ALIASES)) {
    if (name.includes(alias)) return AGENT_CN[agent] || name;
  }
  return name;
}

// All known agent name variants (English + Japanese kanji/kana)
const ALL_AGENT_NAMES = [
  // English romaji
  'homura', 'madoka', 'shinobu', 'nadi', 'luno', 'elaina', 'eliana', 'kanae',
  // Japanese kanji (homura variants: 焰/焔/炎)
  '\u7130', '\u7114', '\u708e',
  '\u5186', '\u5fcd', '\u9999\u5948\u6075',
  // Japanese kana (homura katakana added)
  '\u307b\u3080\u3089', '\u30db\u30e0\u30e9',
  '\u307e\u3069\u304b', '\u3057\u306e\u3076',
  '\u306a\u3067', '\u30eb\u30ce', '\u30a8\u30e9\u30a4\u30ca',
];

function getNoteAgentName(description?: string): string {
  if (!description) return '';
  const trimmed = description.trim();
  // 1. Match "– agentname" or "— agentname" or "- agentname" prefix
  const dashMatch = trimmed.match(/^[-\u2013\u2014]\s*(.+)/)?.[1]?.trim();
  if (dashMatch) {
    // dashMatch itself might be the name, or contain it
    const dm = dashMatch.toLowerCase();
    const found = ALL_AGENT_NAMES.find(a => dm === a.toLowerCase() || dashMatch === a);
    if (found) return dashMatch;
    // Check aliases too
    const aliasFound = Object.keys(AGENT_ALIASES).find(a => dashMatch === a);
    if (aliasFound) return dashMatch;
    return dashMatch; // return whatever was after the dash
  }
  // 2. Search for any known name within the description (includes, not just exact match)
  const lower = trimmed.toLowerCase();
  for (const a of ALL_AGENT_NAMES) {
    if (lower.includes(a.toLowerCase()) || trimmed.includes(a)) return a;
  }
  // 3. Check AGENT_ALIASES keys (kanji/kana)
  for (const a of Object.keys(AGENT_ALIASES)) {
    if (trimmed.includes(a)) return a;
  }
  return '';
}

function minutesToIso(baseDate: Date, minutes: number): string {
  const d = new Date(baseDate);
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  // Return local ISO format (YYYY-MM-DDTHH:MM:SS) instead of UTC
  // so CreateEventForm gets the correct local time
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

export default function DayView({ date, events, noteEvents, hiddenEvents, colorOverrides, taskLinks, featheredEvents, onToggleTask, onEventClick, onSlotClick, onEventMove, onEventResize, onContextMenu, onNavigate, showEditorial, questStats, onCreateNote }: DayViewProps) {
  // Use LOCAL date string (not UTC) to correctly handle timezone offsets
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const containerRef = useRef<HTMLDivElement>(null);
  const [pxPerMin, setPxPerMin] = useState(1);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const h = el.clientHeight;
      if (h > 0) setPxPerMin(Math.max(0.25, h / (TOTAL_HOURS * 60)));
    };
    // Measure after layout settles (rAF + fallback timeout for tab-switch remount)
    const raf = requestAnimationFrame(measure);
    const timer = setTimeout(measure, 100);
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => { cancelAnimationFrame(raf); clearTimeout(timer); observer.disconnect(); };
  }, []);

  const totalWeight = COLLAPSE_WEIGHT + (TOTAL_HOURS - EARLY_END);
  const normalHourH = pxPerMin * 60 * TOTAL_HOURS / totalWeight;
  const collapsedH = normalHourH * COLLAPSE_WEIGHT;
  const normalPxPerMin = normalHourH / 60;
  const earlyPxPerMin = collapsedH / (EARLY_END * 60);

  function minToPx(minutes: number): number {
    const earlyMinutes = EARLY_END * 60;
    if (minutes <= earlyMinutes) return minutes * earlyPxPerMin;
    return earlyMinutes * earlyPxPerMin + (minutes - earlyMinutes) * normalPxPerMin;
  }

  function getHourH(h: number): number {
    return h === 0 ? collapsedH : normalHourH;
  }

  function pxToMin(y: number): number {
    const earlyPxTotal = EARLY_END * 60 * earlyPxPerMin;
    if (y <= earlyPxTotal) return y / earlyPxPerMin;
    return EARLY_END * 60 + (y - earlyPxTotal) / normalPxPerMin;
  }

  const dayEvents = useMemo(() =>
    events.filter(e => {
      if (e.allDay) return false;
      const d = new Date(e.start);
      const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return local === dateStr;
    }).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()),
    [events, dateStr]
  );

  const allDayEvents = useMemo(() =>
    events.filter(e => {
      if (!e.allDay) return false;
      const s = e.start.split('T')[0];
      // Normalize end: if end <= start (missing DTEND or same-day), treat as next day
      let end = e.end.split('T')[0];
      if (end <= s) {
        const d = new Date(s + 'T00:00:00Z');
        d.setUTCDate(d.getUTCDate() + 1);
        end = d.toISOString().split('T')[0];
      }
      return s <= dateStr && end > dateStr;
    }),
    [events, dateStr]
  );

  const now = new Date();
  const isToday = dateStr === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  function getEventPos(event: CalendarEvent): { top: number; height: number; startMin: number; endMin: number } {
    const start = new Date(event.start);
    const end = new Date(event.end);
    let startMin = start.getHours() * 60 + start.getMinutes();
    let endMin = end.getHours() * 60 + end.getMinutes();
    if (endMin <= startMin) endMin = TOTAL_HOURS * 60;
    return { top: minToPx(startMin), height: Math.max(minToPx(endMin) - minToPx(startMin), 15), startMin, endMin };
  }

  // ── Drag state ──
  const dragRef = useRef<{
    type: 'move' | 'resize' | 'resize-top'; eventId: string; startY: number;
    origTop: number; origHeight: number; hasMoved: boolean;
  } | null>(null);
  const [dragDelta, setDragDelta] = useState<number>(0);
  const [dragEventId, setDragEventId] = useState<string | null>(null);
  const edgeNavTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent, type: 'move' | 'resize' | 'resize-top', event: CalendarEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation(); e.preventDefault();
    const pos = getEventPos(event);
    dragRef.current = { type, eventId: event.id, startY: e.clientY, origTop: pos.top, origHeight: pos.height, hasMoved: false };
    setDragEventId(event.id); setDragDelta(0);

    const clearEdgeTimer = () => { if (edgeNavTimer.current) { clearTimeout(edgeNavTimer.current); edgeNavTimer.current = null; } };

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      dragRef.current.hasMoved = true;
      setDragDelta(ev.clientY - dragRef.current.startY);

      // Edge detection for day navigation
      if (onNavigate && dragRef.current.type === 'move' && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const EDGE = 40;
        if (ev.clientX < rect.left + EDGE) {
          if (!edgeNavTimer.current) {
            edgeNavTimer.current = setTimeout(() => {
              // Move event to same time on previous day before navigating
              const dy = ev.clientY - dragRef.current!.startY;
              const origTopMin = Math.round(pxToMin(dragRef.current!.origTop) / 15) * 15;
              const origHeightMin = Math.round(pxToMin(dragRef.current!.origTop + dragRef.current!.origHeight) / 15) * 15 - origTopMin;
              const newTopPx = dragRef.current!.origTop + dy;
              const newTopMin = Math.round(pxToMin(Math.max(0, newTopPx)) / 15) * 15;
              const prevDay = new Date(date); prevDay.setDate(prevDay.getDate() - 1);
              onEventMove(dragRef.current!.eventId, minutesToIso(prevDay, newTopMin), minutesToIso(prevDay, newTopMin + origHeightMin));
              dragRef.current = null; setDragEventId(null); setDragDelta(0);
              window.removeEventListener('mousemove', onMouseMove);
              window.removeEventListener('mouseup', onMouseUp);
              onNavigate(-1);
            }, 500);
          }
        } else if (ev.clientX > rect.right - EDGE) {
          if (!edgeNavTimer.current) {
            edgeNavTimer.current = setTimeout(() => {
              const dy = ev.clientY - dragRef.current!.startY;
              const origTopMin = Math.round(pxToMin(dragRef.current!.origTop) / 15) * 15;
              const origHeightMin = Math.round(pxToMin(dragRef.current!.origTop + dragRef.current!.origHeight) / 15) * 15 - origTopMin;
              const newTopPx = dragRef.current!.origTop + dy;
              const newTopMin = Math.round(pxToMin(Math.max(0, newTopPx)) / 15) * 15;
              const nextDay = new Date(date); nextDay.setDate(nextDay.getDate() + 1);
              onEventMove(dragRef.current!.eventId, minutesToIso(nextDay, newTopMin), minutesToIso(nextDay, newTopMin + origHeightMin));
              dragRef.current = null; setDragEventId(null); setDragDelta(0);
              window.removeEventListener('mousemove', onMouseMove);
              window.removeEventListener('mouseup', onMouseUp);
              onNavigate(1);
            }, 500);
          }
        } else {
          clearEdgeTimer();
        }
      }
    };

    const onMouseUp = (ev: MouseEvent) => {
      clearEdgeTimer();
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      if (!dragRef.current) return;
      if (!dragRef.current.hasMoved) {
        const clicked = events.find(e => e.id === dragRef.current!.eventId);
        dragRef.current = null; setDragEventId(null); setDragDelta(0);
        if (clicked) onEventClick(clicked);
        return;
      }
      const dy = ev.clientY - dragRef.current.startY;
      const origTopMin = Math.round(pxToMin(dragRef.current.origTop) / 15) * 15;
      const origHeightMin = Math.round(pxToMin(dragRef.current.origTop + dragRef.current.origHeight) / 15) * 15 - origTopMin;
      const newTopPx = dragRef.current.origTop + dy;
      const newTopMin = Math.round(pxToMin(Math.max(0, newTopPx)) / 15) * 15;
      if (dragRef.current.type === 'move') {
        onEventMove(dragRef.current.eventId, minutesToIso(date, newTopMin), minutesToIso(date, newTopMin + origHeightMin));
      } else if (dragRef.current.type === 'resize-top') {
        const origEndMin = origTopMin + origHeightMin;
        const newStartMin = Math.max(0, Math.min(newTopMin, origEndMin - 15));
        onEventResize(dragRef.current.eventId, minutesToIso(date, origEndMin), minutesToIso(date, newStartMin));
      } else {
        const newBottomPx = dragRef.current.origTop + dragRef.current.origHeight + dy;
        const newBottomMin = Math.round(pxToMin(Math.max(0, newBottomPx)) / 15) * 15;
        const newHeightMin = Math.max(15, newBottomMin - origTopMin);
        onEventResize(dragRef.current.eventId, minutesToIso(date, origTopMin + newHeightMin));
      }
      dragRef.current = null; setDragEventId(null); setDragDelta(0);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [date, events, onEventMove, onEventResize, onEventClick, onNavigate, pxPerMin]);

  // ── Slot drag ──
  const slotDragRef = useRef<{ startMin: number; currentMin: number } | null>(null);
  const [slotSelect, setSlotSelect] = useState<{ top: number; height: number } | null>(null);
  const [noteAdding, setNoteAdding] = useState(false);
  const noteInputRef = useRef<HTMLInputElement>(null);

  const handleSlotMouseDown = useCallback((e: React.MouseEvent) => {
    if (dragEventId) return;
    if ((e.target as HTMLElement).closest('[class*="event"]')) return;
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    const minutes = Math.floor(pxToMin(y) / 15) * 15;
    slotDragRef.current = { startMin: minutes, currentMin: minutes };
    setSlotSelect({ top: minToPx(minutes), height: minToPx(minutes + 15) - minToPx(minutes) });

    const onMouseMove = (ev: MouseEvent) => {
      if (!slotDragRef.current) return;
      const my = ev.clientY - rect.top;
      const curMin = Math.floor(pxToMin(my) / 15) * 15;
      slotDragRef.current.currentMin = curMin;
      const topMin = Math.min(slotDragRef.current.startMin, curMin);
      const bottomMin = Math.max(slotDragRef.current.startMin, curMin) + 15;
      setSlotSelect({ top: minToPx(topMin), height: minToPx(bottomMin) - minToPx(topMin) });
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      if (!slotDragRef.current) return;
      const topMin = Math.min(slotDragRef.current.startMin, slotDragRef.current.currentMin);
      const bottomMin = Math.max(slotDragRef.current.startMin, slotDragRef.current.currentMin) + 15;
      const start = minutesToIso(date, topMin);
      const end = minutesToIso(date, topMin + Math.max(bottomMin - topMin, 60));
      slotDragRef.current = null; setSlotSelect(null);
      onSlotClick(start, end);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [date, onSlotClick, dragEventId, pxPerMin]);

  return (
    <div className={`${styles.container} ${showEditorial ? styles.editorialMode : ''}`}>
      {allDayEvents.length > 0 && (
        <div className={styles.allDayBar}>
          <div className={styles.allDayLabel}>all day</div>
          <div className={styles.allDayEvents}>
            {allDayEvents.map(e => {
              if (hiddenEvents?.has(e.id)) return null;
              const meta = CALENDAR_META[e.calendar];
              return (
                <div key={e.id} className={styles.allDayChip} style={{ borderLeftColor: meta.color, background: `color-mix(in srgb, ${meta.color} 8%, var(--bg))` }}
                  onClick={() => onEventClick(e)}
                  onContextMenu={(ev) => { ev.preventDefault(); ev.stopPropagation(); onContextMenu?.(e, ev.clientX, ev.clientY); }}
                  onTouchStart={(ev) => {
                    const touch = ev.touches[0];
                    longPressTimer.current = setTimeout(() => {
                      onContextMenu?.(e, touch.clientX, touch.clientY);
                    }, 500);
                  }}
                  onTouchMove={() => {
                    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
                  }}
                  onTouchEnd={() => {
                    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
                  }}>
                  {taskLinks?.has(e.id) && (
                    <button className={styles.taskCheck} style={{ borderColor: meta.color, background: hiddenEvents?.has(e.id) ? meta.color : 'transparent' }}
                      onClick={(ev) => { ev.stopPropagation(); onToggleTask?.(e.id, !hiddenEvents?.has(e.id)); }}
                      onMouseDown={(ev) => ev.stopPropagation()} />
                  )}
                  <span className={styles.allDayTitle}>{e.title}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className={styles.timeline} ref={containerRef}>
        <div className={styles.timeColumn}>
          {VISIBLE_HOURS.map(h => (
            <div key={h} className={styles.timeLabel} style={{ height: `${getHourH(h)}px` }}>
              {h === 0 ? '00:00' : `${String(h).padStart(2, '0')}:00`}
            </div>
          ))}
        </div>
        <div className={styles.dayColumn} onMouseDown={handleSlotMouseDown}>
          {VISIBLE_HOURS.map(h => (
            <div key={h} className={styles.hourSlot} style={{ height: `${getHourH(h)}px` }} />
          ))}
          {(() => {
            const layout = layoutOverlapping(
              dayEvents
                .filter(e => !hiddenEvents?.has(e.id))
                .map(e => {
                  const start = new Date(e.start);
                  const end = new Date(e.end);
                  let startMin = start.getHours() * 60 + start.getMinutes();
                  let endMin = end.getHours() * 60 + end.getMinutes();
                  if (endMin <= startMin) endMin = TOTAL_HOURS * 60;
                  return { id: e.id, startMin, endMin };
                })
            );
            return dayEvents.map(event => {
              const baseMeta = CALENDAR_META[event.calendar];
              const overrideColor = colorOverrides?.get(event.id);
              const meta = overrideColor ? { ...baseMeta, color: overrideColor } : baseMeta;
              const pos = getEventPos(event);
              const col = layout.get(event.id) || { col: 0, totalCols: 1 };
              const leftPct = (col.col / col.totalCols) * 100;
              const widthPct = (1 / col.totalCols) * 100;
              let style: React.CSSProperties = {
                top: `${pos.top}px`, height: `${pos.height}px`,
                backgroundColor: `color-mix(in srgb, ${meta.color} 6%, var(--bg))`,
                left: `${leftPct}%`, width: `calc(${widthPct}% - 4px)`, right: 'auto',
              };
              if (dragEventId === event.id && dragRef.current) {
                const localPxPerMin = pos.startMin < EARLY_END * 60 ? earlyPxPerMin : normalPxPerMin;
                const snap = Math.round(dragDelta / (localPxPerMin * 15)) * (localPxPerMin * 15);
                if (dragRef.current.type === 'move') style = { ...style, top: `${pos.top + snap}px`, opacity: 0.8, zIndex: 20 };
                else if (dragRef.current.type === 'resize-top') style = { ...style, top: `${pos.top + snap}px`, height: `${Math.max(15, pos.height - snap)}px`, opacity: 0.8, zIndex: 20 };
                else style = { ...style, height: `${Math.max(15, pos.height + snap)}px`, opacity: 0.8, zIndex: 20 };
              }
              if (hiddenEvents?.has(event.id) && !taskLinks?.has(event.id)) {
                style.opacity = 0.15;
              }
              const isTaskLinked = taskLinks?.has(event.id);
              const isFeathered = featheredEvents?.has(event.id);
              return (
                <div key={event.id} className={`${styles.event} ${isFeathered ? styles.eventFeathered : ''}`} style={style}
                  onMouseDown={(e) => handleMouseDown(e, 'move', event)}
                  onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu?.(event, e.clientX, e.clientY); }}
                  onTouchStart={(e) => {
                    const touch = e.touches[0];
                    longPressTimer.current = setTimeout(() => {
                      onContextMenu?.(event, touch.clientX, touch.clientY);
                    }, 500);
                  }}
                  onTouchMove={() => {
                    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
                  }}
                  onTouchEnd={() => {
                    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
                  }}>
                  <div className={styles.resizeHandleTop}
                    onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, 'resize-top', event); }} />
                  <div className={styles.eventBar} style={{ backgroundColor: meta.color }} />
                  {(() => {
                    const LINE_H = 17.7; // title line: 0.85rem * 1.3
                    const PAD = 6;
                    const contentH = pos.height - PAD;
                    const totalLines = Math.floor(contentH / LINE_H);
                    const showMeta = totalLines >= 2;
                    const titleLines = showMeta ? Math.max(1, totalLines - 1) : Math.max(1, totalLines);
                    const isDone = hiddenEvents?.has(event.id);
                    return (
                      <>
                        <div className={styles.eventTitleRow}>
                          {isTaskLinked && (
                            <button className={styles.taskCheck} style={{ borderColor: meta.color, background: isDone ? meta.color : 'transparent' }}
                              onClick={(e) => { e.stopPropagation(); onToggleTask?.(event.id, !isDone); }}
                              onMouseDown={(e) => e.stopPropagation()} />
                          )}
                          <div className={`${styles.eventTitle} ${isDone ? styles.eventTitleDone : ''}`} style={{
                            color: meta.color,
                            WebkitLineClamp: titleLines,
                            maxHeight: `${titleLines * LINE_H}px`,
                          }}>{event.title}</div>
                        </div>
                        {showMeta && (
                          <div className={styles.eventMeta}>
                            <span className={styles.eventTime}>
                              {formatTime(event.start)} – {formatTime(event.end)}
                              {(() => {
                                const confUrl = event.conferenceUrl || (event.location && /^https?:\/\//.test(event.location) ? event.location : null);
                                return confUrl ? (
                                  <a href={confUrl} target="_blank" rel="noopener noreferrer"
                                    className={styles.confLink} onClick={e => e.stopPropagation()}
                                    onMouseDown={e => e.stopPropagation()}>
                                    {getConferenceLabel(confUrl)}
                                  </a>
                                ) : null;
                              })()}
                            </span>
                            {event.location && !/^https?:\/\//.test(event.location) && <span className={styles.eventLocation}>{event.location}</span>}
                          </div>
                        )}
                      </>
                    );
                  })()}
                  <div className={styles.resizeHandle}
                    onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, 'resize', event); }} />
                </div>
              );
            });
          })()}
          {slotSelect && <div className={styles.slotHighlight} style={{ top: `${slotSelect.top}px`, height: `${slotSelect.height}px` }} />}
          {isToday && <div className={styles.nowLine} style={{ top: `${minToPx(nowMinutes)}px` }} />}
        </div>
      </div>

      <div className={styles.editorial}>
        <div className={styles.editorialDate}>{DAYS_OF_WEEK[date.getDay()]}</div>
        {(() => {
          const lvLabel = questStats ? `Lv.${questStats.level}` : '';
          const nextLvXP = questStats ? (questStats.level + 1) * (questStats.level + 1) * 50 : 0;
          const curLvXP = questStats ? questStats.level * questStats.level * 50 : 0;
          const progress = questStats && nextLvXP > curLvXP ? (questStats.xp - curLvXP) / (nextLvXP - curLvXP) : 0;
          const remaining = questStats ? nextLvXP - questStats.xp : 0;
          return (
            <>
              <div className={styles.editorialDayRow}>
                <div className={styles.editorialDay}>{date.getDate()}</div>
                {lvLabel && <span className={styles.editorialLv}>{lvLabel}</span>}
              </div>
              <div className={styles.editorialMonth}>{MONTHS[date.getMonth()]} {date.getFullYear()}</div>
              <div className={styles.editorialProgressBar}>
                <div className={styles.editorialProgressFill} style={{ width: `${Math.min(progress * 100, 100)}%` }} />
              </div>
              {questStats && <div className={styles.editorialXpLabel}>{remaining} XP to Lv.{questStats.level + 1}</div>}
            </>
          );
        })()}
        {/* Agent Notes */}
        {noteEvents && noteEvents.length > 0 ? (
          <div className={styles.notesList}>
            {noteEvents.filter(note => {
              const noteDateStr = note.start.split('T')[0];
              const noteEndStr = note.end.split('T')[0];
              return noteDateStr === dateStr || (noteDateStr <= dateStr && noteEndStr >= dateStr);
            }).map(note => {
              // Parse "agent — content" format from title, or use description for agent
              let noteTitle = note.title;
              let rawAgent = note.description?.split('\n')[0].trim() || '';
              const dashMatch = note.title.match(/^(\w+)\s*[\u2014\u2013\-]+\s*(.+)/);
              if (dashMatch) {
                rawAgent = rawAgent || dashMatch[1];
                noteTitle = dashMatch[2];
              }
              const displayName = rawAgent || 'You';
              const noteColor = getNoteAgentColor(note.title, note.description) || 'var(--text)';
              return (
                <div key={note.id} className={styles.noteItem}
                  onClick={() => onEventClick(note)}>
                  <div className={styles.noteText} style={{ color: noteColor }}>{noteTitle}</div>
                  <div className={styles.noteAgent}>— {displayName}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={styles.noteEmpty}>{'No notes for today'}</div>
        )}
        {onCreateNote && (
          noteAdding ? (
            <form className={styles.noteInlineForm} onSubmit={e => {
              e.preventDefault();
              const val = noteInputRef.current?.value.trim();
              if (val && onCreateNote) { onCreateNote(val, date); }
              setNoteAdding(false);
            }}>
              <input ref={noteInputRef} className={styles.noteInlineInput} autoFocus
                placeholder="Add note..."
                onBlur={() => setNoteAdding(false)}
                onKeyDown={e => { if (e.key === 'Escape') setNoteAdding(false); }}
              />
            </form>
          ) : (
            <div className={styles.noteAddRow} onClick={() => setNoteAdding(true)}>+</div>
          )
        )}
      </div>
    </div>
  );
}
