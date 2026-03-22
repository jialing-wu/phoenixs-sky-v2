'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import styles from './ContextMenu.module.css';
import { CalendarEvent, formatTime, getConferenceLabel, CALENDAR_META } from '@/lib/mockData';

const COLOR_PALETTE = [
  ...Array.from(new Set(Object.values(CALENDAR_META).map(m => m.color))),
  '#A0A0A0',
];

interface ContextMenuProps {
  event: CalendarEvent;
  position: { x: number; y: number };
  isHidden: boolean;
  currentColor?: string;
  onClose: () => void;
  onToggleHide: (id: string) => void;
  onColorChange: (id: string, color: string | null) => void;
  onAddTodo?: (content: string, dueDate?: string) => void;
  onAddToIsekai?: (event: CalendarEvent) => void;
  onDelete?: (id: string) => void;
  onDuplicate?: (event: CalendarEvent) => void;
  onRemoveTask?: (eventId: string) => void;
  isTaskLinked?: boolean;
  isFeathered?: boolean;
  onToggleFeather?: (id: string) => void;
}

export default function ContextMenu({ event, position, isHidden, currentColor, onClose, onToggleHide, onColorChange, onAddTodo, onAddToIsekai, onDelete, onDuplicate, onRemoveTask, isTaskLinked, isFeathered, onToggleFeather }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      el.style.left = `${position.x - rect.width}px`;
    }
    if (rect.bottom > window.innerHeight) {
      el.style.top = `${position.y - rect.height}px`;
    }
  }, [position]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        e.stopPropagation();
        e.preventDefault();
        onClose();
      }
    };
    const handleTouch = (e: TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    window.addEventListener('mousedown', handleClick, true);
    window.addEventListener('touchstart', handleTouch, true);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('mousedown', handleClick, true);
      window.removeEventListener('touchstart', handleTouch, true);
    };
  }, [onClose]);

  const [copied, setCopied] = useState(false);
  const copy = useCallback(async (text: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for non-secure contexts or older browsers
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => onClose(), 600);
    } catch (err) {
      console.error('Copy failed:', err);
      onClose();
    }
  }, [onClose]);

  const confUrl = event.conferenceUrl || (event.location && /^https?:\/\//.test(event.location) ? event.location : null);

  const buildSummary = () => {
    const parts = [event.title];
    if (!event.allDay) {
      parts.push(`${formatTime(event.start)} – ${formatTime(event.end)}`);
    }
    if (event.location && !/^https?:\/\//.test(event.location)) {
      parts.push(event.location);
    }
    if (confUrl) {
      parts.push(confUrl);
    }
    return parts.join('\n');
  };

  const defaultColor = CALENDAR_META[event.calendar]?.color;

  return (
    <div ref={ref} className={styles.menu} style={{ left: position.x, top: position.y }}>
      <button className={styles.item} onClick={() => { onToggleHide(event.id); onClose(); }}>
        {isHidden ? 'Show' : 'Hide'}
      </button>
      {onAddTodo && !isTaskLinked && (
        <button className={styles.item} onClick={() => {
          const dueDate = event.start.split('T')[0];
          onAddTodo(event.title, dueDate);
          onClose();
        }}>
          Add to Tasks
        </button>
      )}
      {isTaskLinked && onRemoveTask && (
        <button className={styles.item} onClick={() => {
          onRemoveTask(event.id);
          onClose();
        }}>
          Remove from Tasks
        </button>
      )}
      {onToggleFeather && (
        <button className={`${styles.item} ${isFeathered ? styles.featherActive : ''}`} onClick={() => { onToggleFeather(event.id); onClose(); }}>
          🪶 {isFeathered ? 'Remove Feather' : 'Add Feather'}
        </button>
      )}
      {onAddToIsekai && event.calendar !== 'sky' && (
        <button className={styles.item} onClick={() => { onAddToIsekai(event); onClose(); }} style={{ color: '#B8860B' }}>
          Add to Sky Life
        </button>
      )}
      <div className={styles.divider} />
      <div className={styles.colorRow}>
        {COLOR_PALETTE.map(color => (
          <button
            key={color}
            className={styles.colorSwatch}
            style={{
              backgroundColor: color,
              outline: (currentColor || defaultColor) === color ? '2px solid var(--text)' : 'none',
              outlineOffset: '1px',
            }}
            onClick={() => {
              onColorChange(event.id, color === defaultColor ? null : color);
              onClose();
            }}
          />
        ))}
      </div>
      <div className={styles.divider} />
      {onDuplicate && (
        <button className={styles.item} onClick={() => { onDuplicate(event); onClose(); }}>
          Duplicate
        </button>
      )}
      <button className={styles.item} onClick={() => copy(buildSummary())}>
        {copied ? 'Copied!' : 'Copy Text'}
      </button>
      {onDelete && (
        <button className={`${styles.item} ${styles.deleteItem}`} onClick={() => { onDelete(event.id); onClose(); }}>
          Delete
        </button>
      )}
    </div>
  );
}
