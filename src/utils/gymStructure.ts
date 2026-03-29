export type DayType = 'push' | 'pull' | 'legs' | 'rest';
export type InjuryFlag = 'right_shoulder' | 'right_elbow' | 'left_knee' | 'right_knee';

export interface Exercise {
  id: string;
  name: string;
  setsTarget: number;
  injuryFlags: InjuryFlag[];
  why: string;
}

export interface GymProgram {
  push: Exercise[];
  pull: Exercise[];
  legs: Exercise[];
}

export interface SetLog {
  setNumber: number;
  reps: number;
  kg: number;
  completed: boolean;
}

export interface ExerciseLog {
  name: string;
  injuryFlags: InjuryFlag[];
  sets: SetLog[];
}

export interface InjuryCheckIn {
  name: string;
  painLevel: number | null;
  affectedBySession: boolean;
  exercises: string[];
  notes: string;
}

export interface GymSession {
  date: string;
  dayType: DayType;
  energyRating: number;
  exercises: ExerciseLog[];
  injuries?: InjuryCheckIn[];
}

const STORAGE_KEY = 'grnd_gym_structure';
const LOG_KEY = 'grnd_gym_log';

export const DEFAULT_GYM_PROGRAM: GymProgram = {
  push: [
    {
      id: 'push-1',
      name: 'KB Flat Chest Press',
      setsTarget: 3,
      injuryFlags: ['right_shoulder'],
      why: 'Primary chest builder with kettlebell stability challenge',
    },
    {
      id: 'push-2',
      name: 'Upside Down KB Shoulder Press',
      setsTarget: 3,
      injuryFlags: ['right_shoulder'],
      why: 'Overhead pressing strength and shoulder stability',
    },
    {
      id: 'push-3',
      name: 'Incline DB Chest Press',
      setsTarget: 3,
      injuryFlags: ['right_shoulder'],
      why: 'Upper chest development and balanced pressing',
    },
    {
      id: 'push-4',
      name: 'Face Pulls',
      setsTarget: 3,
      injuryFlags: [],
      why: 'Rear delt health and shoulder balance',
    },
    {
      id: 'push-5',
      name: 'KB Overhead Tricep Extensions',
      setsTarget: 3,
      injuryFlags: ['right_elbow'],
      why: 'Tricep long head development',
    },
    {
      id: 'push-6',
      name: 'Rope Tricep Extensions',
      setsTarget: 3,
      injuryFlags: ['right_elbow'],
      why: 'Tricep isolation and arm definition',
    },
  ],
  pull: [
    {
      id: 'pull-1',
      name: 'V-Grip Pulldown',
      setsTarget: 3,
      injuryFlags: [],
      why: 'Lat width and upper back thickness',
    },
    {
      id: 'pull-2',
      name: 'Seated Bilateral Row',
      setsTarget: 3,
      injuryFlags: [],
      why: 'Mid-back thickness and posture',
    },
    {
      id: 'pull-3',
      name: 'Wide Grip Pulldown',
      setsTarget: 3,
      injuryFlags: [],
      why: 'Lat width emphasis',
    },
    {
      id: 'pull-4',
      name: 'BB Bent Over Row',
      setsTarget: 3,
      injuryFlags: ['right_elbow'],
      why: 'Overall back mass and strength',
    },
    {
      id: 'pull-5',
      name: 'Incline DB Bicep Curls',
      setsTarget: 3,
      injuryFlags: [],
      why: 'Bicep long head stretch and growth',
    },
    {
      id: 'pull-6',
      name: 'Standing BB Curls',
      setsTarget: 3,
      injuryFlags: ['right_elbow'],
      why: 'Overall bicep mass',
    },
    {
      id: 'pull-7',
      name: 'Hammer DB Curls',
      setsTarget: 3,
      injuryFlags: [],
      why: 'Brachialis and forearm development',
    },
  ],
  legs: [
    {
      id: 'legs-1',
      name: 'Seated Hip Abductions',
      setsTarget: 3,
      injuryFlags: [],
      why: 'Glute activation and hip stability',
    },
    {
      id: 'legs-2',
      name: 'Leg Press',
      setsTarget: 3,
      injuryFlags: ['right_knee', 'left_knee'],
      why: 'Quad and glute strength without spinal load',
    },
    {
      id: 'legs-3',
      name: 'Reverse Lunge into High Knee',
      setsTarget: 3,
      injuryFlags: ['right_knee', 'left_knee'],
      why: 'Unilateral leg strength and balance',
    },
    {
      id: 'legs-4',
      name: 'Seated Leg Curls',
      setsTarget: 3,
      injuryFlags: [],
      why: 'Hamstring isolation and knee health',
    },
    {
      id: 'legs-5',
      name: 'Seated Leg Extensions',
      setsTarget: 3,
      injuryFlags: [],
      why: 'Quad isolation and VMO development',
    },
    {
      id: 'legs-6',
      name: 'Standing Calf Raises',
      setsTarget: 3,
      injuryFlags: [],
      why: 'Gastrocnemius development',
    },
    {
      id: 'legs-7',
      name: 'Seated Calf Raises',
      setsTarget: 3,
      injuryFlags: [],
      why: 'Soleus development and calf balance',
    },
  ],
};

export function getGymProgram(): GymProgram {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // If parse fails, save and return defaults
      saveGymProgram(DEFAULT_GYM_PROGRAM);
      return DEFAULT_GYM_PROGRAM;
    }
  }
  // First time - save defaults
  saveGymProgram(DEFAULT_GYM_PROGRAM);
  return DEFAULT_GYM_PROGRAM;
}

export function saveGymProgram(program: GymProgram): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(program));
}

export function getGymSessions(): GymSession[] {
  const stored = localStorage.getItem(LOG_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }
  return [];
}

export function saveGymSession(session: GymSession): void {
  const sessions = getGymSessions();
  sessions.push(session);
  localStorage.setItem(LOG_KEY, JSON.stringify(sessions));
}

export function getLastSessionForDayType(dayType: DayType): GymSession | null {
  const sessions = getGymSessions();
  const filtered = sessions.filter((s) => s.dayType === dayType);
  if (filtered.length === 0) return null;
  // Return most recent
  return filtered[filtered.length - 1];
}

export function getInjuryFlagLabel(flag: InjuryFlag): string {
  switch (flag) {
    case 'right_shoulder':
      return 'Right Shoulder';
    case 'right_elbow':
      return 'Right Elbow';
    case 'left_knee':
      return 'Left Knee';
    case 'right_knee':
      return 'Right Knee';
  }
}
