'use client';

import { useMemo, useState } from 'react';
import styles from './Sidebar.module.css';
import { CalendarEvent, TodoItem, NotionEntry, CALENDAR_META, formatTime, getConferenceLabel } from '@/lib/mockData';
import { CALENDARS, CalendarSource } from '@/lib/calendarConfig';

function stripEmoji(text: string): string {
  return text.replace(/[\uD83C-\uDBFF][\uDC00-\uDFFF]|\u200D|[\u2600-\u27BF]|[\uFE00-\uFE0F]/g, '').trim();
}

type TodoRange = 'today' | 'tomorrow' | 'week' | 'month';

interface SidebarProps {
  currentDate: Date;
  events: CalendarEvent[];
  todos: TodoItem[];
  notionEntries: NotionEntry[];
  todoRange: TodoRange;
  onTodoRangeChange: (range: TodoRange) => void;
  onTodoRefresh: () => Promise<void> | void;
  onTodoToggle: (id: string, done: boolean) => void;
  onTodoDelete: (id: string) => void;
  onTodoReschedule?: (id: string, date: string) => void;
  onTodoCreate: (content: string, dueDate?: string) => Promise<void>;
  onNotionRefresh: () => Promise<void> | void;
  hiddenEvents?: Set<string>;
  onToggleHide?: (id: string) => void;
  taskLinks?: Map<string, string>;
  onToggleTask?: (eventId: string, done: boolean) => void;
  hiddenCalendars?: Set<string>;
  onToggleCalendar?: (cal: string) => void;
  onQuickAddToCalendar?: (title: string) => void;
}

const RANGE_LABELS: Record<TodoRange, string> = {
  today: 'Today',
  tomorrow: '+1',
  week: 'Week',
  month: 'Month',
};

function filterTodos(todos: TodoItem[], range: TodoRange): TodoItem[] {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  return todos.filter(t => {
    if (!t.due) return false; // no-date tasks hidden from all views
    const dueDate = t.due.split('T')[0];

    if (range === 'today') {
      return dueDate <= todayStr; // overdue + today
    }

    const tomorrowDate = new Date(todayStr);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowStr = tomorrowDate.toISOString().split('T')[0];

    if (range === 'tomorrow') {
      return dueDate === tomorrowStr;
    }

    // week/month: only future tasks (exclude today and overdue)
    const dueMs = new Date(dueDate).getTime();
    const tomorrowMs = tomorrowDate.getTime();
    const daysDiff = (dueMs - tomorrowMs) / 86400000;

    if (dueDate <= todayStr) return false; // exclude today/overdue
    if (range === 'week') return daysDiff < 7;
    return daysDiff < 30; // month
  });
}

interface TodoTree {
  todo: TodoItem;
  children: TodoItem[];
}

function buildTodoTree(todos: TodoItem[]): TodoTree[] {
  const parentMap = new Map<string, TodoItem[]>();
  const roots: TodoItem[] = [];

  for (const t of todos) {
    if (t.parentId) {
      const children = parentMap.get(t.parentId) || [];
      children.push(t);
      parentMap.set(t.parentId, children);
    } else {
      roots.push(t);
    }
  }

  return roots.map(r => ({
    todo: r,
    children: parentMap.get(r.id) || [],
  }));
}

