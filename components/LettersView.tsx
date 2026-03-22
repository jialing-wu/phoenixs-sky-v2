'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import styles from './LettersView.module.css';
import { AGENTS, AGENT_IDS, getAgent, AgentId } from '@/lib/agentConfig';

interface LetterItem {
  id: string;
  text: string;
  status: 'pending' | 'accepted' | 'modified' | 'ignored';
  assignedAgent?: string;
  userNote?: string;
}

interface Letter {
  id: string;
  sender: string;
  title: string;
  content: string;
  items?: LetterItem[];
  timestamp: string;
  read: boolean;
  replyStatus?: 'accepted' | 'ignored';
}

function getSenderEmoji(sender: string): string {
  const agent = getAgent(sender);
  return agent.emoji;
}

function getSenderColor(sender: string): string {
  const agent = getAgent(sender);
  return agent.color;
}

function getSenderLabel(sender: string): string {
  const agent = getAgent(sender);
  return agent.name;
}

function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay === 1) return 'yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;

  const d = new Date(timestamp);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// Simple markdown to HTML for letter content
function simpleMarkdown(text: string): string {
  if (!text) return '';
  return text
    // Escape HTML
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // Code blocks (```...```)
    .replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code style="background:var(--bg-muted,#f0f0f0);padding:1px 4px;border-radius:3px;font-size:0.9em">$1</code>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Strikethrough
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    // Highlight times, amounts, brackets
    .replace(/(\d{1,2}:\d{2}(?:\s*[ap]m)?)/gi, '<span style="color:var(--accent);font-weight:600">$1</span>')
    .replace(/(\$[\d,.]+|¥[\d,.]+|\d+(?:\.\d+)?%)/g, '<span style="color:var(--accent);font-weight:600">$1</span>')
    // List items (• or - at start of line)
    .replace(/^[•\-]\s+(.*)$/gm, '<li style="margin-left:1em;list-style:disc">$1</li>')
    // Line breaks
    .replace(/\n/g, '<br/>');
}

// All agents for assignment menu
const ASSIGNABLE_AGENTS = AGENT_IDS.map(id => ({
  key: id,
  emoji: AGENTS[id].emoji,
  label: AGENTS[id].name,
}));

interface ContextMenuState {
  letterId: string;
  itemId: string;
  x: number;
  y: number;
}

