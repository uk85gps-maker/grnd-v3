export interface PhaseMode {
  active: boolean;
  dayCount: number;
  nonNegotiablesMissed: string[];
  lastCheckin: string;
}

export interface PhaseHistoryEntry {
  startDate: string;
  endDate: string | null;
  dayCount: number;
  trigger: string;
}

const PHASE_MODE_KEY = 'grnd_phase_mode';
const PHASE_HISTORY_KEY = 'grnd_phase_history';

export function getPhaseMode(): PhaseMode {
  const stored = localStorage.getItem(PHASE_MODE_KEY);
  if (!stored) {
    return {
      active: false,
      dayCount: 0,
      nonNegotiablesMissed: [],
      lastCheckin: '',
    };
  }

  try {
    return JSON.parse(stored) as PhaseMode;
  } catch {
    return {
      active: false,
      dayCount: 0,
      nonNegotiablesMissed: [],
      lastCheckin: '',
    };
  }
}

export function savePhaseMode(phase: PhaseMode): void {
  localStorage.setItem(PHASE_MODE_KEY, JSON.stringify(phase));
}

export function getPhaseHistory(): PhaseHistoryEntry[] {
  const stored = localStorage.getItem(PHASE_HISTORY_KEY);
  if (!stored) return [];

  try {
    return JSON.parse(stored) as PhaseHistoryEntry[];
  } catch {
    return [];
  }
}

export function savePhaseHistory(history: PhaseHistoryEntry[]): void {
  localStorage.setItem(PHASE_HISTORY_KEY, JSON.stringify(history));
}

function getSydneyDateKey(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' });
}

function checkDayMissed(dayKey: string): boolean {
  let missedCount = 0;

  // Sleep — absent or no bedTime = missed
  const sleepRaw = localStorage.getItem(`grnd_sleep_log_${dayKey}`);
  if (!sleepRaw) {
    missedCount++;
  } else {
    try {
      const sleepData = JSON.parse(sleepRaw);
      if (!sleepData.bedTime) missedCount++;
    } catch {
      missedCount++;
    }
  }

  // Food — both grnd_food_log and grnd_macro_log absent = missed
  const foodRaw = localStorage.getItem(`grnd_food_log_${dayKey}`);
  const macroRaw = localStorage.getItem(`grnd_macro_log_${dayKey}`);
  if (!foodRaw && !macroRaw) {
    missedCount++;
  }

  // Simran — completedIds must include an ID containing 'simran'
  const checklistRaw = localStorage.getItem(`grnd_checklist_${dayKey}`);
  let completedIds: string[] = [];
  if (checklistRaw) {
    try {
      const completion = JSON.parse(checklistRaw);
      completedIds = completion.completedIds || [];
    } catch {
      // treat as empty
    }
  }
  if (!completedIds.some((id: string) => id.includes('simran'))) {
    missedCount++;
  }

  // Hygiene — completedIds must include an ID containing 'shower' or 'skincare'
  if (!completedIds.some((id: string) => id.includes('shower') || id.includes('skincare'))) {
    missedCount++;
  }

  return missedCount >= 2;
}

export function detectPhaseMode(
  sleepCompliant: boolean,
  foodLogged: boolean,
  simranCompleted: boolean,
  hygieneCompleted: boolean
): PhaseMode {
  const currentPhase = getPhaseMode();
  const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' });

  // Fix 2 — deduplicate same-day calls
  if (currentPhase.lastCheckin === todayKey) return currentPhase;

  // Fix 3 — backfill missed days if app was closed
  if (currentPhase.active && currentPhase.lastCheckin) {
    const last = new Date(currentPhase.lastCheckin + 'T00:00:00');
    const todayDate = new Date(todayKey + 'T00:00:00');
    const daysBetween = Math.round((todayDate.getTime() - last.getTime()) / (24 * 60 * 60 * 1000));

    // Iterate each day between lastCheckin (exclusive) and today (exclusive)
    for (let i = 1; i < daysBetween; i++) {
      const missedDate = new Date(last);
      missedDate.setDate(last.getDate() + i);
      const missedKey = getSydneyDateKey(missedDate);
      if (checkDayMissed(missedKey)) {
        currentPhase.dayCount += 1;
      }
    }
  }

  const missed: string[] = [];
  if (!sleepCompliant) missed.push('Sleep');
  if (!foodLogged) missed.push('Food');
  if (!simranCompleted) missed.push('Simran');
  if (!hygieneCompleted) missed.push('Hygiene');

  // If 2+ non-negotiables missed
  if (missed.length >= 2) {
    if (currentPhase.active) {
      // Already in phase mode, increment day count
      currentPhase.dayCount += 1;
      currentPhase.nonNegotiablesMissed = missed;
    } else {
      // Entering phase mode
      currentPhase.active = true;
      currentPhase.dayCount = 1;
      currentPhase.nonNegotiablesMissed = missed;

      // Add to history
      const history = getPhaseHistory();
      history.push({
        startDate: todayKey,
        endDate: null,
        dayCount: 1,
        trigger: missed.join(', '),
      });
      savePhaseHistory(history);
    }
  } else {
    // Less than 2 missed - exit phase mode if active
    if (currentPhase.active) {
      // Close current phase in history
      const history = getPhaseHistory();
      const currentEntry = history[history.length - 1];
      if (currentEntry && !currentEntry.endDate) {
        currentEntry.endDate = todayKey;
        currentEntry.dayCount = currentPhase.dayCount;
        savePhaseHistory(history);
      }

      currentPhase.active = false;
      currentPhase.dayCount = 0;
      currentPhase.nonNegotiablesMissed = [];
    }
  }

  // Fix 1 — always write lastCheckin
  currentPhase.lastCheckin = todayKey;

  savePhaseMode(currentPhase);
  return currentPhase;
}
