// Agent configuration — the ONLY file that differs between language versions.
// English version: bird-themed agents (Piper & Robin)
// Fork this file and customize agents for your own calendar!

export type AgentId = 'piper' | 'robin';

export interface Agent {
  id: AgentId;
  name: string;
  emoji: string;
  color: string;
  quotes: string[];     // Shown when completing tasks/quests
  greetings: string[];  // Shown on splash screen
}

export const AGENT_IDS: AgentId[] = ['piper', 'robin'];

export const AGENTS: Record<AgentId, Agent> = {
  piper: {
    id: 'piper',
    name: 'Piper',
    emoji: '🐦',
    color: '#2D5F7C',
    quotes: [
      'Another delivery, right on time!',
      'The winds were kind today.',
      'One less letter waiting in the queue.',
      'Efficient as always. Well done!',
      'That route was tricky, but we made it.',
      'The valley can rest easy tonight.',
      'Every letter delivered is a promise kept.',
      'Not bad for a day\'s work!',
    ],
    greetings: [
      'Clear skies ahead — perfect for deliveries.',
      'The morning thermals are just right.',
      'I\'ve already mapped today\'s route.',
      'The east wind is strong. Let\'s use it.',
      'Another day, another flight path.',
    ],
  },
  robin: {
    id: 'robin',
    name: 'Robin',
    emoji: '🪺',
    color: '#2D6E4E',
    quotes: [
      'Rest well earned, friend.',
      'You sang beautifully today!',
      'The nest looks cozier already.',
      'Even birds need their downtime.',
      'A good meal and a warm perch — what more?',
      'Tomorrow\'s dawn will come soon enough.',
      'The sunset was worth pausing for.',
      'Social hour: complete!',
    ],
    greetings: [
      'The morning dew looks lovely today.',
      'I found the best worm spot — follow me!',
      'Did you hear the cardinal\'s new song?',
      'Today feels like a cafe day.',
      'The humans left out fresh breadcrumbs!',
    ],
  },
};

export const DEFAULT_AGENT: AgentId = 'piper';

export function getAgent(idOrName: string): Agent {
  const lower = idOrName.toLowerCase();
  const agent = AGENTS[lower as AgentId];
  if (agent) return agent;
  const match = Object.values(AGENTS).find(a => a.name.toLowerCase() === lower);
  return match || AGENTS[DEFAULT_AGENT];
}

// App metadata
export const APP_META = {
  title: "Phoenix's Sky",
  description: 'An agent-native calendar you can fully customize with AI',
  locale: 'en',
};
