'use client';

import { useEffect, useState } from 'react';
import styles from './Header.module.css';
import { CALENDARS, CalendarSource } from '@/lib/calendarConfig';

interface WeatherData {
  emoji: string;
  temp: string;
}

function useWeather() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  useEffect(() => {
    fetch('/api/weather')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && !d.error) setWeather({ emoji: d.emoji, temp: d.temp }); })
      .catch(() => {});
  }, []);
  return weather;
}

export type ViewMode = 'day' | 'week' | 'month' | 'goals';

const TOGGLEABLE_CALENDARS: { key: CalendarSource; label: string }[] = [
  { key: 'sky', label: 'Sky' },
];

interface HeaderProps {
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
  currentDate: Date;
  onNavigate: (dir: -1 | 0 | 1) => void;
  onRefresh?: () => void;
  loading?: boolean;
  hiddenCalendars?: Set<string>;
  onToggleCalendar?: (cal: string) => void;
  showEditorial?: boolean;
  onToggleEditorial?: () => void;
}

function formatDateRange(date: Date, view: ViewMode): string {
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  if (view === 'day') {
    return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  }

  if (view === 'week') {
    const sun = new Date(date);
    sun.setDate(date.getDate() - date.getDay());
    const sat = new Date(sun);
    sat.setDate(sun.getDate() + 6);
    if (sun.getMonth() === sat.getMonth()) {
      return `${months[sun.getMonth()]} ${sun.getDate()}\u2013${sat.getDate()}, ${sun.getFullYear()}`;
    }
    return `${months[sun.getMonth()]} ${sun.getDate()} \u2013 ${months[sat.getMonth()]} ${sat.getDate()}, ${sat.getFullYear()}`;
  }

  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

function formatDateShort(date: Date, view: ViewMode): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (view === 'day') {
    return `${months[date.getMonth()]} ${date.getDate()} · ${days[date.getDay()]}`;
  }

  if (view === 'week') {
    const sun = new Date(date);
    sun.setDate(date.getDate() - date.getDay());
    const sat = new Date(sun);
    sat.setDate(sun.getDate() + 6);
    if (sun.getMonth() === sat.getMonth()) {
      return `${months[sun.getMonth()]} ${sun.getDate()}\u2013${sat.getDate()}`;
    }
    return `${months[sun.getMonth()]} ${sun.getDate()} \u2013 ${months[sat.getMonth()]} ${sat.getDate()}`;
  }

  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

export default function Header({ view, onViewChange, currentDate, onNavigate, onRefresh, loading, hiddenCalendars, onToggleCalendar, showEditorial, onToggleEditorial }: HeaderProps) {
  const views: ViewMode[] = ['day', 'week', 'month'];
  const weather = useWeather();

  return (
    <>
      <div className={styles.topLine} />
      <header className={styles.header}>
        {/* Desktop layout */}
        <h1 className={styles.brand}>
          {formatDateRange(currentDate, view)}
        </h1>

        <nav className={styles.nav}>
          {onToggleCalendar && TOGGLEABLE_CALENDARS.map(({ key }) => {
            const active = !hiddenCalendars?.has(key);
            return (
              <button
                key={key}
                className={styles.calToggle}
                onClick={() => onToggleCalendar(key)}
                style={{ opacity: active ? 0.85 : 0.6 }}
              >
                {active ? <><span style={{ color: 'var(--accent)' }}>Sky</span> Life</> : <><span style={{ color: 'var(--accent)' }}>Land</span></>}
              </button>
            );
          })}
          <span className={styles.navDivider} />
          <button className={styles.navItem} onClick={() => onNavigate(0)} style={{ opacity: 1 }}>🐦‍🔥</button>
          {views.map(v => (
            <button
              key={v}
              className={v === view ? styles.navItemActive : styles.navItem}
              onClick={() => onViewChange(v)}
            >
              {v}
            </button>
          ))}
        </nav>

        {/* Mobile layout: row 1 = date, row 2 = tabs + arrows | toggles */}
        <div className={styles.mobileRow1}>
          <h1 className={styles.mobileBrand} onClick={() => onNavigate(0)} style={{ cursor: 'pointer' }}>
            {formatDateShort(currentDate, view)}
          </h1>
          <div className={styles.mobileViewTabs}>
            {(['day', 'week', 'month'] as const).map(v => (
              <button
                key={v}
                className={v === view ? styles.mobileViewTabActive : styles.mobileViewTab}
                onClick={() => onViewChange(v)}
              >
                {{ day: 'D', week: 'W', month: 'M' }[v]}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.mobileRow2}>
          <div className={styles.mobileLeft}>
            {views.map(v => (
              <button
                key={v}
                className={v === view ? styles.mobileTabActive : styles.mobileTab}
                onClick={() => onViewChange(v)}
              >
                {v}
              </button>
            ))}
            <button className={styles.arrowMobile} onClick={() => onNavigate(-1)}>&#8249;</button>
            <button className={styles.arrowMobile} onClick={() => onNavigate(1)}>&#8250;</button>
          </div>
          <div className={styles.mobileRight}>
            <button className={styles.todayBtnMobile} onClick={() => onNavigate(0)}>Now</button>
            {onToggleCalendar && TOGGLEABLE_CALENDARS.map(({ key }) => {
              const active = !hiddenCalendars?.has(key);
              return (
                <button
                  key={key}
                  className={styles.calToggleMobile}
                  onClick={() => onToggleCalendar(key)}
                  style={{ opacity: active ? 0.85 : 0.6 }}
                >
                  {active ? <span style={{ color: 'var(--accent)' }}>Sky</span> : <span style={{ color: 'var(--accent)' }}>Land</span>}
                </button>
              );
            })}
            {onToggleEditorial && (
              <button
                className={showEditorial ? styles.editorialToggleActive : styles.editorialToggle}
                onClick={onToggleEditorial}
              >
                {showEditorial ? 'Cal' : 'Detail'}
              </button>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
