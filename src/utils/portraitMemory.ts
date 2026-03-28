export interface PortraitMemory {
  name: string;
  age: number;
  height: string;
  weight: string;
  goalWeight: string;
  waist: string;
  bodyFat: string;
  injuries: string;
  faith: string;
  relationshipStatus: string;
  career: string;
  trainingStage: string;
  keyPerson: string;
  goals: string;
  bloodSummary: string;
  twoFutures: string;
  spiralPattern: string;
  notes: string;
}

const DEFAULT_PORTRAIT: PortraitMemory = {
  name: 'Gurpreet Singh',
  age: 40,
  height: '173cm',
  weight: '80.4kg',
  goalWeight: '70kg',
  waist: '105cm',
  bodyFat: '29.4%',
  injuries: 'Right shoulder, right elbow, both knees — right knee surgery 2020, left never properly assessed. Progress reps before weight on upper body. No running or high impact lower body.',
  faith: 'Sikh, daily practice, turban is identity not decoration. Waheguru simran produces physiological state changes. Gurus experienced as present and active — not historical figures.',
  relationshipStatus: 'Separation, divorce final June 2026. Processing cleanly. No bitterness. Foundation first — connection layer parked.',
  career: 'Electrical wholesaler, SEO work, income under $60k. Direction parked until May — uncle guidance is the trigger.',
  trainingStage: 'Stage 1 — Build',
  keyPerson: 'Uncle — top decision-making authority. If uncle says yes it is yes. If no it is no. Coach supports this relationship, never competes with it.',
  goals: '70kg, waist under 90cm, body fat under 20%, combat ready, Stage 2 unlocked.',
  bloodSummary: 'LDL 4.5 high. Total cholesterol 6.3 high. Ferritin 26 low and dropping. HbA1c 5.4 improved. TSH 1.4 improved. Vit D 102 sufficient. Testosterone 14.2 functional medicine optimal is 18-25. Next panel August 2026. GP booking urgent — LDL, ferritin, sleep apnea, BP.',
  twoFutures: 'Fear path: cannot get off the floor, knees that will not carry him, too heavy to work a full day, dependent, invisible, pitied. Building path: strong body, full days, combat ready, on level with the strongest men, noticed and respected, attractive, grounded in faith, income moving, still going when others stop.',
  spiralPattern: 'One obsessive trigger — app building, project, idea — pulls full focus. Sleep breaks down. Diet fails. Dopamine seeking starts. Reels. Full foundation collapse. Instagram deleted 24 March 2026. GRND flags when 2+ foundation layers crack simultaneously for 3+ days.',
  notes: '',
};

const STORAGE_KEY = 'grnd_portrait_memory';

export function getPortraitMemory(): PortraitMemory {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as PortraitMemory;
      // Merge with defaults to ensure new fields are present
      return { ...DEFAULT_PORTRAIT, ...parsed };
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

export function syncPortraitWithLiveData(weight?: number, waist?: number, bodyFat?: number): void {
  const portrait = getPortraitMemory();
  let changed = false;

  if (weight !== undefined && weight > 0) {
    portrait.weight = `${weight}kg`;
    changed = true;
  }
  if (waist !== undefined && waist > 0) {
    portrait.waist = `${waist}cm`;
    changed = true;
  }
  if (bodyFat !== undefined && bodyFat > 0) {
    portrait.bodyFat = `${bodyFat}%`;
    changed = true;
  }

  if (changed) {
    savePortraitMemory(portrait);
  }
}
