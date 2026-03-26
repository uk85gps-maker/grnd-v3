export interface MealPlanItem {
  id: string;
  name: string;
  time: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  purpose: string;
}

export interface MacroTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export const DEFAULT_MEAL_PLAN: MealPlanItem[] = [
  {
    id: 'meal-1',
    name: 'Apple',
    time: '05:45',
    calories: 95,
    protein: 0.5,
    carbs: 25,
    fat: 0.3,
    purpose: 'Pre-gym fuel',
  },
  {
    id: 'meal-2',
    name: 'WPI + Creatine',
    time: '07:30',
    calories: 110,
    protein: 27,
    carbs: 0.1,
    fat: 0.2,
    purpose: 'Muscle repair',
  },
  {
    id: 'meal-3',
    name: 'Eggs + Avocado',
    time: '09:30',
    calories: 270,
    protein: 13,
    carbs: 6,
    fat: 22,
    purpose: 'Hormones and skin',
  },
  {
    id: 'meal-4',
    name: 'Skim Coffee',
    time: '09:35',
    calories: 40,
    protein: 3.5,
    carbs: 5,
    fat: 0.2,
    purpose: 'Focus',
  },
  {
    id: 'meal-5',
    name: 'Tofu + Potato/Veg',
    time: '12:30',
    calories: 380,
    protein: 25,
    carbs: 45,
    fat: 8,
    purpose: 'Fullness meal',
  },
  {
    id: 'meal-6',
    name: 'Electrolytes + Walnuts',
    time: '14:00',
    calories: 160,
    protein: 2.5,
    carbs: 2,
    fat: 15,
    purpose: 'Brain power',
  },
  {
    id: 'meal-7',
    name: 'WPI Shake',
    time: '15:30',
    calories: 110,
    protein: 27,
    carbs: 0.1,
    fat: 0.2,
    purpose: 'Hunger shield',
  },
  {
    id: 'meal-8',
    name: 'Egg Whites',
    time: '18:30',
    calories: 80,
    protein: 16.5,
    carbs: 1,
    fat: 0,
    purpose: 'Pre-load protein',
  },
  {
    id: 'meal-9',
    name: 'Kada Parshad',
    time: '19:30',
    calories: 190,
    protein: 1.5,
    carbs: 18,
    fat: 12,
    purpose: 'Daily blessing',
  },
];

const DEFAULT_MACRO_TARGETS: MacroTargets = {
  calories: 1435,
  protein: 116.5,
  carbs: 102.2,
  fat: 57.9,
};

const MEAL_PLAN_KEY = 'grnd_meal_plan_defaults';
const MACRO_TARGETS_KEY = 'grnd_macro_targets';

export function getMealPlanDefaults(): MealPlanItem[] {
  const stored = localStorage.getItem(MEAL_PLAN_KEY);
  if (stored) {
    try {
      return JSON.parse(stored) as MealPlanItem[];
    } catch {
      // Invalid data, reset to defaults
    }
  }
  // First time or invalid data - save defaults
  localStorage.setItem(MEAL_PLAN_KEY, JSON.stringify(DEFAULT_MEAL_PLAN));
  return DEFAULT_MEAL_PLAN;
}

export function saveMealPlanDefaults(items: MealPlanItem[]): void {
  localStorage.setItem(MEAL_PLAN_KEY, JSON.stringify(items));
}

export function getMacroTargets(): MacroTargets {
  const stored = localStorage.getItem(MACRO_TARGETS_KEY);
  if (stored) {
    try {
      return JSON.parse(stored) as MacroTargets;
    } catch {
      // Invalid data, reset to defaults
    }
  }
  // First time or invalid data - save defaults
  localStorage.setItem(MACRO_TARGETS_KEY, JSON.stringify(DEFAULT_MACRO_TARGETS));
  return DEFAULT_MACRO_TARGETS;
}

export function saveMacroTargets(targets: MacroTargets): void {
  localStorage.setItem(MACRO_TARGETS_KEY, JSON.stringify(targets));
}
