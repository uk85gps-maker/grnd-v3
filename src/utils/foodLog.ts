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
  status: 'unlogged' | 'plan' | 'deviation' | 'fast';
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

export function calculateDailyTotals(meals: MealLog[]): FoodMacros {
  return meals
    .filter((m) => m.status !== 'fast' && m.status !== 'unlogged')
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

export function calculateFastingHours(meals: MealLog[]): number | null {
  const loggedMeals = meals.filter((m) => m.loggedTime && m.status !== 'fast');
  
  if (loggedMeals.length === 0) {
    return null;
  }
  
  const firstMeal = loggedMeals.find((m) => m.isFirstMeal);
  const lastMeal = loggedMeals.find((m) => m.isLastMeal);
  
  if (!firstMeal || !lastMeal || !firstMeal.loggedTime || !lastMeal.loggedTime) {
    return null;
  }
  
  const [firstHour, firstMin] = firstMeal.loggedTime.split(':').map(Number);
  const [lastHour, lastMin] = lastMeal.loggedTime.split(':').map(Number);
  
  const firstMinutes = firstHour * 60 + firstMin;
  const lastMinutes = lastHour * 60 + lastMin;
  
  let eatingWindowMinutes = lastMinutes - firstMinutes;
  if (eatingWindowMinutes < 0) {
    eatingWindowMinutes += 24 * 60;
  }
  
  const fastingMinutes = 24 * 60 - eatingWindowMinutes;
  return Math.round((fastingMinutes / 60) * 10) / 10;
}

export function updateMealFirstLastFlags(meals: MealLog[]): MealLog[] {
  const loggedMeals = meals.filter((m) => m.loggedTime && m.status !== 'fast');
  
  if (loggedMeals.length === 0) {
    return meals.map((m) => ({ ...m, isFirstMeal: false, isLastMeal: false }));
  }
  
  const sortedLogged = [...loggedMeals].sort((a, b) => {
    const aTime = a.loggedTime || '';
    const bTime = b.loggedTime || '';
    return aTime.localeCompare(bTime);
  });
  
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
