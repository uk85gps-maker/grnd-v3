import { getGrndDayKey } from './dayKey';

export interface FoodMacros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
}

export interface MealLog {
  id: string;
  name: string;
  plannedTime: string;
  loggedTime: string | null;
  status: 'unlogged' | 'plan' | 'deviation' | 'skipped';
  items: string[];
  macros: FoodMacros;
  source: 'plan' | 'ai_estimate' | 'manual';
  isFirstMeal: boolean;
  isLastMeal: boolean;
}

export interface SupplementLog {
  id: string;
  name: string;
  time: string;
  confirmed: boolean;
}

export interface DailyFoodLog {
  meals: MealLog[];
  supplements: SupplementLog[];
  fastingHours: number | null;
  dailyTotals: FoodMacros;
}

// Kada Parshad: fixed macros for 2 tbsp
export const KADA_PARSHAD_MACROS: FoodMacros = {
  calories: 190,
  protein: 1.5,
  carbs: 18,
  fat: 12,
  fibre: 0,
};

export function isKadaParshad(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.includes('kada parshad') || lower.includes('parshad');
}

export function getFoodLogKey(dateKey?: string): string {
  const key = dateKey || getGrndDayKey();
  return `grnd_food_log_${key}`;
}

export function loadFoodLog(dateKey?: string): DailyFoodLog {
  const key = getFoodLogKey(dateKey);
  const raw = localStorage.getItem(key);

  if (!raw) {
    return {
      meals: [],
      supplements: [],
      fastingHours: null,
      dailyTotals: { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 },
    };
  }

  try {
    return JSON.parse(raw) as DailyFoodLog;
  } catch {
    return {
      meals: [],
      supplements: [],
      fastingHours: null,
      dailyTotals: { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 },
    };
  }
}

export function saveFoodLog(log: DailyFoodLog, dateKey?: string): void {
  const key = getFoodLogKey(dateKey);
  localStorage.setItem(key, JSON.stringify(log));
}

// Only plan and deviation contribute to totals; skipped and unlogged are zero
export function calculateDailyTotals(meals: MealLog[]): FoodMacros {
  return meals
    .filter((m) => m.status === 'plan' || m.status === 'deviation')
    .reduce(
      (acc, meal) => ({
        calories: acc.calories + meal.macros.calories,
        protein: acc.protein + meal.macros.protein,
        carbs: acc.carbs + meal.macros.carbs,
        fat: acc.fat + meal.macros.fat,
        fibre: acc.fibre + meal.macros.fibre,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 }
    );
}

export function updateMealFirstLastFlags(meals: MealLog[]): MealLog[] {
  const loggedMeals = meals.filter(
    (m) => m.loggedTime && (m.status === 'plan' || m.status === 'deviation')
  );

  if (loggedMeals.length === 0) {
    return meals.map((m) => ({ ...m, isFirstMeal: false, isLastMeal: false }));
  }

  const sortedLogged = [...loggedMeals].sort((a, b) =>
    (a.loggedTime || '').localeCompare(b.loggedTime || '')
  );

  const firstId = sortedLogged[0].id;
  const lastId = sortedLogged[sortedLogged.length - 1].id;

  return meals.map((m) => ({
    ...m,
    isFirstMeal: m.id === firstId,
    isLastMeal: m.id === lastId,
  }));
}

export function getCurrentTime(): string {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

// Returns a Date for the last plan/deviation meal logged on dateKey, or null
export function getLastMealTimestamp(dateKey: string): Date | null {
  const log = loadFoodLog(dateKey);
  const active = log.meals.filter(
    (m) => (m.status === 'plan' || m.status === 'deviation') && m.loggedTime
  );
  if (active.length === 0) return null;

  const sorted = [...active].sort((a, b) =>
    (a.loggedTime || '').localeCompare(b.loggedTime || '')
  );
  const last = sorted[sorted.length - 1];
  const [h, m] = (last.loggedTime as string).split(':').map(Number);
  const [y, mo, d] = dateKey.split('-').map(Number);
  return new Date(y, (mo as number) - 1, d as number, h as number, m as number, 0, 0);
}

// Returns a Date for the first plan/deviation meal logged on dateKey, or null
export function getFirstMealTimestamp(dateKey: string): Date | null {
  const log = loadFoodLog(dateKey);
  const active = log.meals.filter(
    (m) => (m.status === 'plan' || m.status === 'deviation') && m.loggedTime
  );
  if (active.length === 0) return null;

  const sorted = [...active].sort((a, b) =>
    (a.loggedTime || '').localeCompare(b.loggedTime || '')
  );
  const first = sorted[0];
  const [h, m] = (first.loggedTime as string).split(':').map(Number);
  const [y, mo, d] = dateKey.split('-').map(Number);
  return new Date(y, (mo as number) - 1, d as number, h as number, m as number, 0, 0);
}

// Cross-day fasting: gap between last plan/deviation meal of yesterday and first of today.
// locked=true once the first meal today exists (fasting window is sealed).
// While no meals today, reference is now() so the display ticks live.
export function getCrossDayFasting(
  todayKey: string,
  yesterdayKey: string
): { hours: number | null; locked: boolean } {
  const lastYesterday = getLastMealTimestamp(yesterdayKey);
  if (!lastYesterday) return { hours: null, locked: false };

  const firstToday = getFirstMealTimestamp(todayKey);
  const reference = firstToday ?? new Date();

  const diffMs = reference.getTime() - lastYesterday.getTime();
  if (diffMs < 0) return { hours: null, locked: false };

  const hours = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
  return { hours: Math.min(hours, 48), locked: !!firstToday };
}

export async function estimateMacros(items: string[]): Promise<FoodMacros> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  const url = `${supabaseUrl}/functions/v1/chat/macro-estimate`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
      },
      body: JSON.stringify({ items }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    return await response.json() as FoodMacros;
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error('Failed to estimate macros. Please try again.');
  }
}
