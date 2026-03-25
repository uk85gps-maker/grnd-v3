// Phase 3b - Coach Context Layer
// Scaffolds data structures and context functions for Coach integration

export const STORAGE_KEYS = {
  CHECKLIST_STRUCTURE: 'grnd_checklist_structure',
  CHECKLIST_COMPLETION: 'grnd_checklist',
  SLEEP_LOG: 'grnd_sleep_log',
  MOOD_LOG: 'grnd_mood_log',
  GYM_LOG: 'grnd_gym_log',
  BODY_LOG: 'grnd_body_log',
  MACRO_LOG: 'grnd_macro_log',
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
  return {
    // Will check: Daily completion rate from grnd_checklist_YYYY-MM-DD
    checklist: null,

    // Will check: Sleep duration, quality, consistency from grnd_sleep_log
    sleep: null,

    // Will check: Energy/mood trends, negative cause patterns from grnd_mood_log
    mood: null,

    // Will check: Session frequency, injury status, effort consistency from grnd_gym_log
    gym: null,

    // Will check: Weight trend, body fat trend, waist measurement from grnd_body_log
    body: null,

    // Will check: Protein target hit rate, calorie deviation patterns from grnd_macro_log
    macros: null,

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
} {
  const compliance = getComplianceSnapshot();

  return {
    compliance,

    // Populated by: Today tab - checklist structure and completion data
    checklist: null,

    // Populated by: Today tab - sleep check-in data
    sleep: null,

    // Populated by: Today tab - mood/energy logging (Phase 3b Step 2)
    mood: null,

    // Populated by: Gym tab - session logs, exercises, injuries
    gym: null,

    // Populated by: Review tab - body metrics tracking
    body: null,

    // Populated by: Today tab - macro tracking (Phase 3b Step 4)
    macros: null,

    // Populated by: Review tab - specialist actions and outcomes
    specialists: null,

    // Populated by: Field tab - field actions and confidence ratings
    field: null,

    // Populated by: Review tab - stage progression data
    stage: null,

    // Populated by: Cross-tab analysis - priority signals from all streams
    priorities: [],
  };
}
