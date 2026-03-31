// Phase 3b - Coach Context Layer
// Scaffolds data structures and context functions for Coach integration

import { detectPhaseMode } from './phaseMode';
import { getLatestBodyStats, getStageData } from './reviewData';
import { getGymSessions } from './gymStructure';
import { getCrossDayFasting } from './foodLog';
import { getGrndDayKey } from './dayKey';

export const STORAGE_KEYS = {
  CHECKLIST_STRUCTURE: 'grnd_checklist_structure',
  CHECKLIST_COMPLETION: 'grnd_checklist',
  SLEEP_LOG: 'grnd_sleep_log',
  MOOD_LOG: 'grnd_mood_log',
  GYM_LOG: 'grnd_gym_log',
  BODY_LOG: 'grnd_body_log',
  MACRO_LOG: 'grnd_macro_log',
  MEAL_PLAN_DEFAULTS: 'grnd_meal_plan_defaults',
  MACRO_TARGETS: 'grnd_macro_targets',
  BLOOD_RESULTS: 'grnd_blood_results',
  SPECIALIST_ACTIONS: 'grnd_specialist_actions',
  FIELD_LOG: 'grnd_field_log',
  FIELD_LOG_ACTIONS: 'grnd_field_log_actions',
  LEARN_MATERIALS: 'grnd_learn_materials',
  STAGE_DATA: 'grnd_stage_data',
  MILESTONES: 'grnd_milestones',
  EDIT_HISTORY: 'grnd_edit_history',
  MOOD_CAUSES: 'grnd_mood_causes',
  FOOD_PLAN: 'grnd_food_plan',
  FOOD_LOG: 'grnd_food_log',
  FOOD_PLAN_EDIT_HISTORY: 'grnd_food_plan_edit_history',
  MIGRATION_FOOD_SPLIT_DONE: 'grnd_migration_food_split_done',
  CHECKLIST_STRUCTURE_PRE_MIGRATION_BACKUP: 'grnd_checklist_structure_pre_migration_backup',
};

// Data Stream Interfaces

export interface SleepLog {
  bedTime: string;
  wakeTime: string;
  quality: number | null;
  durationMinutes: number;
  cause: string;
}

export interface MoodLogEntry {
  section: string;
  sectionName: string;
  timestamp: string;
  energy: number;
  mood: number;
  cause: string;
}

export interface MoodLog {
  date: string;
  energy: number | null;
  mood: number | null;
  cause: string;
}

export interface GymSession {
  date: string;
  type: string;
  exercises: Array<{
    name: string;
    sets: number;
    reps: number;
    weight: number;
  }>;
  injuries: string[];
  sessionGoal: string;
  effortRating: number | null;
}

export interface BodyLog {
  date: string;
  weight: number | null;
  waist: number | null;
  bodyFat: number | null;
  contextNote: string;
}

export interface MacroLogEntry {
  id: string;
  name: string;
  time: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  source: 'default' | 'usda' | 'manual';
  confirmed: boolean;
  purpose: string;
}

export interface MacroLog {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  targetCalories: number;
  targetProtein: number;
  deviation: number;
  deviationReason: string;
}

export interface SpecialistAction {
  name: string;
  status: 'pending' | 'booked' | 'completed';
  purposeNote: string;
  outcome: string;
  dueDate: string | null;
  bookedDate: string | null;
}

export interface FieldAction {
  date: string;
  action: string;
  layer: string;
  patternTargeted: string;
  outcome: string;
  confidenceRating: number | null;
  notes: string;
}

export interface StageData {
  currentStage: number;
  readinessPercent: number;
  lastUpdated: string;
}

export interface ComplianceStream {
  name: string;
  status: 'green' | 'amber' | 'red';
  value: number | string;
  threshold: number | string;
}

export interface PrioritySignal {
  exists: boolean;
  item: string;
  observation: string;
  daysCount: number;
  layer: string;
  threshold: number;
}

export interface MilestoneEntry {
  id: string;
  label: string;
  stream: string;
  achievedDate: string;
  metric: string;
  value: number;
  threshold: number;
}

export function getMilestones(): MilestoneEntry[] {
  const raw = localStorage.getItem(STORAGE_KEYS.MILESTONES);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as MilestoneEntry[];
  } catch {
    return [];
  }
}

export function saveMilestones(entries: MilestoneEntry[]): void {
  localStorage.setItem(STORAGE_KEYS.MILESTONES, JSON.stringify(entries));
}

