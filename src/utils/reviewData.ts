export interface BodyLogEntry {
  date: string;
  weight?: number;
  bodyFat?: number;
  waist?: number;
  restingHR?: number;
  systolic?: number;
  diastolic?: number;
}

export interface BloodMarker {
  name: string;
  value: number;
  unit: string;
  date: string;
  optimalMin: number;
  optimalMax: number;
  normalMin: number;
  normalMax: number;
  tier: 1 | 2;
}

export interface PyramidLayer {
  id: number;
  name: string;
  status: 'stable' | 'building' | 'cracking' | 'broken';
  activeActions: string;
  evidence: string;
}

export interface StageData {
  currentStage: number;
  stages: {
    number: number;
    name: string;
    unlockConditions: {
      weight?: number;
      bodyFat?: number;
      waist?: number;
      gymConsistency?: number;
    };
    unlocked: boolean;
  }[];
  workReadiness: {
    endurance: number;
    mobility: number;
    lowerBodyStrength: number;
    upperBodyStrength: number;
    gripArmEndurance: number;
    coreStability: number;
  };
}

export interface PeerComparison {
  fit40: {
    weight: number;
    bodyFat: number;
    waist: number;
    restingHR: number;
  };
  elite40: {
    weight: number;
    bodyFat: number;
    waist: number;
    restingHR: number;
  };
}

const STORAGE_KEYS = {
  BODY_LOG: 'grnd_body_log',
  BLOOD_RESULTS: 'grnd_blood_results',
  STAGE_DATA: 'grnd_stage_data',
  PEER_COMPARISON: 'grnd_peer_comparison',
};

const DEFAULT_PYRAMID: PyramidLayer[] = [
  { id: 1, name: 'Foundation — Gym & Diet', status: 'building', activeActions: '', evidence: '' },
  { id: 2, name: 'Sleep', status: 'building', activeActions: '', evidence: '' },
  { id: 3, name: 'Daily Routine', status: 'building', activeActions: '', evidence: '' },
  { id: 4, name: 'Medical', status: 'building', activeActions: '', evidence: '' },
  { id: 5, name: 'Income & Direction', status: 'building', activeActions: '', evidence: '' },
  { id: 6, name: 'Physical Product', status: 'building', activeActions: '', evidence: '' },
  { id: 7, name: 'Presence', status: 'building', activeActions: '', evidence: '' },
  { id: 8, name: 'Inner Game', status: 'building', activeActions: '', evidence: '' },
  { id: 9, name: 'Reputation & World', status: 'building', activeActions: '', evidence: '' },
  { id: 10, name: 'The Man', status: 'building', activeActions: '', evidence: '' },
];

const DEFAULT_STAGE_DATA: StageData = {
  currentStage: 1,
  stages: [
    {
      number: 1,
      name: 'Build',
      unlockConditions: {
        weight: 75,
        bodyFat: 20,
        waist: 86,
        gymConsistency: 80,
      },
      unlocked: true,
    },
    {
      number: 2,
      name: 'Strength',
      unlockConditions: {},
      unlocked: false,
    },
    {
      number: 3,
      name: 'Athletic',
      unlockConditions: {},
      unlocked: false,
    },
    {
      number: 4,
      name: 'Combat Ready',
      unlockConditions: {},
      unlocked: false,
    },
    {
      number: 5,
      name: 'Complete Man',
      unlockConditions: {},
      unlocked: false,
    },
  ],
  workReadiness: {
    endurance: 0,
    mobility: 0,
    lowerBodyStrength: 0,
    upperBodyStrength: 0,
    gripArmEndurance: 0,
    coreStability: 0,
  },
};

const DEFAULT_PEER_COMPARISON: PeerComparison = {
  fit40: {
    weight: 75,
    bodyFat: 18,
    waist: 86,
    restingHR: 60,
  },
  elite40: {
    weight: 70,
    bodyFat: 12,
    waist: 80,
    restingHR: 50,
  },
};

export function getBodyLog(): BodyLogEntry[] {
  const stored = localStorage.getItem(STORAGE_KEYS.BODY_LOG);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }
  return [];
}

export function saveBodyLogEntry(entry: BodyLogEntry): void {
  const log = getBodyLog();
  log.push(entry);
  localStorage.setItem(STORAGE_KEYS.BODY_LOG, JSON.stringify(log));
}

export function getLatestBodyStats(): BodyLogEntry | null {
  const log = getBodyLog();
  if (log.length === 0) return null;
  return log[log.length - 1];
}

export function getBloodResults(): BloodMarker[] {
  const stored = localStorage.getItem(STORAGE_KEYS.BLOOD_RESULTS);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }
  return [];
}

export function saveBloodResults(results: BloodMarker[]): void {
  localStorage.setItem(STORAGE_KEYS.BLOOD_RESULTS, JSON.stringify(results));
}

export function getStageData(): StageData {
  const stored = localStorage.getItem(STORAGE_KEYS.STAGE_DATA);
  if (stored) {
    try {
      const data = JSON.parse(stored);
      // Ensure pyramid exists
      if (!data.pyramid) {
        data.pyramid = DEFAULT_PYRAMID;
      } else {
        // Migrate pyramid layers if names have changed, preserving user data
        const migratedPyramid = DEFAULT_PYRAMID.map((defaultLayer) => {
          const existingLayer = data.pyramid.find((l: PyramidLayer) => l.id === defaultLayer.id);
          if (existingLayer) {
            return {
              ...defaultLayer,
              status: existingLayer.status,
              activeActions: existingLayer.activeActions,
              evidence: existingLayer.evidence,
            };
          }
          return defaultLayer;
        });
        data.pyramid = migratedPyramid;
      }
      saveStageData(data);
      return data;
    } catch {
      const data = { ...DEFAULT_STAGE_DATA, pyramid: DEFAULT_PYRAMID };
      saveStageData(data);
      return data;
    }
  }
  const data = { ...DEFAULT_STAGE_DATA, pyramid: DEFAULT_PYRAMID };
  saveStageData(data);
  return data;
}

export function saveStageData(data: StageData & { pyramid?: PyramidLayer[] }): void {
  localStorage.setItem(STORAGE_KEYS.STAGE_DATA, JSON.stringify(data));
}

export function getPyramidLayers(): PyramidLayer[] {
  const stageData = getStageData() as StageData & { pyramid?: PyramidLayer[] };
  return stageData.pyramid || DEFAULT_PYRAMID;
}

export function savePyramidLayers(layers: PyramidLayer[]): void {
  const stageData = getStageData() as StageData & { pyramid?: PyramidLayer[] };
  stageData.pyramid = layers;
  saveStageData(stageData);
}

export function getPeerComparison(): PeerComparison {
  const stored = localStorage.getItem(STORAGE_KEYS.PEER_COMPARISON);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      savePeerComparison(DEFAULT_PEER_COMPARISON);
      return DEFAULT_PEER_COMPARISON;
    }
  }
  savePeerComparison(DEFAULT_PEER_COMPARISON);
  return DEFAULT_PEER_COMPARISON;
}

export function savePeerComparison(data: PeerComparison): void {
  localStorage.setItem(STORAGE_KEYS.PEER_COMPARISON, JSON.stringify(data));
}
