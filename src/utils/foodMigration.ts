// Food/Life Split Migration
// Runs synchronously before first render to split food items from checklist

import { ChecklistSection, ChecklistItem } from './checklistTypes';

export interface FoodPlanItem {
  id: string;
  name: string;
  time: string;
  type: 'meal' | 'supplement';
  plannedMacros: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fibre: number;
  };
  variants?: Array<{
    name: string;
    macros: {
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      fibre: number;
    };
  }>;
  purpose: string;
  order: number;
}

const MIGRATION_FLAG_KEY = 'grnd_migration_food_split_done';
const FOOD_PLAN_KEY = 'grnd_food_plan';
const CHECKLIST_STRUCTURE_KEY = 'grnd_checklist_structure';
const BACKUP_KEY = 'grnd_checklist_structure_pre_migration_backup';

// Supplement keywords for type detection
const SUPPLEMENT_KEYWORDS = [
  'collagen',
  'iron',
  'wpi',
  'creatine',
  'vitamin',
  'omega',
  'magnesium',
  'd3',
  'k2',
  'electrolytes',
  'curcumin',
];

// Food/supplement item names to INCLUDE in migration (case insensitive)
const FOOD_ITEM_NAMES = [
  'apple',
  'collagen',
  'iron',
  'wpi',
  'creatine',
  'eggs',
  'avocado',
  'tofu',
  'potato',
  'electrolytes',
  'walnuts',
  'egg whites',
  'kada parshad',
  'parshad',
  'skim coffee',
  'coffee',
  'shake',
  'd3',
  'k2',
  'omega',
  'magnesium',
  'curcumin',
];

// Life items to EXCLUDE from migration (must stay in Life tab)
const LIFE_ITEM_NAMES = [
  'cook for tomorrow',
  'prepare',
  'read',
  'shower',
  'skincare',
  'simran',
  'wake',
  'stretch',
  'sunlight',
  'water',
  'sleep',
  'work',
  'waheguru',
  'gurbani',
  'suksham',
];

function isFoodOrSupplement(item: ChecklistItem): boolean {
  const nameLower = item.name.toLowerCase();

  // First check EXCLUDE list - if matched, must stay in Life tab
  for (const excludeName of LIFE_ITEM_NAMES) {
    const regex = new RegExp(`\\b${excludeName}\\b`, 'i');
    if (regex.test(nameLower)) {
      return false;
    }
  }

  // Then check INCLUDE list - if matched, move to Food tab
  for (const foodName of FOOD_ITEM_NAMES) {
    const regex = new RegExp(`\\b${foodName}\\b`, 'i');
    if (regex.test(nameLower)) {
      return true;
    }
  }

  return false;
}

function determineType(itemName: string): 'meal' | 'supplement' {
  const nameLower = itemName.toLowerCase();
  
  for (const keyword of SUPPLEMENT_KEYWORDS) {
    if (nameLower.includes(keyword)) {
      return 'supplement';
    }
  }
  
  return 'meal';
}

// Repair duplicate IDs in grnd_food_plan (one-time safety pass)
export function repairFoodPlanIds(): void {
  const raw = localStorage.getItem(FOOD_PLAN_KEY);
  if (!raw) return;
  try {
    const plan = JSON.parse(raw) as Array<{ id: string }>;
    const seen = new Set<string>();
    let repaired = false;
    const fixed = plan.map((item) => {
      if (seen.has(item.id)) {
        repaired = true;
        return { ...item, id: `food-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` };
      }
      seen.add(item.id);
      return item;
    });
    if (repaired) {
      localStorage.setItem(FOOD_PLAN_KEY, JSON.stringify(fixed));
    }
  } catch {
    // ignore corrupt data
  }
}

// Reset migration - restores backup and clears migration data
export function resetMigration(): void {
  try {
    // Restore checklist from backup if it exists
    const backup = localStorage.getItem(BACKUP_KEY);
    if (backup) {
      localStorage.setItem(CHECKLIST_STRUCTURE_KEY, backup);
    }

    // Clear migration flag and food plan
    localStorage.removeItem(MIGRATION_FLAG_KEY);
    localStorage.removeItem(FOOD_PLAN_KEY);

    console.log('Migration reset complete. Reload app to re-run migration.');
  } catch (error) {
    console.error('Migration reset failed:', error);
  }
}

export function runMigrationIfNeeded(): void {
  try {
    // One-time v2 reset: Force re-run with corrected keyword logic
    const v2ResetDone = localStorage.getItem('grnd_migration_v2_reset_done');
    if (!v2ResetDone) {
      resetMigration();
      localStorage.setItem('grnd_migration_v2_reset_done', 'true');
    }

    // Check if migration already done
    const migrationDone = localStorage.getItem(MIGRATION_FLAG_KEY);
    if (migrationDone === 'true') {
      return;
    }

    // Check if food plan already exists (migration ran before but flag not set)
    const existingFoodPlan = localStorage.getItem(FOOD_PLAN_KEY);
    if (existingFoodPlan) {
      try {
        const parsed = JSON.parse(existingFoodPlan);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Food plan exists, just set the flag and return
          localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
          return;
        }
      } catch {
        // Invalid food plan, continue with migration
      }
    }

    // Read checklist structure
    const checklistRaw = localStorage.getItem(CHECKLIST_STRUCTURE_KEY);
    if (!checklistRaw) {
      // No checklist to migrate, set flag and return
      localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
      return;
    }

    // Save backup BEFORE touching anything
    localStorage.setItem(BACKUP_KEY, checklistRaw);

    let sections: ChecklistSection[];
    try {
      sections = JSON.parse(checklistRaw) as ChecklistSection[];
    } catch {
      // Invalid checklist structure, abort migration
      return;
    }

    // Identify food/supplement items
    const foodItems: ChecklistItem[] = [];
    const updatedSections: ChecklistSection[] = [];

    for (const section of sections) {
      const remainingItems: ChecklistItem[] = [];
      
      for (const item of section.items) {
        if (isFoodOrSupplement(item)) {
          foodItems.push(item);
        } else {
          remainingItems.push(item);
        }
      }

      // Keep section with remaining items
      updatedSections.push({
        ...section,
        items: remainingItems,
      });
    }

    // Convert matched items to FoodPlanItem format
    const foodPlan: FoodPlanItem[] = foodItems.map((item, index) => ({
      id: item.id,
      name: item.name,
      time: item.time || '12:00',
      type: determineType(item.name),
      plannedMacros: {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fibre: 0,
      },
      purpose: item.purpose || '',
      order: index,
    }));

    // Write updated checklist structure
    localStorage.setItem(CHECKLIST_STRUCTURE_KEY, JSON.stringify(updatedSections));

    // Write food plan
    localStorage.setItem(FOOD_PLAN_KEY, JSON.stringify(foodPlan));

    // Set migration flag
    localStorage.setItem(MIGRATION_FLAG_KEY, 'true');

  } catch (error) {
    // Silent fail - migration will retry on next load
    console.error('Migration failed:', error);
  }
}
