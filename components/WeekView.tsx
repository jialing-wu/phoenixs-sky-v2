'use client';

import { useMemo, useRef, useCallback, useState, useEffect } from 'react';
import styles from './WeekView.module.css';
import { CalendarEvent, CALENDAR_META, formatTime, getConferenceLabel } from '@/lib/mockData';
import { layoutOverlapping } from '@/lib/layoutEvents';

interface WeekViewProps {
  weekStart: Date;
  events: CalendarEvent[];
  hiddenEvents?: Set<string>;
  colorOverrides?: Map<string, string>;
  taskLinks?: Map<string, string>;
  onToggleTask?: (eventId: string, done: boolean) => void;
  onEventClick: (event: CalendarEvent) => void;
  onSlotClick: (start: string, end: string) => void;
  onEventMove: (id: string, newStart: string, newEnd: string) => void;
  onEventResize: (id: string, newEnd: string, newStart?: string) => void;
  onContextMenu?: (event: CalendarEvent, x: number, y: number) => void;
  onDayClick?: (date: Date) => void;
  onNavigate?: (dir: -1 | 1) => void;
  showEditorial?: boolean;
  weekGoals?: { week: string; period: string; goals: Array<{area: string; text: string; priority: string}> };
  boards?: Array<{ id: string; name: string; emoji: string; color: string; goals_2026: Array<{ id: string; text: string; type: string; target_month?: string; done?: boolean; completed?: number }>; weekly_all?: Record<string, { goals: Array<string | { text: string; completed?: number }> }> }>;
  onGoalUpdate?: (boardId: string, goalId: string, field: string, value: unknown) => void;
  questStats?: { xp: number; level: number; streak: number; longestStreak: number; totalCompleted: number };
  featheredEvents?: Set<string>;
}

const TOTAL_HOURS = 24;
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Collapse 0–5am into one slot
const EARLY_END = 7;
const COLLAPSE_WEIGHT = 1; // 0-6am counts as 1 "hour" visually
const VISIBLE_HOURS = [0, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]; // hour 0 = collapsed 0-6am block

function minutesToIso(baseDate: Date, dayOffset: number, minutes: number): string {
  const d = new Date(baseDate);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

interface DayForecast { date: string; emoji: string; high: number; low: number }

function useWeather() {
  const [forecast, setForecast] = useState<Map<string, DayForecast>>(new Map());
  useEffect(() => {
    fetch('/api/weather')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.forecast) {
          const m = new Map<string, DayForecast>();
          for (const f of d.forecast) m.set(f.date, f);
          setForecast(m);
        }
      })
      .catch(() => {});
  }, []);
  return forecast;
}

