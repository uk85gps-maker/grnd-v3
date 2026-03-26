export interface PortraitMemory {
  name: string;
  age: number;
  height: string;
  weight: string;
  goalWeight: string;
  injuries: string;
  faith: string;
  relationshipStatus: string;
  career: string;
  trainingStage: string;
  keyPerson: string;
  goals: string;
  notes: string;
}

const DEFAULT_PORTRAIT: PortraitMemory = {
  name: 'Gurpreet Singh',
  age: 40,
  height: '175cm',
  weight: '78kg',
  goalWeight: '70kg',
  injuries: 'Right shoulder, right elbow, both knees',
  faith: 'Sikh, daily practice, turban',
  relationshipStatus: 'Separation, divorce final June 2026',
  career: 'Electrical wholesaler, SEO work, income under $60k, parked until May',
  trainingStage: 'Stage 1',
  keyPerson: 'Uncle, top decision-making authority',
  goals: '70kg, waist under 90cm, combat ready',
  notes: '',
};

const STORAGE_KEY = 'grnd_portrait_memory';

export function getPortraitMemory(): PortraitMemory {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored) as PortraitMemory;
    } catch {
      return DEFAULT_PORTRAIT;
    }
  }
  return DEFAULT_PORTRAIT;
}

export function savePortraitMemory(portrait: PortraitMemory): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(portrait));
}

export function updatePortraitField(field: keyof PortraitMemory, value: string | number): void {
  const portrait = getPortraitMemory();
  (portrait as any)[field] = value;
  savePortraitMemory(portrait);
}