export function checkAndAwardMilestones(): void {
  const existing = getMilestones();
  const existingIds = new Set(existing.map((m) => m.id));
  const toAdd: MilestoneEntry[] = [];
  const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' });

  // Helper: get YYYY-MM-DD key for N days ago
  function dayKeyOffset(daysAgo: number): string {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' });
  }

  // Helper: award once per id
  function award(entry: MilestoneEntry) {
    if (!existingIds.has(entry.id)) {
      existingIds.add(entry.id);
      toAdd.push(entry);
    }
  }

  // --- Checklist: consecutive days >= 80% completion ---
  {
    const structureRaw = localStorage.getItem(STORAGE_KEYS.CHECKLIST_STRUCTURE);
    if (structureRaw) {
      try {
        type SectionNode = { items?: Array<unknown>; sections?: SectionNode[] };
        function countItems(sections: SectionNode[]): number {
          return sections.reduce((acc, s) =>
            acc + (s.items?.length ?? 0) + (s.sections ? countItems(s.sections) : 0), 0);
        }
        const structure = JSON.parse(structureRaw) as SectionNode[];
        const totalItems = countItems(structure);
        if (totalItems > 0) {
          let streak = 0;
          for (let i = 0; i < 30; i++) {
            const dk = dayKeyOffset(i);
            const cr = localStorage.getItem(`${STORAGE_KEYS.CHECKLIST_COMPLETION}_${dk}`);
            if (!cr) break;
            const completion = JSON.parse(cr) as { completedIds?: string[] };
            const pct = Math.min(100, Math.round(((completion.completedIds?.length || 0) / totalItems) * 100));
            if (pct >= 80) streak++; else break;
          }
          for (const days of [7, 14, 30]) {
            if (streak >= days) {
              award({ id: `checklist-${days}days-${todayKey}`, label: `${days}-day checklist streak`, stream: 'Checklist', achievedDate: todayKey, metric: 'consecutive days ≥80%', value: streak, threshold: days });
            }
          }
        }
      } catch { /* skip */ }
    }
  }

  // --- Sleep: consecutive days with sleep logged ---
  {
    let streak = 0;
    for (let i = 0; i < 30; i++) {
      const dk = dayKeyOffset(i);
      const raw = localStorage.getItem(`${STORAGE_KEYS.SLEEP_LOG}_${dk}`);
      if (!raw) break;
      try {
        const entry = JSON.parse(raw) as { bedTime?: string; wakeTime?: string };
        if (entry.bedTime && entry.wakeTime) streak++; else break;
      } catch { break; }
    }
    for (const days of [7, 14, 30]) {
      if (streak >= days) {
        award({ id: `sleep-${days}days-${todayKey}`, label: `${days}-day sleep logging streak`, stream: 'Sleep', achievedDate: todayKey, metric: 'consecutive days logged', value: streak, threshold: days });
      }
    }
  }

  // --- Gym: consecutive weeks with 3+ sessions ---
  {
    const raw = localStorage.getItem(STORAGE_KEYS.GYM_LOG);
    if (raw) {
      try {
        const sessions = JSON.parse(raw) as Array<{ date: string; dayType?: string }>;
        let consecutiveWeeks = 0;
        for (let w = 0; w < 4; w++) {
          const weekStart = new Date();
          weekStart.setDate(weekStart.getDate() - (w + 1) * 7);
          const weekEnd = new Date();
          weekEnd.setDate(weekEnd.getDate() - w * 7);
          const wsStr = weekStart.toISOString().slice(0, 10);
          const weStr = weekEnd.toISOString().slice(0, 10);
          const count = sessions.filter((s) => s.date >= wsStr && s.date < weStr && s.dayType?.toLowerCase() !== 'rest').length;
          if (count >= 3) consecutiveWeeks++; else break;
        }
        for (const weeks of [1, 2, 4]) {
          if (consecutiveWeeks >= weeks) {
            award({ id: `gym-${weeks}weeks-${todayKey}`, label: `${weeks} consecutive week${weeks > 1 ? 's' : ''} with 3+ gym sessions`, stream: 'Gym', achievedDate: todayKey, metric: 'consecutive weeks 3+ sessions', value: consecutiveWeeks, threshold: weeks });
          }
        }
      } catch { /* skip */ }
    }
  }

  // --- Macros: consecutive days with food logged ---
  {
    let streak = 0;
    for (let i = 0; i < 30; i++) {
      const dk = dayKeyOffset(i);
      const foodRaw = localStorage.getItem(`${STORAGE_KEYS.FOOD_LOG}_${dk}`);
      const macroRaw = localStorage.getItem(`${STORAGE_KEYS.MACRO_LOG}_${dk}`);
      if (foodRaw || macroRaw) streak++; else break;
    }
    for (const days of [7, 14, 30]) {
      if (streak >= days) {
        award({ id: `macros-${days}days-${todayKey}`, label: `${days}-day food logging streak`, stream: 'Macros', achievedDate: todayKey, metric: 'consecutive days logged', value: streak, threshold: days });
      }
    }
  }

  // --- Body: weight target milestones ---
  {
    const raw = localStorage.getItem(STORAGE_KEYS.BODY_LOG);
    if (raw) {
      try {
        const log = JSON.parse(raw) as Array<{ date: string; weight?: number }>;
        const withWeight = log.filter((e) => e.weight != null).sort((a, b) => b.date.localeCompare(a.date));
        if (withWeight.length > 0) {
          const latest = withWeight[0].weight as number;
          for (const target of [82, 80, 78, 75]) {
            if (latest < target) {
              award({ id: `body-below${target}kg-${todayKey}`, label: `Weight below ${target}kg`, stream: 'Body Stats', achievedDate: todayKey, metric: 'kg', value: latest, threshold: target });
            }
          }
        }
      } catch { /* skip */ }
    }
  }

  // --- Field: total outcomes count milestones ---
  {
    const raw = localStorage.getItem(STORAGE_KEYS.FIELD_LOG);
    if (raw) {
      try {
        const outcomes = JSON.parse(raw) as Array<unknown>;
        const total = outcomes.length;
        for (const count of [5, 10, 25]) {
          if (total >= count) {
            award({ id: `field-${count}outcomes-${todayKey}`, label: `${count} field outcomes logged`, stream: 'Field Actions', achievedDate: todayKey, metric: 'total outcomes', value: total, threshold: count });
          }
        }
      } catch { /* skip */ }
    }
  }

  // --- Phase Mode: survived a phase ---
  {
    const raw = localStorage.getItem('grnd_phase_history');
    if (raw) {
      try {
        const history = JSON.parse(raw) as Array<{ endDate: string | null }>;
        const survived = history.some((e) => e.endDate !== null);
        if (survived) {
          award({ id: `phase-survived-first`, label: 'Survived a phase', stream: 'Phase Mode', achievedDate: todayKey, metric: 'phases completed', value: 1, threshold: 1 });
        }
      } catch { /* skip */ }
    }
  }

  if (toAdd.length > 0) {
    saveMilestones([...existing, ...toAdd]);
  }
}