export default function WeekView({ weekStart: weekStartProp, events, hiddenEvents, colorOverrides, taskLinks, onToggleTask, onEventClick, onSlotClick, onEventMove, onEventResize, onContextMenu, onDayClick, onNavigate, showEditorial, weekGoals, boards, onGoalUpdate, questStats, featheredEvents }: WeekViewProps) {
  const today = new Date();
  const forecast = useWeather();
  const localDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const todayStr = localDate(today);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [pxPerMin, setPxPerMin] = useState(1);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const weekStart = new Date(weekStartProp);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  // Calculate dynamic px per minute based on time grid container height
  // 0–5am collapsed into one slot; 6–23 get full space
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      setPxPerMin(Math.max(0.25, el.clientHeight / (TOTAL_HOURS * 60)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Total visual weight: 1 (collapsed 0-5) + 18 (hours 6-23)
  const totalWeight = COLLAPSE_WEIGHT + (TOTAL_HOURS - EARLY_END);
  const totalGridPx = pxPerMin * 60 * TOTAL_HOURS;
  const normalHourH = totalGridPx / totalWeight;
  const collapsedH = normalHourH * COLLAPSE_WEIGHT; // height for entire 0-5am block
  const normalPxPerMin = normalHourH / 60;
  const earlyPxPerMin = collapsedH / (EARLY_END * 60);

  /** Convert absolute minutes (0–1440) to pixel offset */
  function minToPx(minutes: number): number {
    const earlyMinutes = EARLY_END * 60;
    if (minutes <= earlyMinutes) {
      return minutes * earlyPxPerMin;
    }
    return collapsedH + (minutes - earlyMinutes) * normalPxPerMin;
  }

  /** Height for each visible row */
  function slotHeight(h: number): number {
    return h === 0 ? collapsedH : normalHourH;
  }

  const weekStartStr = localDate(weekStart);
  const weekEndStr = localDate(weekEnd);
  const weekEvents = useMemo(() =>
    events.filter(e => {
      if (e.allDay) {
        // All-day: compare date strings to avoid UTC/local timezone mismatch
        const sStr = e.start.split('T')[0];
        const eStr = e.end.split('T')[0];
        return sStr < weekEndStr && eStr > weekStartStr;
      }
      const s = new Date(e.start);
      const en = new Date(e.end);
      return s < weekEnd && en > weekStart;
    }),
    [events, weekStart.getTime(), weekEnd.getTime(), weekStartStr, weekEndStr]
  );

  // Separate all-day and timed events + cross-midnight
  const allDayEvents: (CalendarEvent & { startCol: number; endCol: number })[] = [];
  const timedByDay: CalendarEvent[][] = Array.from({ length: 7 }, () => []);

  for (const e of weekEvents) {
    if (e.allDay) {
      // Force local time parsing for date-only strings (avoid UTC midnight → wrong day in local tz)
      const sStr = e.start.split('T')[0];
      const enStr = e.end.split('T')[0];
      const s = new Date(sStr + 'T00:00:00');
      // Google Calendar all-day end date is exclusive — subtract 1 day for display
      const enExclusive = new Date(enStr + 'T00:00:00');
      enExclusive.setDate(enExclusive.getDate() - 1);
      const en = enExclusive < s ? s : enExclusive;
      const startCol = Math.max(0, Math.floor((s.getTime() - weekStart.getTime()) / 86400000));
      const endCol = Math.min(7, Math.floor((en.getTime() - weekStart.getTime()) / 86400000) + 1);
      allDayEvents.push({ ...e, startCol, endCol: Math.max(startCol + 1, endCol) });
    } else {
      const d = new Date(e.start);
      const dayIdx = d.getDay();
      timedByDay[dayIdx].push(e);

      // Cross-midnight: if end is on next LOCAL day, add virtual copy
      const endD = new Date(e.end);
      const startLocal = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const endLocal = `${endD.getFullYear()}-${endD.getMonth()}-${endD.getDate()}`;
      if (endLocal !== startLocal && endD.getHours() + endD.getMinutes() > 0) {
        const nextDayIdx = (dayIdx + 1) % 7;
        if (nextDayIdx < 7) {
          const nextDay = new Date(weekStart);
          nextDay.setDate(nextDay.getDate() + nextDayIdx);
          const virtualStart = new Date(nextDay);
          virtualStart.setHours(0, 0, 0, 0);
          timedByDay[nextDayIdx].push({
            ...e,
            id: `${e.id}__cont`,
            start: virtualStart.toISOString(),
          });
        }
      }
    }
  }

  // Filter out hidden all-day events before layout
  const visibleAllDay = allDayEvents.filter(e => !hiddenEvents?.has(e.id));

  // Sort all-day events by start column, then by span width (longest first) for optimal packing
  visibleAllDay.sort((a, b) => a.startCol - b.startCol || (b.endCol - b.startCol) - (a.endCol - a.startCol));

  // All-day row assignment
  const allDayRows: number[] = [];
  for (let i = 0; i < visibleAllDay.length; i++) {
    const span = visibleAllDay[i];
    let row = 0;
    const rowMaxEnd: number[] = [];
    for (let j = 0; j < i; j++) {
      const r = allDayRows[j];
      rowMaxEnd[r] = Math.max(rowMaxEnd[r] || 0, visibleAllDay[j].endCol);
    }
    while (rowMaxEnd[row] !== undefined && rowMaxEnd[row] > span.startCol) {
      row++;
    }
    allDayRows.push(row);
  }
  const maxAllDayRow = allDayRows.length > 0 ? Math.max(...allDayRows) + 1 : 0;
  const allDayHeight = Math.max(24, maxAllDayRow * 24);

  const nowMinutes = today.getHours() * 60 + today.getMinutes();
  const todayDayIdx = today.getDay();

  function getEventStyle(event: CalendarEvent): { top: number; height: number; startMin: number; endMin: number } {
    const start = new Date(event.start);
    const end = new Date(event.end);
    let startMin = start.getHours() * 60 + start.getMinutes();
    let endMin = end.getHours() * 60 + end.getMinutes();
    if (endMin <= startMin) endMin = TOTAL_HOURS * 60;
    return { top: minToPx(startMin), height: Math.max(minToPx(endMin) - minToPx(startMin), 15), startMin, endMin };
  }

  // ── Drag state ──
  const dragRef = useRef<{
    type: 'move' | 'resize' | 'resize-top';
    eventId: string;
    startY: number;
    origTop: number;
    origHeight: number;
    dayIdx: number;
    origDayIdx: number;
    startX: number;
    colWidth: number;
    hasMoved: boolean;
  } | null>(null);
  const [dragDelta, setDragDelta] = useState<{ dy: number; dx: number } | null>(null);
  const [dragEventId, setDragEventId] = useState<string | null>(null);
  const edgeNavTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseDown = useCallback((
    e: React.MouseEvent,
    type: 'move' | 'resize' | 'resize-top',
    event: CalendarEvent,
    dayIdx: number
  ) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const pos = getEventStyle(event);
    const col = (e.target as HTMLElement).closest('[data-dayidx]') as HTMLElement;
    const colWidth = col ? col.getBoundingClientRect().width : 100;
    dragRef.current = {
      type, eventId: event.id, startY: e.clientY,
      origTop: pos.top, origHeight: pos.height,
      dayIdx, origDayIdx: dayIdx, startX: e.clientX, colWidth, hasMoved: false,
    };
    setDragEventId(event.id);
    setDragDelta({ dy: 0, dx: 0 });

    const clearEdgeTimer = () => { if (edgeNavTimer.current) { clearTimeout(edgeNavTimer.current); edgeNavTimer.current = null; } };

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      dragRef.current.hasMoved = true;
      const dx = ev.clientX - dragRef.current.startX;
      setDragDelta({ dy: ev.clientY - dragRef.current.startY, dx });

      // Edge detection for week navigation
      if (onNavigate && dragRef.current.type === 'move') {
        const rawDayShift = Math.round(dx / dragRef.current.colWidth);
        const rawNewDayIdx = dragRef.current.origDayIdx + rawDayShift;
        if (rawNewDayIdx < 0) {
          if (!edgeNavTimer.current) {
            edgeNavTimer.current = setTimeout(() => {
              const evt = events.find(e => e.id === dragRef.current!.eventId);
              if (evt) {
                const dy = ev.clientY - dragRef.current!.startY;
                const snapPx = Math.round(dy / (normalPxPerMin * 15)) * (normalPxPerMin * 15);
                const snapMin = Math.round(snapPx / normalPxPerMin);
                const origStart = new Date(evt.start);
                const origStartMin = origStart.getHours() * 60 + origStart.getMinutes();
                const durationMin = (new Date(evt.end).getTime() - origStart.getTime()) / 60000;
                const newStartMin = Math.max(0, origStartMin + snapMin);
                // Place on Saturday (day 6) of previous week
                const prevWeek = new Date(weekStartProp); prevWeek.setDate(prevWeek.getDate() - 7);
                onEventMove(dragRef.current!.eventId, minutesToIso(prevWeek, 6, newStartMin), minutesToIso(prevWeek, 6, newStartMin + durationMin));
              }
              dragRef.current = null; setDragEventId(null); setDragDelta(null);
              window.removeEventListener('mousemove', onMouseMove);
              window.removeEventListener('mouseup', onMouseUp);
              onNavigate(-1);
            }, 500);
          }
        } else if (rawNewDayIdx > 6) {
          if (!edgeNavTimer.current) {
            edgeNavTimer.current = setTimeout(() => {
              const evt = events.find(e => e.id === dragRef.current!.eventId);
              if (evt) {
                const dy = ev.clientY - dragRef.current!.startY;
                const snapPx = Math.round(dy / (normalPxPerMin * 15)) * (normalPxPerMin * 15);
                const snapMin = Math.round(snapPx / normalPxPerMin);
                const origStart = new Date(evt.start);
                const origStartMin = origStart.getHours() * 60 + origStart.getMinutes();
                const durationMin = (new Date(evt.end).getTime() - origStart.getTime()) / 60000;
                const newStartMin = Math.max(0, origStartMin + snapMin);
                // Place on Sunday (day 0) of next week
                const nextWeek = new Date(weekStartProp); nextWeek.setDate(nextWeek.getDate() + 7);
                onEventMove(dragRef.current!.eventId, minutesToIso(nextWeek, 0, newStartMin), minutesToIso(nextWeek, 0, newStartMin + durationMin));
              }
              dragRef.current = null; setDragEventId(null); setDragDelta(null);
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
        const clickedEvent = events.find(e => e.id === dragRef.current!.eventId);
        dragRef.current = null;
        setDragEventId(null);
        setDragDelta(null);
        if (clickedEvent) onEventClick(clickedEvent);
        return;
      }

      const dy = ev.clientY - dragRef.current.startY;
      const dx = ev.clientX - dragRef.current.startX;
      // Use normalPxPerMin for drag snapping (most drags happen in normal hours)
      const snapPx = Math.round(dy / (normalPxPerMin * 15)) * (normalPxPerMin * 15);
      const snapMin = Math.round(snapPx / normalPxPerMin);
      const dayShift = Math.round(dx / dragRef.current.colWidth);

      if (dragRef.current.type === 'move') {
        const evt = events.find(e => e.id === dragRef.current!.eventId);
        if (evt) {
          const origStart = new Date(evt.start);
          const origEnd = new Date(evt.end);
          const origStartMin = origStart.getHours() * 60 + origStart.getMinutes();
          const durationMin = (origEnd.getTime() - origStart.getTime()) / 60000;
          const newStartMin = Math.max(0, origStartMin + snapMin);
          const newDayIdx = Math.max(0, Math.min(6, dragRef.current.origDayIdx + dayShift));
          onEventMove(dragRef.current.eventId, minutesToIso(weekStartProp, newDayIdx, newStartMin), minutesToIso(weekStartProp, newDayIdx, newStartMin + durationMin));
        }
      } else if (dragRef.current.type === 'resize-top') {
        const evt = events.find(e => e.id === dragRef.current!.eventId);
        if (evt) {
          const origStart = new Date(evt.start);
          const origEnd = new Date(evt.end);
          const origStartMin = origStart.getHours() * 60 + origStart.getMinutes();
          const origEndMin = origEnd.getHours() * 60 + origEnd.getMinutes();
          const newStartMin = Math.max(0, Math.min(origStartMin + snapMin, origEndMin - 15));
          onEventResize(dragRef.current.eventId, minutesToIso(weekStartProp, dragRef.current.dayIdx, origEndMin), minutesToIso(weekStartProp, dragRef.current.dayIdx, newStartMin));
        }
      } else {
        const evt = events.find(e => e.id === dragRef.current!.eventId);
        if (evt) {
          const origStart = new Date(evt.start);
          const origEnd = new Date(evt.end);
          const origStartMin = origStart.getHours() * 60 + origStart.getMinutes();
          const origEndMin = origEnd.getHours() * 60 + origEnd.getMinutes();
          const newEndMin = Math.max(origStartMin + 15, origEndMin + snapMin);
          onEventResize(dragRef.current.eventId, minutesToIso(weekStartProp, dragRef.current.dayIdx, newEndMin));
        }
      }

      dragRef.current = null;
      setDragEventId(null);
      setDragDelta(null);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [weekStartProp, events, onEventMove, onEventResize, onEventClick, onNavigate, pxPerMin]);

  // ── Slot drag-to-select ──
  const slotDragRef = useRef<{ dayIdx: number; startMin: number; currentMin: number } | null>(null);
  const [slotSelect, setSlotSelect] = useState<{ dayIdx: number; top: number; height: number } | null>(null);

  const handleSlotMouseDown = useCallback((e: React.MouseEvent, dayIdx: number) => {
    if (dragEventId) return;
    if ((e.target as HTMLElement).closest('[class*="event"]')) return;
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    // Invert minToPx to find minutes from pixel offset
    const earlyPxTotal = EARLY_END * 60 * earlyPxPerMin;
    let minutes: number;
    if (y <= earlyPxTotal) {
      minutes = Math.floor(y / earlyPxPerMin / 15) * 15;
    } else {
      minutes = Math.floor((EARLY_END * 60 + (y - earlyPxTotal) / normalPxPerMin) / 15) * 15;
    }
    slotDragRef.current = { dayIdx, startMin: minutes, currentMin: minutes };
    setSlotSelect({ dayIdx, top: minToPx(minutes), height: minToPx(minutes + 15) - minToPx(minutes) });

    const onMouseMove = (ev: MouseEvent) => {
      if (!slotDragRef.current) return;
      const my = ev.clientY - rect.top;
      const earlyPxTotal = EARLY_END * 60 * earlyPxPerMin;
      let curMin: number;
      if (my <= earlyPxTotal) {
        curMin = Math.floor(my / earlyPxPerMin / 15) * 15;
      } else {
        curMin = Math.floor((EARLY_END * 60 + (my - earlyPxTotal) / normalPxPerMin) / 15) * 15;
      }
      slotDragRef.current.currentMin = curMin;
      const topMin = Math.min(slotDragRef.current.startMin, curMin);
      const bottomMin = Math.max(slotDragRef.current.startMin, curMin) + 15;
      setSlotSelect({ dayIdx: slotDragRef.current.dayIdx, top: minToPx(topMin), height: minToPx(bottomMin) - minToPx(topMin) });
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      if (!slotDragRef.current) return;
      const topMin = Math.min(slotDragRef.current.startMin, slotDragRef.current.currentMin);
      const bottomMin = Math.max(slotDragRef.current.startMin, slotDragRef.current.currentMin) + 15;
      const finalHeight = bottomMin - topMin;
      const start = minutesToIso(weekStartProp, slotDragRef.current.dayIdx, topMin);
      const end = minutesToIso(weekStartProp, slotDragRef.current.dayIdx, topMin + Math.max(finalHeight, 60));
      slotDragRef.current = null;
      setSlotSelect(null);
      onSlotClick(start, end);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [weekStartProp, onSlotClick, dragEventId, pxPerMin]);

  // All-day drag (move) and resize (left/right handles)
  const allDayDragRef = useRef<{
    type: 'move' | 'resize-start' | 'resize-end';
    eventId: string; startX: number; colWidth: number; hasMoved: boolean;
  } | null>(null);
  const [allDayDragDelta, setAllDayDragDelta] = useState<number>(0);
  const [allDayDragId, setAllDayDragId] = useState<string | null>(null);

  const handleAllDayMouseDown = useCallback((e: React.MouseEvent, event: CalendarEvent, type: 'move' | 'resize-start' | 'resize-end' = 'move') => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const grid = (e.target as HTMLElement).closest('[class*="allDayGrid"]');
    const colWidth = grid ? grid.getBoundingClientRect().width / 7 : 100;
    allDayDragRef.current = { type, eventId: event.id, startX: e.clientX, colWidth, hasMoved: false };
    setAllDayDragId(event.id);
    setAllDayDragDelta(0);

    const onMouseMove = (ev: MouseEvent) => {
      if (!allDayDragRef.current) return;
      allDayDragRef.current.hasMoved = true;
      setAllDayDragDelta(ev.clientX - allDayDragRef.current.startX);
    };

    const onMouseUp = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      if (!allDayDragRef.current) return;
      if (!allDayDragRef.current.hasMoved) {
        const clicked = events.find(e => e.id === allDayDragRef.current!.eventId);
        allDayDragRef.current = null;
        setAllDayDragId(null);
        setAllDayDragDelta(0);
        if (clicked) onEventClick(clicked);
        return;
      }
      const dx = ev.clientX - allDayDragRef.current.startX;
      const dayShift = Math.round(dx / allDayDragRef.current.colWidth);
      const evt = events.find(e => e.id === allDayDragRef.current!.eventId);
      if (evt && dayShift !== 0) {
        const s = new Date(evt.start);
        const en = new Date(evt.end);
        const dragType = allDayDragRef.current.type;
        if (dragType === 'move') {
          s.setDate(s.getDate() + dayShift);
          en.setDate(en.getDate() + dayShift);
          onEventMove(evt.id, s.toISOString().split('T')[0], en.toISOString().split('T')[0]);
        } else if (dragType === 'resize-start') {
          s.setDate(s.getDate() + dayShift);
          if (s < en) onEventMove(evt.id, s.toISOString().split('T')[0], en.toISOString().split('T')[0]);
        } else {
          en.setDate(en.getDate() + dayShift);
          if (en > s) onEventResize(evt.id, en.toISOString().split('T')[0]);
        }
      }
      allDayDragRef.current = null;
      setAllDayDragId(null);
      setAllDayDragDelta(0);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [events, onEventClick, onEventMove, onEventResize]);

  return (
    <div className={`${styles.outerGrid} ${showEditorial ? styles.editorialMode : ''}`}>
    <div className={styles.wrapper} ref={wrapperRef}>
      {/* Fixed day headers */}
      <div className={styles.headerRow}>
        <div className={styles.timeCorner} />
        {DAY_NAMES.map((name, i) => {
          const d = new Date(weekStartProp);
          d.setDate(d.getDate() + i);
          const dateStr = localDate(d);
          const isToday = dateStr === todayStr;
          const clickDate = new Date(d);
          return (
            <div key={i} className={styles.dayHeader} onClick={() => onDayClick?.(clickDate)} style={{ cursor: onDayClick ? 'pointer' : undefined }}>
              <span className={styles.dayName}>{name}</span>
              <span className={isToday ? styles.dayNumberToday : styles.dayNumber}>{d.getDate()}</span>
              {(() => { const fw = forecast.get(dateStr); return fw ? <span className={styles.weatherBadge}>{fw.emoji} {fw.high}°</span> : null; })()}
            </div>
          );
        })}
      </div>

      {/* All-day event bar */}
      <div className={styles.allDayRow} style={{ height: `${allDayHeight}px` }}>
        <div className={styles.timeCorner} style={{ height: `${allDayHeight}px` }} />
        <div className={styles.allDayGrid}>
          {visibleAllDay.map((evt, i) => {
            const baseMeta = CALENDAR_META[evt.calendar];
            const overrideColor = colorOverrides?.get(evt.id);
            const meta = overrideColor ? { ...baseMeta, color: overrideColor } : baseMeta;
            const row = allDayRows[i];
            const isDragging = allDayDragId === evt.id;
            const dragType = isDragging ? allDayDragRef.current?.type : null;
            return (
              <div
                key={evt.id}
                className={styles.allDayEvent}
                style={{
                  gridColumn: `${evt.startCol + 1} / ${evt.endCol + 1}`,
                  gridRow: row + 1,
                  backgroundColor: `color-mix(in srgb, ${meta.color} 6%, var(--bg))`,
                  borderLeft: `4px solid ${meta.color}`,
                  color: meta.color,
                  transform: isDragging && dragType === 'move' ? `translateX(${allDayDragDelta}px)` : undefined,
                  opacity: isDragging ? 0.7 : 1,
                  paddingLeft: 10,
                  paddingRight: 10,
                }}
                onMouseDown={(e) => handleAllDayMouseDown(e, evt, 'move')}
                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu?.(evt, e.clientX, e.clientY); }}
                onTouchStart={(e) => {
                  const touch = e.touches[0];
                  longPressTimer.current = setTimeout(() => {
                    onContextMenu?.(evt, touch.clientX, touch.clientY);
                  }, 500);
                }}
                onTouchMove={() => {
                  if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
                }}
                onTouchEnd={() => {
                  if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
                }}
              >
                <div
                  className={styles.allDayResizeLeft}
                  onMouseDown={(e) => { e.stopPropagation(); handleAllDayMouseDown(e, evt, 'resize-start'); }}
                />
                {taskLinks?.has(evt.id) && (
                  <button className={styles.taskCheck} style={{ borderColor: meta.color, background: hiddenEvents?.has(evt.id) ? meta.color : 'transparent' }}
                    onClick={(e) => { e.stopPropagation(); onToggleTask?.(evt.id, !hiddenEvents?.has(evt.id)); }}
                    onMouseDown={(e) => e.stopPropagation()} />
                )}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{evt.title}</span>
                <div
                  className={styles.allDayResizeRight}
                  onMouseDown={(e) => { e.stopPropagation(); handleAllDayMouseDown(e, evt, 'resize-end'); }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Time grid */}
      <div className={styles.container} ref={gridRef}>
        <div className={styles.timeColumn}>
          {VISIBLE_HOURS.map(h => (
            <div key={h} className={styles.timeLabel} style={{ height: `${slotHeight(h)}px` }}>
              {h === 0 ? '' : `${String(h).padStart(2, '0')}:00`}
            </div>
          ))}
        </div>

        {Array.from({ length: 7 }, (_, dayIdx) => {
          const dayEvents = timedByDay[dayIdx];
          const colDate = new Date(weekStartProp);
          colDate.setDate(colDate.getDate() + dayIdx);
          const isColToday = localDate(colDate) === todayStr;
          const layout = layoutOverlapping(
            dayEvents
              .filter(e => !hiddenEvents?.has(e.id.replace(/__cont$/, '')))
              .map(e => {
                const pos = getEventStyle(e);
                return { id: e.id, startMin: pos.startMin, endMin: pos.endMin };
              })
          );
          return (
            <div
              key={dayIdx}
              className={`${styles.dayColumn} ${isColToday ? styles.dayColumnToday : ''}`}
              data-dayidx={dayIdx}
              onMouseDown={(e) => handleSlotMouseDown(e, dayIdx)}
            >
              {VISIBLE_HOURS.map(h => (
                <div key={h} className={styles.hourSlot} style={{ height: `${slotHeight(h)}px` }} />
              ))}

              {dayEvents.map(event => {
                const baseMeta = CALENDAR_META[event.calendar];
                const overrideColor = colorOverrides?.get(event.id.replace(/__cont$/, ''));
                const meta = overrideColor ? { ...baseMeta, color: overrideColor } : baseMeta;
                const pos = getEventStyle(event);
                const col = layout.get(event.id) || { col: 0, totalCols: 1 };
                const leftPct = (col.col / col.totalCols) * 100;
                const widthPct = (1 / col.totalCols) * 100;

                let style: React.CSSProperties = {
                  top: `${pos.top}px`,
                  height: `${pos.height}px`,
                  backgroundColor: `color-mix(in srgb, ${meta.color} 6%, var(--bg))`,
                  left: `${leftPct}%`,
                  width: `calc(${widthPct}% - 2px)`,
                  right: 'auto',
                };

                if (dragEventId === event.id && dragDelta && dragRef.current) {
                  const localPxPerMin = pos.startMin < EARLY_END * 60 ? earlyPxPerMin : normalPxPerMin;
                  const snap = Math.round(dragDelta.dy / (localPxPerMin * 15)) * (localPxPerMin * 15);
                  if (dragRef.current.type === 'move') {
                    const dayShift = Math.round(dragDelta.dx / dragRef.current.colWidth);
                    style = { ...style, top: `${pos.top + snap}px`, transform: `translateX(${dayShift * dragRef.current.colWidth}px)`, opacity: 0.8, zIndex: 20 };
                  } else if (dragRef.current.type === 'resize-top') {
                    style = { ...style, top: `${pos.top + snap}px`, height: `${Math.max(15, pos.height - snap)}px`, opacity: 0.8, zIndex: 20 };
                  } else {
                    style = { ...style, height: `${Math.max(15, pos.height + snap)}px`, opacity: 0.8, zIndex: 20 };
                  }
                }

                const hidden = hiddenEvents?.has(event.id.replace(/__cont$/, ''));
                const isTaskLinked = taskLinks?.has(event.id.replace(/__cont$/, ''));
                if (hidden && !isTaskLinked) {
                  style.opacity = 0.15;
                  style.pointerEvents = 'auto';
                }

                const isFeathered = featheredEvents?.has(event.id.replace(/__cont$/, ''));

                return (
                  <div key={event.id} className={`${styles.event} ${isFeathered ? styles.eventFeathered : ''}`} style={style}
                    onMouseDown={(e) => handleMouseDown(e, 'move', event, dayIdx)}
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
                      onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, 'resize-top', event, dayIdx); }} />
                    <div className={styles.eventBar} style={{ backgroundColor: meta.color }} />
                    {(() => {
                      const LINE_H = 14.5; // title line: 0.72rem * 1.2
                      const TIME_H = 14;   // time row height
                      const PAD = 4;
                      const contentH = pos.height - PAD;
                      const totalLines = Math.floor(contentH / LINE_H);
                      const showTime = totalLines >= 2;
                      const titleLines = showTime ? Math.max(1, totalLines - 1) : Math.max(1, totalLines);
                      return (
                        <>
                          <div className={styles.eventTitleRow}>
                            {isTaskLinked && (
                              <button className={styles.taskCheck} style={{ borderColor: meta.color, background: hidden ? meta.color : 'transparent' }}
                                onClick={(e) => { e.stopPropagation(); onToggleTask?.(event.id.replace(/__cont$/, ''), !hidden); }}
                                onMouseDown={(e) => e.stopPropagation()} />
                            )}
                            <div className={`${styles.eventTitle} ${hidden ? styles.eventTitleDone : ''}`} style={{
                              color: meta.color,
                              WebkitLineClamp: titleLines,
                              maxHeight: `${titleLines * LINE_H}px`,
                            }}>{event.title}</div>
                          </div>
                          {showTime && (
                            <div className={styles.eventTime}>
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
                            </div>
                          )}
                        </>
                      );
                    })()}
                    <div className={styles.resizeHandle}
                      onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, 'resize', event, dayIdx); }} />
                  </div>
                );
              })}

              {slotSelect && slotSelect.dayIdx === dayIdx && (
                <div className={styles.slotHighlight} style={{ top: `${slotSelect.top}px`, height: `${slotSelect.height}px` }} />
              )}

              {(() => {
                const d = new Date(weekStartProp);
                d.setDate(d.getDate() + dayIdx);
                return d.toISOString().split('T')[0] === todayStr;
              })() && (
                <div className={styles.nowLine} style={{ top: `${minToPx(nowMinutes)}px` }}>
                  <div className={styles.nowDot} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
    <div className={styles.editorial}>
      {(() => {
        const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        // ISO week number
        const thu = new Date(weekStart);
        thu.setDate(thu.getDate() + 3 - ((thu.getDay() + 6) % 7));
        const yearStart = new Date(thu.getFullYear(), 0, 1);
        const weekNum = Math.ceil(((thu.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
        const sat = new Date(weekStart);
        sat.setDate(sat.getDate() + 6);
        const monthLabel = weekStart.getMonth() === sat.getMonth()
          ? MONTHS[weekStart.getMonth()]
          : `${MONTHS[weekStart.getMonth()]} \u2013 ${MONTHS[sat.getMonth()]}`;
        const lvLabel = questStats ? `Lv.${questStats.level}` : '';
        const nextLvXP = questStats ? (questStats.level + 1) * (questStats.level + 1) * 50 : 0;
        const curLvXP = questStats ? questStats.level * questStats.level * 50 : 0;
        const progress = questStats && nextLvXP > curLvXP ? (questStats.xp - curLvXP) / (nextLvXP - curLvXP) : 0;
        return (
          <>
            <div className={styles.editorialLabel}>Week</div>
            <div className={styles.editorialBigRow}>
              <span className={styles.editorialBig} style={{ color: 'var(--accent)' }}>{weekNum}</span>
              {lvLabel && <span className={styles.editorialLv}>{lvLabel}</span>}
            </div>
            <div className={styles.editorialSub}>{monthLabel} {sat.getFullYear()}</div>
            <div className={styles.editorialProgressBar}>
              <div className={styles.editorialProgressFill} style={{ width: `${Math.min(progress * 100, 100)}%` }} />
            </div>
            {questStats && <div className={styles.editorialXpLabel}>{nextLvXP - questStats.xp} XP to Lv.{questStats.level + 1}</div>}
          </>
        );
      })()}
      {/* Week Goals from weekly_all */}
      {boards && (() => {
        const weekKey = (() => {
          const d = new Date(weekStart);
          d.setDate(d.getDate() + 3); // Thursday for ISO week
          const year = d.getFullYear();
          const jan1 = new Date(year, 0, 1);
          const weekNum = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
          return `${year}-W${String(weekNum).padStart(2, '0')}`;
        })();
        const allWeekGoals = boards.flatMap(b => {
          const goals = b.weekly_all?.[weekKey]?.goals || [];
          return goals.map((raw, i) => {
            const g = typeof raw === 'string' ? { text: raw, completed: 0 } : { text: raw.text, completed: raw.completed ?? 0 };
            return { ...g, boardId: b.id, board: b.name, emoji: b.emoji, color: b.color, idx: i };
          });
        });
        if (allWeekGoals.length === 0) return null;
        return (
          <div className={styles.goalsSection}>
            <div className={styles.goalsSectionLabel}>Weekly Goals</div>
            <div className={styles.goalsList}>
              {allWeekGoals.map((g, i) => (
                <div key={`wg-${i}`} className={styles.goalItem} style={{ borderLeftColor: g.color, flexDirection: 'row', alignItems: 'center', gap: '0.3rem' }}>
                  <span className={`${styles.goalText} ${g.completed >= 100 ? styles.goalDone : ''}`}>{g.text}</span>
                  <span className={styles.pctBadge}>{g.completed}%</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
    </div>
  );
}

function GoalWithProgress({ goal, pct, onGoalUpdate }: {
  goal: { id: string; boardId: string; board: string; emoji: string; color: string; text: string; done?: boolean };
  pct: number;
  onGoalUpdate?: (boardId: string, goalId: string, field: string, value: unknown) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(pct));

  return (
    <div className={styles.goalItem} style={{ borderLeftColor: goal.color }}>
      <div className={styles.goalTop}>
        <span className={styles.goalDot} style={{ background: goal.color }} />
        <span className={styles.goalArea}>{goal.emoji}</span>
        <span className={`${styles.goalText} ${pct >= 100 ? styles.goalDone : ''}`}>{goal.text}</span>
        {editing ? (
          <input
            className={styles.pctInput}
            type="number" min="0" max="100"
            value={val}
            onChange={e => setVal(e.target.value)}
            onBlur={() => {
              const n = Math.max(0, Math.min(100, parseInt(val) || 0));
              onGoalUpdate?.(goal.boardId, goal.id, 'completed', n);
              if (n >= 100) onGoalUpdate?.(goal.boardId, goal.id, 'done', true);
              else onGoalUpdate?.(goal.boardId, goal.id, 'done', false);
              setEditing(false);
            }}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            autoFocus
          />
        ) : (
          <span className={styles.pctBadge} onClick={() => setEditing(true)}>{pct}%</span>
        )}
      </div>
      <div className={styles.goalProgressBar}>
        <div className={styles.goalProgressFill} style={{ width: `${pct}%`, background: goal.color }} />
      </div>
    </div>
  );
}
