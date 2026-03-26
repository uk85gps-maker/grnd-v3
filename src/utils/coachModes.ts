export interface CoachMode {
  id: string;
  emoji: string;
  name: string;
  purpose: string;
  situations: string;
  desiredOutcome: string;
  active: boolean;
  usageCount: number;
  createdAt: string;
}

const DEFAULT_MODES: CoachMode[] = [
  {
    id: 'medical',
    emoji: '🩺',
    name: 'Medical',
    purpose: 'Functional medicine thinking — optimal ranges not normal ranges',
    situations: 'Blood results, symptoms, specialist decisions, supplement choices',
    desiredOutcome: 'Root cause identified, testing suggested, food-first approach',
    active: false,
    usageCount: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'frame-control',
    emoji: '⚔️',
    name: 'Frame Control',
    purpose: 'Hold frame under pressure, respond to reality not assumptions',
    situations: 'Conflict, disrespect, boundary testing, social pressure',
    desiredOutcome: 'Calm authority, no reactivity, frame maintained',
    active: false,
    usageCount: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'grooming',
    emoji: '🪞',
    name: 'Grooming',
    purpose: 'Physical presentation — skin, hair, beard, turban, clothing',
    situations: 'Skincare routine, beard maintenance, turban styling, wardrobe decisions',
    desiredOutcome: 'Sharp presentation, consistent standards, age-appropriate',
    active: false,
    usageCount: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'high-social',
    emoji: '👥',
    name: 'High Social',
    purpose: 'Navigate high-status social environments with ease',
    situations: 'Professional events, family gatherings, uncle interactions, authority figures',
    desiredOutcome: 'Confident presence, appropriate deference, no try-hard energy',
    active: false,
    usageCount: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'attractiveness',
    emoji: '🧲',
    name: 'Attractiveness',
    purpose: 'Build physical and energetic attractiveness',
    situations: 'Body composition, style, presence, energy, social proof',
    desiredOutcome: 'Magnetic presence, age-appropriate attractiveness, confidence',
    active: false,
    usageCount: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'women',
    emoji: '💬',
    name: 'Women',
    purpose: 'Navigate dating and relationships post-separation',
    situations: 'Dating apps, first dates, conversation, escalation, boundaries',
    desiredOutcome: 'Calibrated approach, no neediness, clear intent',
    active: false,
    usageCount: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'bullies',
    emoji: '🐂',
    name: 'Bullies',
    purpose: 'Handle bullying, disrespect, and boundary violations',
    situations: 'Workplace disrespect, social aggression, boundary testing',
    desiredOutcome: 'Firm boundaries, no escalation unless necessary, frame held',
    active: false,
    usageCount: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'electrical',
    emoji: '⚡',
    name: 'Electrical',
    purpose: 'Career strategy for electrical wholesaler work',
    situations: 'Work decisions, income strategy, career planning until May',
    desiredOutcome: 'Clear strategy, income stability, minimal energy drain',
    active: false,
    usageCount: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'finance',
    emoji: '💰',
    name: 'Finance',
    purpose: 'Money management, budgeting, financial decisions',
    situations: 'Budget planning, expense decisions, income under $60k management',
    desiredOutcome: 'Financial stability, clear priorities, no waste',
    active: false,
    usageCount: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'faith',
    emoji: '🙏',
    name: 'Faith',
    purpose: 'Sikh faith practice, simran, spiritual foundation',
    situations: 'Daily simran, faith questions, spiritual practice, turban significance',
    desiredOutcome: 'Deepened practice, faith as anchor, regulation through simran',
    active: false,
    usageCount: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'combat',
    emoji: '🥊',
    name: 'Combat',
    purpose: 'Combat readiness — physical capability and mental preparedness',
    situations: 'Training decisions, combat sports, self-defense, physical confrontation',
    desiredOutcome: 'Combat ready, de-escalation intelligent not cowardly',
    active: false,
    usageCount: 0,
    createdAt: new Date().toISOString(),
  },
];

const STORAGE_KEY = 'grnd_coach_modes';

export function getCoachModes(): CoachMode[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored) as CoachMode[];
    } catch {
      return DEFAULT_MODES;
    }
  }
  return DEFAULT_MODES;
}

export function saveCoachModes(modes: CoachMode[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(modes));
}

export function getActiveModes(): CoachMode[] {
  return getCoachModes().filter((m) => m.active);
}

export function toggleMode(modeId: string): void {
  const modes = getCoachModes();
  const activeModes = modes.filter((m) => m.active);
  
  const mode = modes.find((m) => m.id === modeId);
  if (!mode) return;

  // If trying to activate and already have 2 active, do nothing
  if (!mode.active && activeModes.length >= 2) {
    return;
  }

  mode.active = !mode.active;
  if (mode.active) {
    mode.usageCount += 1;
  }

  saveCoachModes(modes);
}

export function updateMode(modeId: string, updates: Partial<CoachMode>): void {
  const modes = getCoachModes();
  const mode = modes.find((m) => m.id === modeId);
  if (!mode) return;

  Object.assign(mode, updates);
  saveCoachModes(modes);
}

export function deleteMode(modeId: string): void {
  const modes = getCoachModes();
  const mode = modes.find((m) => m.id === modeId);
  if (!mode) return;

  // Soft delete if used, hard delete if never used
  if (mode.usageCount > 0) {
    mode.active = false;
    // Mark for deletion in 30 days
    (mode as any).deletedAt = new Date().toISOString();
    saveCoachModes(modes);
  } else {
    // Hard delete
    const filtered = modes.filter((m) => m.id !== modeId);
    saveCoachModes(filtered);
  }
}

export function addMode(mode: Omit<CoachMode, 'id' | 'active' | 'usageCount' | 'createdAt'>): void {
  const modes = getCoachModes();
  const newMode: CoachMode = {
    ...mode,
    id: `mode-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    active: false,
    usageCount: 0,
    createdAt: new Date().toISOString(),
  };
  modes.push(newMode);
  saveCoachModes(modes);
}