function ItemContextMenu({ letterId, itemId, x, y, onAssign, onClose }: ContextMenuState & {
  onAssign: (letterId: string, itemId: string, agent: string, note: string) => void;
  onClose: () => void;
}) {
  const [note, setNote] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  // Adjust position so it doesn't go off-screen
  const style: React.CSSProperties = {
    left: Math.min(x, window.innerWidth - 220),
    top: Math.min(y, window.innerHeight - 300),
  };

  return (
    <div className={styles.itemContextMenu} style={style} ref={ref}>
      <input
        className={styles.noteInput}
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="Note..."
        onKeyDown={e => e.key === 'Enter' && e.stopPropagation()}
      />
      <div className={styles.agentGrid}>
        {ASSIGNABLE_AGENTS.map(a => (
          <button
            key={a.key}
            className={styles.agentGridBtn}
            onClick={() => { onAssign(letterId, itemId, a.key, note); onClose(); }}
            title={a.label}
          >
            {a.emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

function LetterCard({ letter, onMarkRead, onUpdateItem, onReply }: {
  letter: Letter;
  onMarkRead: (id: string) => void;
  onUpdateItem: (letterId: string, itemId: string, agent: string, note: string) => void;
  onReply: (id: string, status: 'accepted' | 'ignored') => void;
}) {
  const [expanded, setExpanded] = useState(!letter.read);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const color = getSenderColor(letter.sender);

  const handleExpand = () => {
    const opening = !expanded;
    setExpanded(opening);
    if (opening && !letter.read) {
      onMarkRead(letter.id);
    }
  };

  const handleItemContextMenu = (e: React.MouseEvent, itemId: string) => {
    e.preventDefault();
    setContextMenu({ letterId: letter.id, itemId, x: e.clientX, y: e.clientY });
  };

  return (
    <div className={`${!letter.read ? styles.letterCardUnread : styles.letterCard} ${expanded ? styles.letterCardOpen : ''}`}>
      <div className={!letter.read ? styles.scrollRodUnread : styles.scrollRod} />
      <div className={styles.letterHeader} onClick={handleExpand}>
        <div
          className={styles.avatar}
          style={{ color, borderColor: `${color}30`, background: `${color}08` }}
        >
          {getSenderEmoji(letter.sender)}
        </div>
        <div className={styles.letterInfo}>
          <span className={!letter.read ? styles.letterTitleUnread : styles.letterTitle}>
            {letter.title} · {formatRelativeTime(letter.timestamp)}
          </span>
        </div>
        {!letter.read && <div className={styles.unreadIndicator} />}
        {!letter.replyStatus ? (
          <button className={styles.ignoreBtn} onClick={e => { e.stopPropagation(); onReply(letter.id, 'ignored'); }} title="Ignore" />
        ) : letter.replyStatus === 'ignored' ? (
          <div className={styles.sealBroken} />
        ) : null}
      </div>

      {expanded && (
        <>
          <div className={styles.letterBody}>
            <div className={styles.letterContent} dangerouslySetInnerHTML={{ __html: simpleMarkdown(letter.content) }} />

            {letter.items && letter.items.length > 0 && (
              <div className={styles.itemsSection}>
                {letter.items.map(item => (
                  <div
                    key={item.id}
                    className={styles.itemRow}
                    onContextMenu={e => handleItemContextMenu(e, item.id)}
                  >
                    <div className={styles.itemStatusDot} data-status={item.status} />
                    <span className={styles.itemText}>{item.text}</span>
                    {item.assignedAgent && (
                      <span className={styles.itemAgent}>
                        {getSenderEmoji(item.assignedAgent)} {getSenderLabel(item.assignedAgent)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className={styles.scrollRod} />
        </>
      )}

      {contextMenu && (
        <ItemContextMenu
          {...contextMenu}
          onAssign={onUpdateItem}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

interface LettersViewProps {
  letters: Letter[];
  onLettersChange: () => void;
  onOptimisticUpdate?: (updater: (prev: Letter[]) => Letter[]) => void;
}

export default function LettersView({ letters, onLettersChange, onOptimisticUpdate }: LettersViewProps) {
  const [loading, setLoading] = useState(false);

  const markRead = useCallback(async (id: string) => {
    try {
      await fetch('/api/letters', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'read' }),
      });
      onLettersChange();
    } catch { /* silent */ }
  }, [onLettersChange]);

  const replyLetter = useCallback(async (id: string, status: 'accepted' | 'ignored') => {
    // Optimistic update — works in both demo and prod mode
    onOptimisticUpdate?.(prev => prev.map(l => l.id === id ? { ...l, replyStatus: status } : l));
    try {
      await fetch('/api/letters', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'reply', replyStatus: status }),
      });
      // Skip refetch if optimistic update was used (demo mode)
      if (!onOptimisticUpdate) onLettersChange();
    } catch { /* silent */ }
  }, [onLettersChange, onOptimisticUpdate]);

  const updateItem = useCallback(async (letterId: string, itemId: string, agent: string, note: string) => {
    try {
      await fetch('/api/letters', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: letterId,
          action: 'update_item',
          itemId,
          status: 'accepted' as const,
          assignedAgent: agent,
          userNote: note || undefined,
        }),
      });
      onLettersChange();
    } catch { /* silent */ }
  }, [onLettersChange]);

  const [showIgnored, setShowIgnored] = useState(false);

  if (loading) return <div className={styles.loading}>Loading letters...</div>;

  const activeLetters = letters.filter(l => l.replyStatus !== 'ignored');
  const ignoredLetters = letters.filter(l => l.replyStatus === 'ignored');

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Letters</h1>
      </div>

      {activeLetters.length === 0 && ignoredLetters.length === 0 ? (
        <div className={styles.empty}>No letters yet</div>
      ) : (
        <>
          <div className={styles.letterList}>
            {activeLetters.map(letter => (
              <LetterCard
                key={letter.id}
                letter={letter}
                onMarkRead={markRead}
                onUpdateItem={updateItem}
                onReply={replyLetter}
              />
            ))}
          </div>
          {ignoredLetters.length > 0 && (
            <div className={styles.ignoredSection}>
              <button className={styles.ignoredToggle} onClick={() => setShowIgnored(v => !v)}>
                Ignored ({ignoredLetters.length}) {showIgnored ? '▴' : '▾'}
              </button>
              {showIgnored && (
                <div className={styles.ignoredList}>
                  {ignoredLetters.map(letter => (
                    <LetterCard
                      key={letter.id}
                      letter={letter}
                      onMarkRead={markRead}
                      onUpdateItem={updateItem}
                      onReply={replyLetter}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