// Compliance Snapshot Function
// Returns current compliance status across all data streams
export function getComplianceSnapshot(): {
  checklist: ComplianceStream | null;
  sleep: ComplianceStream | null;
  mood: ComplianceStream | null;
  gym: ComplianceStream | null;
  body: ComplianceStream | null;
  macros: ComplianceStream | null;
  specialists: ComplianceStream | null;
  field: ComplianceStream | null;
} {
  // Check mood logging compliance - today and last 7 days
  let moodCompliance: ComplianceStream | null = null;
  const today = new Date();
  const todayKey = getGrndDayKey();
  const todayMoodKey = `${STORAGE_KEYS.MOOD_LOG}_${todayKey}`;
  
  // Check today's section count
  let todaySections = 0;
  const todayRaw = localStorage.getItem(todayMoodKey);
  if (todayRaw) {
    try {
      const todayEntries = JSON.parse(todayRaw) as MoodLogEntry[];
      todaySections = todayEntries.length;
    } catch {
      todaySections = 0;
    }
  }
  
  // Check last 7 days for days with 2+ sections
  let daysWithMultipleSections = 0;
  for (let i = 0; i < 7; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(today.getDate() - i);
    const dayKey = getGrndDayKey(checkDate);
    const moodKey = `${STORAGE_KEYS.MOOD_LOG}_${dayKey}`;
    
    const raw = localStorage.getItem(moodKey);
    if (raw) {
      try {
        const entries = JSON.parse(raw) as MoodLogEntry[];
        if (entries.length >= 2) {
          daysWithMultipleSections++;
        }
      } catch {
        // Skip invalid entries
      }
    }
  }
  
  // Green: 3+ sections today OR 5+ days with 2+ sections
  // Amber: 1-2 sections today OR 3-4 days with 2+ sections
  // Red: 0 sections today AND <3 days with 2+ sections
  if (todaySections >= 3 || daysWithMultipleSections >= 5) {
    moodCompliance = { name: 'Mood Logging', status: 'green', value: `${todaySections} today, ${daysWithMultipleSections}/7 days`, threshold: '3 sections today or 5+ days' };
  } else if (todaySections >= 1 || daysWithMultipleSections >= 3) {
    moodCompliance = { name: 'Mood Logging', status: 'amber', value: `${todaySections} today, ${daysWithMultipleSections}/7 days`, threshold: '3 sections today or 5+ days' };
  } else {
    moodCompliance = { name: 'Mood Logging', status: 'red', value: `${todaySections} today, ${daysWithMultipleSections}/7 days`, threshold: '3 sections today or 5+ days' };
  }

  return {
    checklist: (() => {
      type SectionNode = { items?: Array<unknown>; sections?: SectionNode[] };
      function countItems(sections: SectionNode[]): number {
        return sections.reduce((acc, s) =>
          acc + (s.items?.length ?? 0) + (s.sections ? countItems(s.sections) : 0), 0);
      }
      try {
        const structureRaw = localStorage.getItem(STORAGE_KEYS.CHECKLIST_STRUCTURE);
        if (!structureRaw) return null;
        const structure = JSON.parse(structureRaw) as SectionNode[];
        const totalItems = countItems(structure);
        if (totalItems === 0) return null;

        const completionRaw = localStorage.getItem(`${STORAGE_KEYS.CHECKLIST_COMPLETION}_${todayKey}`);
        let completedCount = 0;
        if (completionRaw) {
          const completion = JSON.parse(completionRaw) as { completedIds?: string[] };
          completedCount = completion.completedIds?.length || 0;
        }
        const completionPct = Math.min(100, Math.round((completedCount / totalItems) * 100));
        const status: 'green' | 'amber' | 'red' = completionPct >= 80 ? 'green' : completionPct >= 50 ? 'amber' : 'red';
        return { name: 'Checklist', status, value: completionPct, threshold: 80 };
      } catch (e) {
        console.error('compliance checklist:', e);
        return null;
      }
    })(),

    sleep: (() => {
      try {
        const raw = localStorage.getItem(`${STORAGE_KEYS.SLEEP_LOG}_${todayKey}`);
        if (!raw) return null;
        const entry = JSON.parse(raw) as { bedTime?: string; wakeTime?: string };
        if (!entry?.bedTime || !entry?.wakeTime) return { name: 'Sleep', status: 'red' as const, value: 0, threshold: 7 };

        const [bh, bm] = entry.bedTime.split(':').map(Number);
        const [wh, wm] = entry.wakeTime.split(':').map(Number);
        let bedMins = bh * 60 + bm;
        let wakeMins = wh * 60 + wm;
        if (wakeMins <= bedMins) wakeMins += 24 * 60;
        const durationHours = Math.round(((wakeMins - bedMins) / 60) * 10) / 10;
        const status: 'green' | 'amber' | 'red' = durationHours >= 7 ? 'green' : durationHours >= 6 ? 'amber' : 'red';
        return { name: 'Sleep', status, value: durationHours, threshold: 7 };
      } catch (e) {
        console.error('compliance sleep:', e);
        return null;
      }
    })(),

    // Checks: Last 7 days of mood logging - green if 6+, amber if 4-5, red if <4
    mood: moodCompliance,

    gym: (() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.GYM_LOG);
        if (!raw) return null;
        const sessions = JSON.parse(raw) as Array<{ date: string; dayType?: string }>;
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 7);
        const sevenDaysAgoStr = sevenDaysAgo.toISOString().slice(0, 10);
        const sessionCount = sessions.filter(
          (s) => s.date >= sevenDaysAgoStr && s.date <= todayKey && s.dayType?.toLowerCase() !== 'rest'
        ).length;
        const status: 'green' | 'amber' | 'red' = sessionCount >= 3 ? 'green' : sessionCount >= 2 ? 'amber' : 'red';
        return { name: 'Gym', status, value: sessionCount, threshold: 3 };
      } catch (e) {
        console.error('compliance gym:', e);
        return null;
      }
    })(),

    body: (() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.BODY_LOG);
        if (!raw) return null;
        const log = JSON.parse(raw) as Array<{ date: string; weight?: number }>;
        const withWeight = log
          .filter((e) => {
            if (e.weight == null) return false;
            const d = new Date(e.date);
            return !isNaN(d.getTime());
          })
          .sort((a, b) => b.date.localeCompare(a.date));
        if (withWeight.length === 0) return null;
        const latestDate = new Date(withWeight[0].date);
        latestDate.setHours(0, 0, 0, 0);
        const todayMidnight = new Date(today);
        todayMidnight.setHours(0, 0, 0, 0);
        const daysSince = Math.floor((todayMidnight.getTime() - latestDate.getTime()) / (24 * 60 * 60 * 1000));
        const status: 'green' | 'amber' | 'red' = daysSince <= 7 ? 'green' : daysSince <= 14 ? 'amber' : 'red';
        return { name: 'Body Stats', status, value: daysSince, threshold: 7 };
      } catch (e) {
        console.error('compliance body:', e);
        return null;
      }
    })(),

    macros: (() => {
      try {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMins = currentHour * 60 + now.getMinutes();
        const wakingStart = 4 * 60 + 30;
        const wakingEnd = 22 * 60;
        const dayProgressPct = Math.min(100, Math.max(0, ((currentMins - wakingStart) / (wakingEnd - wakingStart)) * 100));

        const targetsRaw = localStorage.getItem(STORAGE_KEYS.MACRO_TARGETS);
        let calorieTarget = 1435;
        if (targetsRaw) {
          try { calorieTarget = JSON.parse(targetsRaw).calories || 1435; } catch { /* use default */ }
        }

        let caloriesLogged = 0;
        const foodRaw = localStorage.getItem(`${STORAGE_KEYS.FOOD_LOG}_${todayKey}`);
        if (foodRaw) {
          const log = JSON.parse(foodRaw) as { meals: Array<{ status: string; macros: { calories: number } }> };
          caloriesLogged = log.meals
            .filter((m) => m.status === 'plan' || m.status === 'deviation')
            .reduce((acc, m) => acc + m.macros.calories, 0);
        } else {
          const macroRaw = localStorage.getItem(`${STORAGE_KEYS.MACRO_LOG}_${todayKey}`);
          if (macroRaw) {
            const entries = JSON.parse(macroRaw) as MacroLogEntry[];
            caloriesLogged = entries.filter((e) => e.confirmed).reduce((acc, e) => acc + e.calories, 0);
          }
        }

        const caloriePct = calorieTarget > 0 ? Math.round((caloriesLogged / calorieTarget) * 100) : 0;

        // Only flag red if day is far enough along; otherwise treat as in-progress
        let status: 'green' | 'amber' | 'red';
        if (caloriePct >= 80) {
          status = 'green';
        } else if (caloriePct >= 50) {
          status = 'amber';
        } else {
          status = dayProgressPct > 85 ? 'red' : 'amber';
        }

        return { name: 'Macros', status, value: caloriePct, threshold: 80 };
      } catch {
        return null;
      }
    })(),

    specialists: (() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.SPECIALIST_ACTIONS);
        if (!raw) return null;
        const actions = JSON.parse(raw) as Array<{ status: string; dueDate: string | null }>;
        const todayMidnight = new Date(today);
        todayMidnight.setHours(0, 0, 0, 0);
        const overdueCount = actions.filter((a) => {
          if (a.status === 'booked' || a.status === 'completed') return false;
          if (!a.dueDate) return false;
          const due = new Date(a.dueDate);
          due.setHours(0, 0, 0, 0);
          return (todayMidnight.getTime() - due.getTime()) > 14 * 24 * 60 * 60 * 1000;
        }).length;
        const status: 'green' | 'amber' | 'red' = overdueCount === 0 ? 'green' : overdueCount <= 2 ? 'amber' : 'red';
        return { name: 'Specialists', status, value: overdueCount, threshold: 0 };
      } catch {
        return null;
      }
    })(),

    // Checks: Last 7 days of field actions - green if 2+ per week, amber if 1, red if 0
    field: (() => {
      const raw = localStorage.getItem(STORAGE_KEYS.FIELD_LOG);
      if (!raw) return null;
      
      try {
        const outcomes = JSON.parse(raw) as Array<{ loggedAt: string }>;
        const today = new Date();
        const weekAgo = new Date(today);
        weekAgo.setDate(today.getDate() - 7);
        
        const thisWeekCount = outcomes.filter((o) => {
          const loggedDate = new Date(o.loggedAt);
          return loggedDate >= weekAgo && loggedDate <= today;
        }).length;
        
        if (thisWeekCount >= 2) {
          return { name: 'Field Actions', status: 'green', value: `${thisWeekCount} this week`, threshold: '2+ per week' };
        } else if (thisWeekCount === 1) {
          return { name: 'Field Actions', status: 'amber', value: `${thisWeekCount} this week`, threshold: '2+ per week' };
        } else {
          return { name: 'Field Actions', status: 'red', value: `${thisWeekCount} this week`, threshold: '2+ per week' };
        }
      } catch {
        return null;
      }
    })(),
  };
}

