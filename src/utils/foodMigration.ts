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
];

// Primary match keywords (in purpose field)
const PRIMARY_KEYWORDS = [
  'food',
  'supplement',
  'meal',
  'nutrition',
  'protein',
  'vitamin',
  'mineral',
];

// Secondary match keywords (exact word match in name, only if purpose is empty)
const SECONDARY_KEYWORDS = [
  'apple',
  'collagen',
  'iron',
  'wpi',
  'creatine',
  'eggs',
  'avocado',
  'tofu',
  'electrolytes',
  'magnesium',
  'omega',
  'parshad',
  'egg whites',
];

function isFoodOrSupplement(item: ChecklistItem): boolean {
  const purposeLower = (item.purpose || '').toLowerCase();
  const nameLower = item.name.toLowerCase();

  // PRIMARY match: purpose field contains any primary keyword
  if (purposeLower) {
    for (const keyword of PRIMARY_KEYWORDS) {
      if (purposeLower.includes(keyword)) {
        return true;
      }
    }
  }

  // SECONDARY match: name matches exact words (only if purpose is empty)
  if (!purposeLower || purposeLower.trim() === '') {
    for (const keyword of SECONDARY_KEYWORDS) {
      // Exact word match (case insensitive)
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(nameLower)) {
        return true;
      }
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

export function runMigrationIfNeeded(): void {
  try {
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
