// Phase 3b - Coach Context Layer
// Scaffolds data structures and context functions for Coach integration

import { detectPhaseMode } from './phaseMode';

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
  STAGE_DATA: 'grnd_stage_data',
  MILESTONES: 'grnd_milestones',
  EDIT_HISTORY: 'grnd_edit_history',
  MOOD_CAUSES: 'grnd_mood_causes',
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
  const todayYyyy = today.getFullYear();
  const todayMm = String(today.getMonth() + 1).padStart(2, '0');
  const todayDd = String(today.getDate()).padStart(2, '0');
  const todayKey = `${todayYyyy}-${todayMm}-${todayDd}`;
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
    const yyyy = checkDate.getFullYear();
    const mm = String(checkDate.getMonth() + 1).padStart(2, '0');
    const dd = String(checkDate.getDate()).padStart(2, '0');
    const dayKey = `${yyyy}-${mm}-${dd}`;
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
    // Will check: Daily completion rate from grnd_checklist_YYYY-MM-DD
    checklist: null,

    // Will check: Sleep duration, quality, consistency from grnd_sleep_log
    sleep: null,

    // Checks: Last 7 days of mood logging - green if 6+, amber if 4-5, red if <4
    mood: moodCompliance,

    // Will check: Session frequency, injury status, effort consistency from grnd_gym_log
    gym: null,

    // Will check: Weight trend, body fat trend, waist measurement from grnd_body_log
    body: null,

    // Checks: Last 7 days of macro logging - green if 6+ days with 3+ meals confirmed, amber if 4-5 days, red if <4 days
    macros: (() => {
      let daysWithLogging = 0;
      const today = new Date();
      
      for (let i = 0; i < 7; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() - i);
        const yyyy = checkDate.getFullYear();
        const mm = String(checkDate.getMonth() + 1).padStart(2, '0');
        const dd = String(checkDate.getDate()).padStart(2, '0');
        const dayKey = `${yyyy}-${mm}-${dd}`;
        const macroKey = `${STORAGE_KEYS.MACRO_LOG}_${dayKey}`;
        
        const raw = localStorage.getItem(macroKey);
        if (raw) {
          try {
            const entries = JSON.parse(raw) as MacroLogEntry[];
            const confirmedCount = entries.filter((e) => e.confirmed).length;
            if (confirmedCount >= 3) {
              daysWithLogging++;
            }
          } catch {
            // Skip invalid entries
          }
        }
      }
      
      if (daysWithLogging >= 6) {
        return { name: 'Macro Logging', status: 'green', value: `${daysWithLogging}/7 days`, threshold: '6+ days' };
      } else if (daysWithLogging >= 4) {
        return { name: 'Macro Logging', status: 'amber', value: `${daysWithLogging}/7 days`, threshold: '6+ days' };
      } else {
        return { name: 'Macro Logging', status: 'red', value: `${daysWithLogging}/7 days`, threshold: '6+ days' };
      }
    })(),

    // Will check: Pending specialist actions, overdue bookings from grnd_specialist_actions
    specialists: null,

    // Will check: Field action frequency, confidence trends from grnd_field_log
    field: null,
  };
}

// Coach Context Function
// Aggregates all data streams into a single context object for Coach
export function getCoachContext(): {
  compliance: ReturnType<typeof getComplianceSnapshot>;
  checklist: any;
  sleep: any;
  mood: any;
  gym: any;
  body: any;
  macros: any;
  specialists: any;
  field: any;
  stage: any;
  priorities: PrioritySignal[];
  phaseMode: {
    active: boolean;
    dayCount: number;
    nonNegotiablesMissed: string[];
    lastCheckin: string;
  };
} {
  const compliance = getComplianceSnapshot();

  // Load last 7 days of mood logs (array structure)
  const moodLogs: Array<{ date: string; entries: MoodLogEntry[] }> = [];
  const today = new Date();
  
  for (let i = 0; i < 7; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(today.getDate() - i);
    const yyyy = checkDate.getFullYear();
    const mm = String(checkDate.getMonth() + 1).padStart(2, '0');
    const dd = String(checkDate.getDate()).padStart(2, '0');
    const dayKey = `${yyyy}-${mm}-${dd}`;
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

  return {
    compliance,

    // Populated by: Today tab - checklist structure and completion data
    checklist: null,

    // Populated by: Today tab - sleep check-in data
    sleep: null,

    // Populated by: Today tab - mood/energy logging (Phase 3b Step 2)
    mood: moodLogs,

    // Populated by: Gym tab - session logs, exercises, injuries
    gym: null,

    // Populated by: Review tab - body metrics tracking
    body: null,

    // Populated by: Today tab - macro tracking (Phase 3b Step 4)
    macros: (() => {
      const macroLogs: Array<{ date: string; entries: MacroLogEntry[]; totals: { calories: number; protein: number; carbs: number; fat: number }; targets: { calories: number; protein: number; carbs: number; fat: number }; deviation?: string }> = [];
      const today = new Date();
      
      for (let i = 0; i < 7; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() - i);
        const yyyy = checkDate.getFullYear();
        const mm = String(checkDate.getMonth() + 1).padStart(2, '0');
        const dd = String(checkDate.getDate()).padStart(2, '0');
        const dayKey = `${yyyy}-${mm}-${dd}`;
        const macroKey = `${STORAGE_KEYS.MACRO_LOG}_${dayKey}`;
        
        const raw = localStorage.getItem(macroKey);
        if (raw) {
          try {
            const entries = JSON.parse(raw) as MacroLogEntry[];
            const confirmed = entries.filter((e) => e.confirmed);
            
            const totals = confirmed.reduce(
              (acc, e) => ({
                calories: acc.calories + e.calories,
                protein: acc.protein + e.protein,
                carbs: acc.carbs + e.carbs,
                fat: acc.fat + e.fat,
              }),
              { calories: 0, protein: 0, carbs: 0, fat: 0 }
            );
            
            const targetsRaw = localStorage.getItem(STORAGE_KEYS.MACRO_TARGETS);
            let targets = { calories: 1435, protein: 116.5, carbs: 102.2, fat: 57.9 };
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
            
            macroLogs.push({ date: dayKey, entries, totals, targets, deviation });
          } catch {
            // Skip invalid entries
          }
        }
      }
      
      return macroLogs;
    })(),

    // Populated by: Review tab - specialist actions and outcomes
    specialists: null,

    // Populated by: Field tab - field actions and confidence ratings
    field: null,

    // Populated by: Review tab - stage progression data
    stage: null,

    // Populated by: Cross-tab analysis - priority signals from all streams
    priorities: [],

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
