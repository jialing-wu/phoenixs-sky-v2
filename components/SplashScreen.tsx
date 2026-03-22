'use client';

import { useEffect, useState } from 'react';
import styles from './SplashScreen.module.css';
import { AGENTS, AGENT_IDS, AgentId } from '@/lib/agentConfig';

export default function SplashScreen() {
  const [phase, setPhase] = useState<'show' | 'exit' | 'done'>('show');

  const [agent, setAgent] = useState<AgentId | null>(null);
  const [quote, setQuote] = useState('');

  useEffect(() => {
    const a = AGENT_IDS[Math.floor(Math.random() * AGENT_IDS.length)];
    const greetings = AGENTS[a].greetings;
    setAgent(a);
    setQuote(greetings[Math.floor(Math.random() * greetings.length)]);
  }, []);

  useEffect(() => {
    const exitTimer = setTimeout(() => setPhase('exit'), 3000);
    const hideTimer = setTimeout(() => setPhase('done'), 3800);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (phase === 'done' || !agent) return null;

  const color = AGENTS[agent].color;

  return (
    <div className={`${styles.splash} ${phase === 'exit' ? styles.exiting : ''}`}>
      <div className={styles.content}>
        <div className={styles.agentCircle} style={{ color, borderColor: `${color}30` }}>
          {AGENTS[agent].emoji}
        </div>
        <div className={styles.quote}>&ldquo;{quote}&rdquo;</div>
      </div>
    </div>
  );
}
