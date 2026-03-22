'use client';

import styles from './BookTabs.module.css';

export type BookTab = 'calendar' | 'letters' | 'goals' | 'tasks';

interface BookTabsProps {
  activeTab: BookTab;
  onTabChange: (tab: BookTab) => void;
  unreadLetters: number;
}

const TABS: { id: BookTab; label: string }[] = [
  { id: 'calendar', label: 'Calendar' },
  { id: 'letters', label: 'Letters' },
  { id: 'goals', label: 'Log' },
];

export default function BookTabs({ activeTab, onTabChange, unreadLetters }: BookTabsProps) {
  return (
    <div className={styles.tabContainer}>
      {TABS.map(tab => (
        <button
          key={tab.id}
          className={activeTab === tab.id ? styles.tabActive : styles.tab}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.id === 'letters' && unreadLetters > 0 && activeTab !== 'letters' && (
            <span className={styles.unreadDot} />
          )}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
