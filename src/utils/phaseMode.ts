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

export function detectPhaseMode(
  sleepCompliant: boolean,
  foodLogged: boolean,
  simranCompleted: boolean,
  hygieneCompleted: boolean
): PhaseMode {
  const currentPhase = getPhaseMode();
  const today = new Date().toISOString().split('T')[0];

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
      currentPhase.lastCheckin = '';

      // Add to history
      const history = getPhaseHistory();
      history.push({
        startDate: today,
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
        currentEntry.endDate = today;
        currentEntry.dayCount = currentPhase.dayCount;
        savePhaseHistory(history);
      }

      currentPhase.active = false;
      currentPhase.dayCount = 0;
      currentPhase.nonNegotiablesMissed = [];
      currentPhase.lastCheckin = '';
    }
  }

  savePhaseMode(currentPhase);
  return currentPhase;
}