// Coach Context Function
// Aggregates all data streams into a single context object for Coach
export function getCoachContext(): {
  currentTime: {
    hour: number;
    timeOfDay: string;
    dayProgressPct: number;
    sleepLoggedToday: boolean;
    newDayStarted: boolean;
  };
  currentPeriod: {
    dayOfWeek: string;
    isWeeklyReviewDay: boolean;
    weekNumber: number;
    dayOfMonth: number;
    weekProgressPct: number;
    monthProgressPct: number;
    daysUntilDietitianAppointment: number | null;
  };
  compliance: ReturnType<typeof getComplianceSnapshot>;
  checklist: any;
  sleep: any;
  mood: any;
  gym: any;
  body: any;
  macros: any;
  food: any;
  specialists: any;
  field: any;
  learn: any;
  stage: any;
  dailyNotes: Array<{ date: string; note: string }> | null;
  priorities: PrioritySignal[];
  phaseMode: {
    active: boolean;
    dayCount: number;
    nonNegotiablesMissed: string[];
    lastCheckin: string;
  };
} {
  const compliance = getComplianceSnapshot();
  checkAndAwardMilestones();

  // Load last 7 days of mood logs (array structure)
  const moodLogs: Array<{ date: string; entries: MoodLogEntry[] }> = [];
  const today = new Date();

  for (let i = 0; i < 7; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(today.getDate() - i);
    const dayKey = getGrndDayKey(checkDate);
    const moodKey = `${STORAGE_KEYS.MOOD_LOG}_${dayKey}`;

    const raw = localStorage.getItem(moodKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as MoodLogEntry[];
        moodLogs.push({ date: dayKey, entries: parsed });
      } catch {
        // Skip invalid entries
      }
    }
  }

  const now = new Date();
  const hour = now.getHours();
  const minutesFromMidnight = hour * 60 + now.getMinutes();
  const wakingStart = 4 * 60 + 30; // 4:30am = 270 min
  const wakingEnd = 22 * 60;        // 10:00pm = 1320 min
  const rawPct = ((minutesFromMidnight - wakingStart) / (wakingEnd - wakingStart)) * 100;
  const dayProgressPct = Math.round(Math.min(100, Math.max(0, rawPct)));

  let timeOfDay: string;
  if (hour >= 4 && hour <= 11) timeOfDay = 'morning';
  else if (hour >= 12 && hour <= 17) timeOfDay = 'afternoon';
  else if (hour >= 18 && hour <= 21) timeOfDay = 'evening';
  else timeOfDay = 'night';

  const todayKey = getGrndDayKey();
  let sleepLoggedToday = false;
  try {
    const sleepRaw = localStorage.getItem(STORAGE_KEYS.SLEEP_LOG);
    if (sleepRaw) {
      const sleepArr = JSON.parse(sleepRaw) as Array<{ dateKey?: string; date?: string }>;
      sleepLoggedToday = Array.isArray(sleepArr) && sleepArr.some(
        (e) => (e.dateKey === todayKey || e.date === todayKey)
      );
    }
  } catch {
    sleepLoggedToday = false;
  }

  // ISO week number
  const dayOfWeek = now.getDay(); // 0=Sun
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const weekProgressMap: Record<number, number> = { 1: 14, 2: 28, 3: 43, 4: 57, 5: 71, 6: 86, 0: 100 };
  const jan4 = new Date(now.getFullYear(), 0, 4);
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const weekNumber = Math.floor((now.getTime() - startOfWeek1.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthProgressPct = Math.round((now.getDate() / daysInMonth) * 100);

  const dietitianDate = new Date(2026, 4, 7); // 7 May 2026
  dietitianDate.setHours(0, 0, 0, 0);
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.floor((dietitianDate.getTime() - todayMidnight.getTime()) / (24 * 60 * 60 * 1000));
  const daysUntilDietitianAppointment = diffDays >= 0 ? diffDays : null;

  return {
    currentTime: {
      hour,
      timeOfDay,
      dayProgressPct,
      sleepLoggedToday,
      newDayStarted: sleepLoggedToday,
    },
    currentPeriod: {
      dayOfWeek: dayNames[dayOfWeek],
      isWeeklyReviewDay: dayOfWeek === 0,
      weekNumber,
      dayOfMonth: now.getDate(),
      weekProgressPct: weekProgressMap[dayOfWeek],
      monthProgressPct,
      daysUntilDietitianAppointment,
    },
    compliance,

    checklist: (() => {
      const checklistLogs: Array<{ date: string; completedIds: string[]; totalItems: number; completionPercent: number }> = [];
      const today = new Date();

      for (let i = 0; i < 7; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() - i);
        const yyyy = checkDate.getFullYear();
        const mm = String(checkDate.getMonth() + 1).padStart(2, '0');
        const dd = String(checkDate.getDate()).padStart(2, '0');
        const dayKey = `${yyyy}-${mm}-${dd}`;
        const checklistKey = `${STORAGE_KEYS.CHECKLIST_COMPLETION}_${dayKey}`;
        const structureKey = STORAGE_KEYS.CHECKLIST_STRUCTURE;

        const completionRaw = localStorage.getItem(checklistKey);
        const structureRaw = localStorage.getItem(structureKey);

        if (completionRaw) {
          try {
            const completion = JSON.parse(completionRaw);
            const completedIds = completion.completedIds || [];
            type SectionNode = { items?: Array<unknown>; sections?: SectionNode[] };
            function countItems(sections: SectionNode[]): number {
              return sections.reduce((acc, s) =>
                acc + (s.items?.length ?? 0) + (s.sections ? countItems(s.sections) : 0), 0);
            }
            let totalItems = 0;
            if (structureRaw) {
              try {
                const structure = JSON.parse(structureRaw) as SectionNode[];
                totalItems = countItems(structure);
              } catch { /* leave as 0 */ }
            }
            if (totalItems === 0) continue;
            const completionPercent = Math.min(100, Math.round((completedIds.length / totalItems) * 100));
            checklistLogs.push({ date: dayKey, completedIds, totalItems, completionPercent });
          } catch {
            // Skip invalid entries
          }
        }
      }

      return checklistLogs.length > 0 ? checklistLogs : null;
    })(),

    sleep: (() => {
      const sleepLogs: Array<{ date: string; bedTime: string; wakeTime: string; durationMinutes: number; quality: number | null; cause: string }> = [];
      const today = new Date();

      for (let i = 0; i < 7; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() - i);
        const yyyy = checkDate.getFullYear();
        const mm = String(checkDate.getMonth() + 1).padStart(2, '0');
        const dd = String(checkDate.getDate()).padStart(2, '0');
        const dayKey = `${yyyy}-${mm}-${dd}`;
        const sleepKey = `${STORAGE_KEYS.SLEEP_LOG}_${dayKey}`;

        const raw = localStorage.getItem(sleepKey);
        if (raw) {
          try {
            const entry = JSON.parse(raw);
            sleepLogs.push({ date: dayKey, ...entry });
          } catch {
            // Skip invalid entries
          }
        }
      }

      return sleepLogs.length > 0 ? sleepLogs : null;
    })(),

    // Populated by: Today tab - mood/energy logging (Phase 3b Step 2)
    mood: moodLogs,

    gym: (() => {
      const sessions = getGymSessions();
      if (sessions.length === 0) return null;

      const today = new Date();
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(today.getDate() - 30);

      const recentSessions = sessions.filter(s => new Date(s.date) >= thirtyDaysAgo);
      const lastThree = [...sessions].reverse().slice(0, 3);

      return {
        totalSessionsLast30Days: recentSessions.length,
        lastThreeSessions: lastThree.map(s => ({
          date: s.date,
          dayType: s.dayType,
          energyRating: s.energyRating,
          exerciseCount: s.exercises.length,
          completedSets: s.exercises.reduce((total, ex) => total + ex.sets.filter(set => set.completed).length, 0),
          injuriesFlagged: [...new Set(s.exercises.flatMap(ex => ex.injuryFlags))],
        })),
        sessionFrequencyPerWeek: Math.round((recentSessions.length / 30) * 7 * 10) / 10,
      };
    })(),

    body: (() => {
      const latest = getLatestBodyStats();
      if (!latest) return null;

      const raw = localStorage.getItem(STORAGE_KEYS.BODY_LOG);
      let trend: { weightChange7Days: number | null; weightChange30Days: number | null } = { weightChange7Days: null, weightChange30Days: null };

      if (raw) {
        try {
          const log = JSON.parse(raw) as Array<{ date: string; weight?: number }>;
          const sorted = [...log].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

          if (sorted.length >= 2 && latest.weight) {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const entry7 = sorted.filter(e => new Date(e.date) >= sevenDaysAgo && e.weight)[0];
            const entry30 = sorted.filter(e => new Date(e.date) >= thirtyDaysAgo && e.weight)[0];

            if (entry7?.weight) trend.weightChange7Days = Math.round((latest.weight - entry7.weight) * 10) / 10;
            if (entry30?.weight) trend.weightChange30Days = Math.round((latest.weight - entry30.weight) * 10) / 10;
          }
        } catch { /* skip */ }
      }

      return {
        latest,
        trend,
        lastLoggedDate: latest.date,
      };
    })(),

    // Populated by: Today tab - macro tracking (Phase 3b Step 4)
    // Updated: First checks grnd_food_log (DailyFoodLog shape), falls back to grnd_macro_log (MacroLogEntry[] shape)
    macros: (() => {
      const macroLogs: Array<{ date: string; logged: boolean; entries: MacroLogEntry[]; totals: { calories: number; protein: number; carbs: number; fat: number; fibre: number }; targets: { calories: number; protein: number; carbs: number; fat: number }; deviation?: string }> = [];
      const today = new Date();
      const defaultTargets = { calories: 1435, protein: 116.5, carbs: 102.2, fat: 57.9 };
      const zeroTotals = { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 };

      for (let i = 0; i < 7; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() - i);
        const dayKey = getGrndDayKey(checkDate);

        const foodLogKey = `${STORAGE_KEYS.FOOD_LOG}_${dayKey}`;
        const macroKey = `${STORAGE_KEYS.MACRO_LOG}_${dayKey}`;

        const foodRaw = localStorage.getItem(foodLogKey);

        if (foodRaw) {
          // grnd_food_log_{dateKey} — DailyFoodLog shape written by FoodTab
          try {
            const log = JSON.parse(foodRaw) as { meals: Array<{ status: string; macros: { calories: number; protein: number; carbs: number; fat: number; fibre: number } }>; };
            const eaten = log.meals.filter((m) => m.status === 'plan' || m.status === 'deviation');

            const totals = eaten.reduce(
              (acc, m) => ({
                calories: acc.calories + m.macros.calories,
                protein: acc.protein + m.macros.protein,
                carbs: acc.carbs + m.macros.carbs,
                fat: acc.fat + m.macros.fat,
                fibre: acc.fibre + m.macros.fibre,
              }),
              { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 }
            );

            const targetsRaw = localStorage.getItem(STORAGE_KEYS.MACRO_TARGETS);
            let targets = { ...defaultTargets };
            if (targetsRaw) {
              try {
                targets = JSON.parse(targetsRaw);
              } catch {
                // Use defaults
              }
            }

            let deviation: string | undefined;
            const calDiff = ((totals.calories - targets.calories) / targets.calories) * 100;
            if (Math.abs(calDiff) > 20) {
              deviation = calDiff > 0 ? 'Over target by >20%' : 'Under target by >20%';
            } else if (Math.abs(calDiff) > 10) {
              deviation = calDiff > 0 ? 'Over target by 10-20%' : 'Under target by 10-20%';
            }

            macroLogs.push({ date: dayKey, logged: true, entries: [], totals, targets, deviation });
          } catch {
            // Key existed but data was corrupt — logged: true, zeroed totals
            macroLogs.push({ date: dayKey, logged: true, entries: [], totals: { ...zeroTotals }, targets: { ...defaultTargets } });
          }
        } else {
          // Fallback: grnd_macro_log_{dateKey} — old MacroLogEntry[] shape
          const macroRaw = localStorage.getItem(macroKey);
          if (macroRaw) {
            try {
              const entries = JSON.parse(macroRaw) as MacroLogEntry[];
              const confirmed = entries.filter((e) => e.confirmed);

              const totals = confirmed.reduce(
                (acc, e) => ({
                  calories: acc.calories + e.calories,
                  protein: acc.protein + e.protein,
                  carbs: acc.carbs + e.carbs,
                  fat: acc.fat + e.fat,
                  fibre: 0,
                }),
                { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 }
              );

              const targetsRaw = localStorage.getItem(STORAGE_KEYS.MACRO_TARGETS);
              let targets = { ...defaultTargets };
              if (targetsRaw) {
                try {
                  targets = JSON.parse(targetsRaw);
                } catch {
                  // Use defaults
                }
              }

              let deviation: string | undefined;
              const calDiff = ((totals.calories - targets.calories) / targets.calories) * 100;
              if (Math.abs(calDiff) > 20) {
                deviation = calDiff > 0 ? 'Over target by >20%' : 'Under target by >20%';
              } else if (Math.abs(calDiff) > 10) {
                deviation = calDiff > 0 ? 'Over target by 10-20%' : 'Under target by 10-20%';
              }

              macroLogs.push({ date: dayKey, logged: true, entries, totals, targets, deviation });
            } catch {
              // Key existed but data was corrupt — logged: true, zeroed totals
              macroLogs.push({ date: dayKey, logged: true, entries: [], totals: { ...zeroTotals }, targets: { ...defaultTargets } });
            }
          } else {
            // Both keys absent — no interaction with food tab this day
            macroLogs.push({ date: dayKey, logged: false, entries: [], totals: { ...zeroTotals }, targets: { ...defaultTargets } });
          }
        }
      }

      return macroLogs;
    })(),

    food: (() => {
      const last7Days: Array<{
        date: string;
        logged: boolean;
        mealCount: number;
        onPlanCount: number;
        deviationCount: number;
        skippedCount: number;
        unloggedCount: number;
        fastingHours: number | null;
        dailyTotals: { calories: number; protein: number; carbs: number; fat: number; fibre: number };
      }> = [];
      
      const today = new Date();
      
      for (let i = 0; i < 7; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() - i);
        const yyyy = checkDate.getFullYear();
        const mm = String(checkDate.getMonth() + 1).padStart(2, '0');
        const dd = String(checkDate.getDate()).padStart(2, '0');
        const dayKey = `${yyyy}-${mm}-${dd}`;
        
        const foodLogKey = `${STORAGE_KEYS.FOOD_LOG}_${dayKey}`;
        const macroKey = `${STORAGE_KEYS.MACRO_LOG}_${dayKey}`;
        
        let raw = localStorage.getItem(foodLogKey);
        
        if (raw) {
          try {
            const log = JSON.parse(raw);
            const mealCount = log.meals?.length ?? 0;
            const onPlanCount = log.meals?.filter((m: any) => m.status === 'plan').length || 0;
            const deviationCount = log.meals?.filter((m: any) => m.status === 'deviation').length || 0;
            const skippedCount = log.meals?.filter((m: any) => m.status === 'skipped').length || 0;
            const unloggedCount = log.meals?.filter((m: any) => m.status === 'unlogged').length || 0;

            // Cross-day fasting: gap between last meal of previous day and first of this day
            let fastingHours: number | null = null;
            if (i === 0) {
              const prevDate = new Date(today);
              prevDate.setDate(today.getDate() - 1);
              const prevKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(prevDate.getDate()).padStart(2, '0')}`;
              fastingHours = getCrossDayFasting(dayKey, prevKey).hours;
            }

            last7Days.push({
              date: dayKey,
              logged: true,
              mealCount,
              onPlanCount,
              deviationCount,
              skippedCount,
              unloggedCount,
              fastingHours,
              dailyTotals: log.dailyTotals || { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 },
            });
          } catch {
            // Key existed but data was corrupt — logged: true
            last7Days.push({
              date: dayKey,
              logged: true,
              mealCount: 0,
              onPlanCount: 0,
              deviationCount: 0,
              skippedCount: 0,
              unloggedCount: 0,
              fastingHours: null,
              dailyTotals: { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 },
            });
          }
        } else {
          raw = localStorage.getItem(macroKey);
          if (raw) {
            try {
              const entries = JSON.parse(raw) as MacroLogEntry[];
              const confirmed = entries.filter((e) => e.confirmed);
              const dailyTotals = confirmed.reduce(
                (acc, e) => ({
                  calories: acc.calories + e.calories,
                  protein: acc.protein + e.protein,
                  carbs: acc.carbs + e.carbs,
                  fat: acc.fat + e.fat,
                  fibre: 0,
                }),
                { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 }
              );

              last7Days.push({
                date: dayKey,
                logged: true,
                mealCount: confirmed.length,
                onPlanCount: confirmed.length,
                deviationCount: 0,
                skippedCount: 0,
                unloggedCount: 0,
                fastingHours: null,
                dailyTotals,
              });
            } catch {
              // Key existed but data was corrupt — logged: true
              last7Days.push({
                date: dayKey,
                logged: true,
                mealCount: 0,
                onPlanCount: 0,
                deviationCount: 0,
                skippedCount: 0,
                unloggedCount: 0,
                fastingHours: null,
                dailyTotals: { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 },
              });
            }
          } else {
            // Both keys absent — no interaction with food tab this day
            last7Days.push({
              date: dayKey,
              logged: false,
              mealCount: 0,
              onPlanCount: 0,
              deviationCount: 0,
              skippedCount: 0,
              unloggedCount: 0,
              fastingHours: null,
              dailyTotals: { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 },
            });
          }
        }
      }
      
      const todayData = last7Days[0];
      
      const targetsRaw = localStorage.getItem(STORAGE_KEYS.MACRO_TARGETS);
      let targets = { calories: 1435, protein: 116.5 };
      if (targetsRaw) {
        try {
          const parsed = JSON.parse(targetsRaw);
          targets = { calories: parsed.calories || 1435, protein: parsed.protein || 116.5 };
        } catch {
          // Use defaults
        }
      }
      
      const vsTargets = {
        caloriesPct: targets.calories > 0 ? Math.round((todayData.dailyTotals.calories / targets.calories) * 100) : 0,
        proteinPct: targets.protein > 0 ? Math.round((todayData.dailyTotals.protein / targets.protein) * 100) : 0,
      };
      
      return {
        dailyTotals: todayData.dailyTotals,
        vsTargets,
        fastingHours: todayData.fastingHours,
        onPlanCount: todayData.onPlanCount,
        deviationCount: todayData.deviationCount,
        skippedCount: todayData.skippedCount,
        unloggedCount: todayData.unloggedCount,
        last7Days,
      };
    })(),

    specialists: (() => {
      const raw = localStorage.getItem(STORAGE_KEYS.SPECIALIST_ACTIONS);
      if (!raw) return { overdue: [], booked: [] };

      try {
        const actions = JSON.parse(raw) as Array<{
          name: string;
          status: string;
          dueDate: string | null;
          bookedDate: string | null;
        }>;

        const today = new Date();
        const overdue = actions
          .filter(a => a.status === 'pending')
          .map(a => ({
            name: a.name,
            daysOverdue: a.dueDate
              ? Math.floor((today.getTime() - new Date(a.dueDate).getTime()) / (1000 * 60 * 60 * 24))
              : 'unknown',
          }));

        const booked = actions.filter(a => a.status === 'booked' || a.status === 'completed');

        return { overdue, booked };
      } catch {
        return null;
      }
    })(),

    // Populated by: Field tab - field actions and confidence ratings
    field: (() => {
      const actionsRaw = localStorage.getItem(STORAGE_KEYS.FIELD_LOG_ACTIONS);
      const outcomesRaw = localStorage.getItem(STORAGE_KEYS.FIELD_LOG);
      
      if (!outcomesRaw) {
        return {
          actionsInLibrary: actionsRaw ? JSON.parse(actionsRaw).filter((a: any) => !a.isArchived).length : 0,
          outcomesThisWeek: 0,
          lastFiveOutcomes: [],
          weeklyActionTarget: 2,
          complianceStatus: 'red',
        };
      }
      
      try {
        const actions = actionsRaw ? JSON.parse(actionsRaw) : [];
        const outcomes = JSON.parse(outcomesRaw) as Array<{
          id: string;
          actionId: string;
          date: string;
          actionTaken: string;
          context: string;
          outcome: string;
          confidenceRating: number;
          patternObserved: string;
          loggedAt: string;
        }>;
        
        const today = new Date();
        const weekAgo = new Date(today);
        weekAgo.setDate(today.getDate() - 7);
        
        const outcomesThisWeek = outcomes.filter((o) => {
          const loggedDate = new Date(o.loggedAt);
          return loggedDate >= weekAgo && loggedDate <= today;
        }).length;
        
        const sortedOutcomes = [...outcomes].sort((a, b) => 
          new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime()
        );
        
        const lastFiveOutcomes = sortedOutcomes.slice(0, 5).map((o) => {
          const action = actions.find((a: any) => a.id === o.actionId);
          return {
            actionName: action?.name || 'Unknown',
            layer: action?.layer || 0,
            patternObserved: o.patternObserved,
            confidenceRating: o.confidenceRating,
            date: o.date,
          };
        });
        
        const complianceStatus = outcomesThisWeek >= 2 ? 'green' : outcomesThisWeek === 1 ? 'amber' : 'red';
        
        return {
          actionsInLibrary: actions.filter((a: any) => !a.isArchived).length,
          outcomesThisWeek,
          lastFiveOutcomes,
          weeklyActionTarget: 2,
          complianceStatus,
        };
      } catch {
        return {
          actionsInLibrary: 0,
          outcomesThisWeek: 0,
          lastFiveOutcomes: [],
          weeklyActionTarget: 2,
          complianceStatus: 'red',
        };
      }
    })(),

    // Populated by: Learn tab - material library
    learn: (() => {
      const raw = localStorage.getItem(STORAGE_KEYS.LEARN_MATERIALS);
      
      if (!raw) {
        return {
          totalMaterials: 0,
          materialsByLayer: {},
          recentUploads: [],
          materialsByMode: {},
        };
      }
      
      try {
        const materials = JSON.parse(raw) as Array<{
          id: string;
          fileName: string;
          whyUploaded: string;
          whatYouWant: string;
          layerServed: number;
          modesTagged: string[];
          uploadedAt: string;
          isArchived: boolean;
        }>;
        
        const activeMaterials = materials.filter((m) => !m.isArchived);
        
        const materialsByLayer = activeMaterials.reduce((acc, m) => {
          if (!acc[m.layerServed]) acc[m.layerServed] = [];
          acc[m.layerServed].push(m);
          return acc;
        }, {} as Record<number, any[]>);
        
        const sortedMaterials = [...activeMaterials].sort((a, b) => 
          new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
        );
        
        const recentUploads = sortedMaterials.slice(0, 5).map((m) => ({
          fileName: m.fileName,
          whyUploaded: m.whyUploaded,
          whatYouWant: m.whatYouWant,
          layerServed: m.layerServed,
          modesTagged: m.modesTagged,
          uploadedAt: m.uploadedAt,
        }));
        
        const materialsByMode = activeMaterials.reduce((acc, m) => {
          m.modesTagged.forEach((mode) => {
            if (!acc[mode]) acc[mode] = [];
            acc[mode].push(m);
          });
          return acc;
        }, {} as Record<string, any[]>);
        
        return {
          totalMaterials: activeMaterials.length,
          materialsByLayer,
          recentUploads,
          materialsByMode,
        };
      } catch {
        return {
          totalMaterials: 0,
          materialsByLayer: {},
          recentUploads: [],
          materialsByMode: {},
        };
      }
    })(),

    stage: (() => {
      const stageData = getStageData();
      const latest = getLatestBodyStats();

      return {
        currentStage: stageData.currentStage,
        currentStageName: stageData.stages.find(s => s.number === stageData.currentStage)?.name || 'Build',
        workReadiness: stageData.workReadiness,
        unlockConditions: stageData.stages[0].unlockConditions,
        currentStats: latest ? {
          weight: latest.weight,
          bodyFat: latest.bodyFat,
          waist: latest.waist,
        } : null,
      };
    })(),

    dailyNotes: (() => {
      const notes: Array<{ date: string; note: string }> = [];
      const today = new Date();
      for (let i = 0; i < 7; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() - i);
        const dayKey = getGrndDayKey(checkDate);
        const raw = localStorage.getItem(`grnd_daily_note_${dayKey}`);
        if (raw && raw.trim()) {
          notes.push({ date: dayKey, note: raw.trim() });
        }
      }
      return notes.length > 0 ? notes : null;
    })(),

    priorities: (() => {
      const signals: PrioritySignal[] = [];
      const snap = compliance;

      const foundationItems = ['sleep', 'macros', 'checklist'];
      const streamKeys = ['checklist', 'sleep', 'mood', 'gym', 'macros', 'body', 'specialists', 'field'] as const;

      const observationText: Record<string, (value: number | string) => string> = {
        'Checklist': (v) => `Checklist completion is at ${v}%`,
        'Sleep': (v) => `Sleep logged ${v} hours average`,
        'Mood': (v) => `Mood and energy — ${v}`,
        'Gym': (v) => `Gym sessions this week: ${v}`,
        'Macros': (v) => `Macros at ${v}% of target`,
        'Body Stats': (v) => `Body stats last logged ${v} days ago`,
        'Specialists': (v) => `${v} specialist actions overdue`,
        'Field Actions': (v) => `Field actions — ${v}`,
      };

      streamKeys.forEach(key => {
        const stream = snap[key];
        if (!stream) return;

        if (stream.status === 'red' || stream.status === 'amber') {
          const obs = observationText[stream.name]
            ? observationText[stream.name](stream.value)
            : `${stream.name} is ${stream.status} — ${stream.value}`;
          signals.push({
            exists: true,
            item: stream.name,
            observation: obs,
            daysCount: typeof stream.value === 'number' ? stream.value : 0,
            layer: foundationItems.includes(key) ? 'foundation' : 'tracking',
            threshold: stream.status === 'red' ? 1 : 0.6,
          });
        }
      });

      signals.sort((a, b) => {
        const aIsFoundation = a.layer === 'foundation' ? 1 : 0;
        const bIsFoundation = b.layer === 'foundation' ? 1 : 0;
        const aIsRed = a.threshold === 1 ? 1 : 0;
        const bIsRed = b.threshold === 1 ? 1 : 0;
        return (bIsFoundation + bIsRed) - (aIsFoundation + aIsRed);
      });

      return signals.slice(0, 1);
    })(),

    // Phase mode detection
    phaseMode: (() => {
      const today = new Date();
      const todayYyyy = today.getFullYear();
      const todayMm = String(today.getMonth() + 1).padStart(2, '0');
      const todayDd = String(today.getDate()).padStart(2, '0');
      const todayKey = `${todayYyyy}-${todayMm}-${todayDd}`;
      
      // Check sleep compliance - in bed by 8:30pm
      const sleepKey = `${STORAGE_KEYS.SLEEP_LOG}_${todayKey}`;
      const sleepRaw = localStorage.getItem(sleepKey);
      let sleepCompliant = false;
      if (sleepRaw) {
        try {
          const sleepData = JSON.parse(sleepRaw);
          const bedTime = sleepData.bedTime || '';
          const [hours, minutes] = bedTime.split(':').map(Number);
          if (hours < 20 || (hours === 20 && minutes <= 30)) {
            sleepCompliant = true;
          }
        } catch {
          // Sleep not logged
        }
      }
      
      // Check food logged - any macro entry
      const macroKey = `${STORAGE_KEYS.MACRO_LOG}_${todayKey}`;
      const macroRaw = localStorage.getItem(macroKey);
      let foodLogged = false;
      if (macroRaw) {
        try {
          const entries = JSON.parse(macroRaw) as MacroLogEntry[];
          foodLogged = entries.length > 0;
        } catch {
          // No food logged
        }
      }
      
      // Check simran completed
      const checklistKey = `${STORAGE_KEYS.CHECKLIST_COMPLETION}_${todayKey}`;
      const checklistRaw = localStorage.getItem(checklistKey);
      let simranCompleted = false;
      if (checklistRaw) {
        try {
          const completion = JSON.parse(checklistRaw);
          const completedIds = completion.completedIds || [];
          simranCompleted = completedIds.includes('simran-1830');
        } catch {
          // Checklist not completed
        }
      }
      
      // Check hygiene - shower or skincare
      let hygieneCompleted = false;
      if (checklistRaw) {
        try {
          const completion = JSON.parse(checklistRaw);
          const completedIds = completion.completedIds || [];
          const hygieneItems = ['shower-am', 'shower-pm-1810', 'skincare-am', 'skincare-pm-2000'];
          hygieneCompleted = hygieneItems.some(id => completedIds.includes(id));
        } catch {
          // Hygiene not completed
        }
      }
      
      // Phase detection
      return detectPhaseMode(sleepCompliant, foodLogged, simranCompleted, hygieneCompleted);
    })(),
  };
}