function TodoItemRow({ todo, onToggle, onDelete, onReschedule }: { todo: TodoItem; onToggle: (id: string, done: boolean) => void; onDelete: (id: string) => void; onReschedule?: (id: string, date: string) => void }) {
  const [showPostpone, setShowPostpone] = useState(false);

  const getDateStr = (daysFromNow: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    return d.toISOString().split('T')[0];
  };

  const options = [
    { label: 'Tomorrow', date: getDateStr(1) },
    { label: '+2', date: getDateStr(2) },
    { label: 'Next Mon', date: (() => { const d = new Date(); const day = d.getDay(); d.setDate(d.getDate() + (8 - day) % 7 + 1); return d.toISOString().split('T')[0]; })() },
  ];

  return (
    <div className={styles.todoItem}>
      <button
        className={todo.done ? styles.todoCheckDone : styles.todoCheck}
        onClick={() => onToggle(todo.id, !todo.done)}
        title={todo.done ? 'Mark incomplete' : 'Mark complete'}
        style={{
          color: '#3A2A1A',
          borderColor: todo.done ? 'rgba(58,42,26,0.4)' : 'rgba(58,42,26,0.25)',
          background: todo.done ? 'rgba(58,42,26,0.15)' : 'rgba(255,255,255,0.3)',
          fontSize: '0.65rem',
          fontFamily: 'var(--font-data)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {todo.done ? '✓' : '○'}
      </button>
      <div className={styles.todoContent}>
        <div className={todo.done ? styles.todoDone : styles.todoTitle}>
          {stripEmoji(todo.title)}
        </div>
        {todo.due && <div className={styles.todoDue}>{todo.due}</div>}
      </div>
      <div className={styles.todoActions}>
        {onReschedule && (
          <div style={{ position: 'relative' }}>
            <button className={styles.todoPostponeBtn} onClick={() => setShowPostpone(v => !v)} title="Postpone">↷</button>
            {showPostpone && (
              <div className={styles.postponeMenu}>
                {options.map(opt => (
                  <button key={opt.label} className={styles.postponeMenuBtn} onClick={() => { onReschedule(todo.id, opt.date); setShowPostpone(false); }}>
                    {opt.label} <span style={{ opacity: 0.4, fontSize: '0.65rem' }}>{opt.date}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <button className={styles.todoDeleteBtn} onClick={() => onDelete(todo.id)} title="Delete task">×</button>
      </div>
    </div>
  );
}

function CollapsibleTodo({ tree, onToggle, onDelete, onReschedule }: { tree: TodoTree; onToggle: (id: string, done: boolean) => void; onDelete: (id: string) => void; onReschedule?: (id: string, date: string) => void }) {
  const [open, setOpen] = useState(false);
  const hasChildren = tree.children.length > 0;

  return (
    <div>
      <div className={styles.todoParentRow}>
        <div style={{ flex: 1 }}>
          <TodoItemRow todo={tree.todo} onToggle={onToggle} onDelete={onDelete} onReschedule={onReschedule} />
        </div>
        {hasChildren && (
          <button className={styles.expandBtn} onClick={() => setOpen(!open)}>
            {open ? '▾' : '▸'} {tree.children.length}
          </button>
        )}
      </div>
      {hasChildren && open && (
        <div className={styles.todoChildren}>
          {tree.children.map(child => (
            <TodoItemRow key={child.id} todo={child} onToggle={onToggle} onDelete={onDelete} onReschedule={onReschedule} />
          ))}
        </div>
      )}
    </div>
  );
}

const TOGGLEABLE_CALENDARS: { key: CalendarSource; label: string }[] = [
  { key: 'isekai', label: 'Isekai' },
];

export default function Sidebar({ currentDate, events, todos, notionEntries, todoRange, onTodoRangeChange, onTodoRefresh, onTodoToggle, onTodoDelete, onTodoReschedule, onTodoCreate, onNotionRefresh, hiddenEvents, onToggleHide, taskLinks, onToggleTask, hiddenCalendars, onToggleCalendar, onQuickAddToCalendar }: SidebarProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [notionRefreshing, setNotionRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const handleRefresh = async () => {
    setRefreshing(true);
    try { await onTodoRefresh(); } finally { setRefreshing(false); }
  };
  const handleNotionRefresh = async () => {
    setNotionRefreshing(true);
    try { await onNotionRefresh(); } finally { setNotionRefreshing(false); }
  };
  const handleCreate = async () => {
    if (!newTaskTitle.trim()) return;
    await onTodoCreate(newTaskTitle.trim());
    setNewTaskTitle('');
    setCreating(false);
  };
  const filteredTodos = useMemo(() => {
    // Filter all non-child tasks by date range (parents and standalone alike)
    const filtered = filterTodos(todos, todoRange).filter(t => !t.parentId);
    const filteredIds = new Set(filtered.map(t => t.id));
    // For each parent in the list, pull in ALL its children
    for (const t of todos) {
      if (t.parentId && filteredIds.has(t.parentId) && !filteredIds.has(t.id)) {
        filtered.push(t);
        filteredIds.add(t.id);
      }
    }
    return filtered.sort((a, b) => {
      if (!a.due && !b.due) return 0;
      if (!a.due) return 1;
      if (!b.due) return -1;
      return a.due.localeCompare(b.due);
    });
  }, [todos, todoRange]);
  const todoTree = useMemo(() => buildTodoTree(filteredTodos), [filteredTodos]);

  return (
    <aside className={styles.sidebar}>
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Notion</h2>
        {notionEntries.length === 0 ? (
          <p className={styles.emptyNote}>No entries.</p>
        ) : (
          [...notionEntries].map(entry => {
            return (
              <div key={entry.id} className={styles.notionItem}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className={styles.notionTitle}>{stripEmoji(entry.title)}</div>
                    <div className={styles.notionMeta}>
                      {entry.status}
                      {entry.deadline && ` \u00B7 ${entry.deadline}`}
                      {` \u00B7 ${entry.database}`}
                    </div>
                  </div>
                  {onQuickAddToCalendar && (
                    <button className={styles.quickAddBtn} onClick={(e) => { e.stopPropagation(); onQuickAddToCalendar(entry.title); }} title="Add to calendar">+</button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

    </aside>
  );
}
