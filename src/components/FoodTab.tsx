import { useState, useMemo, useRef, useEffect } from 'react';
import { getGrndDayKey, previousDayKey } from '@/utils/dayKey';
import { FoodPlanItem, runMigrationIfNeeded, repairFoodPlanIds } from '@/utils/foodMigration';
import { getMacroTargets, MacroTargets } from '@/utils/mealPlan';
import {
  loadFoodLog,
  saveFoodLog,
  calculateDailyTotals,
  updateMealFirstLastFlags,
  getCurrentTime,
  estimateMacros,
  KADA_PARSHAD_MACROS,
  isKadaParshad,
  MealLog,
  FoodMacros,
} from '@/utils/foodLog';

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#2a2a2a] bg-[#141414] p-4">
      {children}
    </div>
  );
}

const PROTOCOL_GROUPS = [
  { name: 'Pre-Gym',          start: '04:00', end: '07:29' },
  { name: 'Work Morning',     start: '07:30', end: '11:59' },
  { name: 'Work Afternoon',   start: '12:00', end: '15:59' },
  { name: 'After Work',       start: '16:00', end: '19:59' },
  { name: 'Bedtime',          start: '20:00', end: '23:59' },
];

const GROUP_ORDER = ['Pre-Gym', 'Work Morning', 'Work Afternoon', 'After Work', 'Bedtime', 'Other'];

function getMealGroup(time: string): string {
  for (const g of PROTOCOL_GROUPS) {
    if (time >= g.start && time <= g.end) return g.name;
  }
  return 'Other';
}

export default function FoodTab() {
  const dayKey = useMemo(() => getGrndDayKey(), []);
  const yesterdayKey = useMemo(() => previousDayKey(dayKey), [dayKey]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, number>>({});
  const [kadaMealId, setKadaMealId] = useState<string | null>(null);
  const [kadaQty, setKadaQty] = useState(2);
  const [kadaTime, setKadaTime] = useState('');
  const [newItemVariants, setNewItemVariants] = useState<Array<{ name: string; macros: FoodMacros }>>([]);
  const [variantsOpen, setVariantsOpen] = useState(false);

  const [foodPlan, setFoodPlan] = useState<FoodPlanItem[]>(() => {
    runMigrationIfNeeded();
    repairFoodPlanIds();
    const raw = localStorage.getItem('grnd_food_plan');
    if (raw) {
      try {
        return JSON.parse(raw) as FoodPlanItem[];
      } catch {
        return [];
      }
    }
    return [];
  });

  const foodLog = useMemo(() => loadFoodLog(dayKey), [dayKey, refreshKey]);
  const targets = useMemo<MacroTargets>(() => getMacroTargets(), []);

  // Edit plan modal state
  const [editPlanOpen, setEditPlanOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FoodPlanItem | null>(null);
  const [isAddingMeal, setIsAddingMeal] = useState(false);
  const [isAddingSupplement, setIsAddingSupplement] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemTime, setNewItemTime] = useState('');
  const [newItemCalories, setNewItemCalories] = useState('');
  const [newItemProtein, setNewItemProtein] = useState('');
  const [newItemCarbs, setNewItemCarbs] = useState('');
  const [newItemFat, setNewItemFat] = useState('');
  const [newItemFibre, setNewItemFibre] = useState('');

  // Food logging modals
  const [hadThisMealId, setHadThisMealId] = useState<string | null>(null);
  const [hadThisTime, setHadThisTime] = useState('');
  const [lastMealPickerId, setLastMealPickerId] = useState<string | null>(null);
  const [lastMealTime, setLastMealTime] = useState('');
  const [suppExpanded, setSuppExpanded] = useState(false);
  const [somethingElseMealId, setSomethingElseMealId] = useState<string | null>(null);
  const [deviationItems, setDeviationItems] = useState<string[]>(['']);
  const [estimating, setEstimating] = useState(false);
  const [estimatedMacros, setEstimatedMacros] = useState<FoodMacros | null>(null);
  const [estimationFailed, setEstimationFailed] = useState(false);
  const [estimationError, setEstimationError] = useState<string>('');
  const [manualCalories, setManualCalories] = useState('');
  const [manualProtein, setManualProtein] = useState('');
  const [manualCarbs, setManualCarbs] = useState('');
  const [manualFat, setManualFat] = useState('');
  const [manualFibre, setManualFibre] = useState('');
  const [deviationTime, setDeviationTime] = useState('');
  const [editLogMealId, setEditLogMealId] = useState<string | null>(null);
  const [editLogTime, setEditLogTime] = useState('');
  const [editLogCalories, setEditLogCalories] = useState('');
  const [editLogProtein, setEditLogProtein] = useState('');
  const [editLogCarbs, setEditLogCarbs] = useState('');
  const [editLogFat, setEditLogFat] = useState('');
  const [editLogFibre, setEditLogFibre] = useState('');

  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (somethingElseMealId && firstInputRef.current) {
      setTimeout(() => {
        firstInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }, [somethingElseMealId]);

  // Auto-skip any still-unlogged meals from the previous day
  useEffect(() => {
    const prevLog = loadFoodLog(yesterdayKey);
    if (prevLog.meals.some((m) => m.status === 'unlogged')) {
      const updated = {
        ...prevLog,
        meals: prevLog.meals.map((m) =>
          m.status === 'unlogged' ? { ...m, status: 'skipped' as const } : m
        ),
      };
      saveFoodLog(updated, yesterdayKey);
    }
  }, [yesterdayKey]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) setSuppExpanded(false);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  const meals = useMemo(() => {
    return foodPlan
      .filter((item) => item.type === 'meal')
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [foodPlan]);

  const supplements = useMemo(() => {
    return foodPlan
      .filter((item) => item.type === 'supplement')
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [foodPlan]);

  const groupedMeals = useMemo(() => {
    const map: Record<string, typeof meals> = {};
    for (const meal of meals) {
      const g = getMealGroup(meal.time);
      if (!map[g]) map[g] = [];
      map[g].push(meal);
    }
    return GROUP_ORDER
      .filter((g) => (map[g]?.length ?? 0) > 0)
      .map((g) => ({ group: g, items: map[g] }));
  }, [meals]);

  const getMealStatus = (mealId: string): MealLog | null => {
    return foodLog.meals.find((m) => (m as any).planItemId === mealId || m.id === mealId) || null;
  };

  const wouldBeLastMeal = (mealId: string): boolean => {
    const currentLog = loadFoodLog(dayKey);
    return meals.filter((m) => m.id !== mealId).every((m) => {
      const log = currentLog.meals.find((ml) => (ml as any).planItemId === m.id || ml.id === m.id);
      return log && (log.status === 'plan' || log.status === 'deviation' || log.status === 'skipped');
    });
  };

  const getSupplementStatus = (suppId: string): boolean => {
    const supp = foodLog.supplements.find((s) => s.id === suppId);
    return supp?.confirmed || false;
  };

  const reloadFoodPlan = () => {
    const raw = localStorage.getItem('grnd_food_plan');
    if (raw) {
      try {
        setFoodPlan(JSON.parse(raw) as FoodPlanItem[]);
      } catch {
        setFoodPlan([]);
      }
    } else {
      setFoodPlan([]);
    }
  };

  const refreshLog = () => {
    setRefreshKey((k) => k + 1);
  };

  const handleOpenEditPlan = () => {
    setEditPlanOpen(true);
  };

  const handleCloseEditPlan = () => {
    setEditPlanOpen(false);
    setEditingItem(null);
    setIsAddingMeal(false);
    setIsAddingSupplement(false);
    resetNewItemForm();
    reloadFoodPlan();
  };

  const resetNewItemForm = () => {
    setNewItemName('');
    setNewItemTime('');
    setNewItemCalories('');
    setNewItemProtein('');
    setNewItemCarbs('');
    setNewItemFat('');
    setNewItemFibre('');
    setNewItemVariants([]);
    setVariantsOpen(false);
  };

  const handleAddVariant = () => {
    setNewItemVariants((prev) => [...prev, { name: '', macros: { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 } }]);
  };

  const handleRemoveVariant = (vIdx: number) => {
    setNewItemVariants((prev) => prev.filter((_, i) => i !== vIdx));
  };

  const handleVariantNameChange = (vIdx: number, name: string) => {
    setNewItemVariants((prev) => prev.map((v, i) => i === vIdx ? { ...v, name } : v));
  };

  const handleVariantMacroChange = (vIdx: number, field: keyof FoodMacros, value: string) => {
    setNewItemVariants((prev) =>
      prev.map((v, i) => i === vIdx ? { ...v, macros: { ...v.macros, [field]: parseFloat(value) || 0 } } : v)
    );
  };

  const handleStartAddMeal = () => {
    setIsAddingMeal(true);
    setIsAddingSupplement(false);
    setEditingItem(null);
    resetNewItemForm();
  };

  const handleStartAddSupplement = () => {
    setIsAddingSupplement(true);
    setIsAddingMeal(false);
    setEditingItem(null);
    resetNewItemForm();
  };

  const handleSaveNewItem = () => {
    if (!newItemName.trim() || !newItemTime.trim()) return;

    const filteredVariants = newItemVariants.filter((v) => v.name.trim());
    const newItem: FoodPlanItem = {
      id: `food-${Date.now()}`,
      name: newItemName.trim(),
      time: newItemTime,
      type: isAddingMeal ? 'meal' : 'supplement',
      plannedMacros: {
        calories: parseFloat(newItemCalories) || 0,
        protein: parseFloat(newItemProtein) || 0,
        carbs: parseFloat(newItemCarbs) || 0,
        fat: parseFloat(newItemFat) || 0,
        fibre: parseFloat(newItemFibre) || 0,
      },
      variants: filteredVariants.length > 0 ? filteredVariants : undefined,
      purpose: '',
      order: foodPlan.length,
    };

    const updated = [...foodPlan, newItem];
    localStorage.setItem('grnd_food_plan', JSON.stringify(updated));
    
    const history = {
      timestamp: new Date().toISOString(),
      action: 'add',
      item: newItem,
    };
    const historyRaw = localStorage.getItem('grnd_food_plan_edit_history');
    const historyArray = historyRaw ? JSON.parse(historyRaw) : [];
    historyArray.push(history);
    localStorage.setItem('grnd_food_plan_edit_history', JSON.stringify(historyArray));

    setFoodPlan(updated);
    setIsAddingMeal(false);
    setIsAddingSupplement(false);
    resetNewItemForm();
  };

  const handleEditItem = (item: FoodPlanItem) => {
    setEditingItem(item);
    setIsAddingMeal(false);
    setIsAddingSupplement(false);
    setNewItemName(item.name);
    setNewItemTime(item.time);
    setNewItemCalories(item.plannedMacros.calories.toString());
    setNewItemProtein(item.plannedMacros.protein.toString());
    setNewItemCarbs(item.plannedMacros.carbs.toString());
    setNewItemFat(item.plannedMacros.fat.toString());
    setNewItemFibre(item.plannedMacros.fibre.toString());
    const existingVariants = item.variants?.map((v) => ({ name: v.name, macros: { ...v.macros } })) ?? [];
    setNewItemVariants(existingVariants);
    setVariantsOpen(existingVariants.length > 0);
  };

  const handleSaveEdit = () => {
    if (!editingItem || !newItemName.trim() || !newItemTime.trim()) return;

    const filteredVariants = newItemVariants.filter((v) => v.name.trim());
    const updated = foodPlan.map((item) =>
      item.id === editingItem.id
        ? {
            ...item,
            name: newItemName.trim(),
            time: newItemTime,
            plannedMacros: {
              calories: parseFloat(newItemCalories) || 0,
              protein: parseFloat(newItemProtein) || 0,
              carbs: parseFloat(newItemCarbs) || 0,
              fat: parseFloat(newItemFat) || 0,
              fibre: parseFloat(newItemFibre) || 0,
            },
            variants: filteredVariants.length > 0 ? filteredVariants : undefined,
          }
        : item
    );

    localStorage.setItem('grnd_food_plan', JSON.stringify(updated));
    
    const history = {
      timestamp: new Date().toISOString(),
      action: 'edit',
      previousValue: editingItem,
      newValue: updated.find((i) => i.id === editingItem.id),
    };
    const historyRaw = localStorage.getItem('grnd_food_plan_edit_history');
    const historyArray = historyRaw ? JSON.parse(historyRaw) : [];
    historyArray.push(history);
    localStorage.setItem('grnd_food_plan_edit_history', JSON.stringify(historyArray));

    setFoodPlan(updated);
    setEditingItem(null);
    resetNewItemForm();
  };

  const handleDeleteItem = (itemId: string) => {
    const updated = foodPlan.filter((item) => item.id !== itemId);
    localStorage.setItem('grnd_food_plan', JSON.stringify(updated));
    
    const deletedItem = foodPlan.find((i) => i.id === itemId);
    const history = {
      timestamp: new Date().toISOString(),
      action: 'delete',
      item: deletedItem,
    };
    const historyRaw = localStorage.getItem('grnd_food_plan_edit_history');
    const historyArray = historyRaw ? JSON.parse(historyRaw) : [];
    historyArray.push(history);
    localStorage.setItem('grnd_food_plan_edit_history', JSON.stringify(historyArray));

    setFoodPlan(updated);
  };

  // HAD THIS
  const handleHadThisClick = async (mealId: string) => {
    const meal = meals.find((m) => m.id === mealId);
    if (!meal) return;

    const variantIdx = selectedVariants[mealId] ?? 0;
    const activeVariant = meal.variants && meal.variants.length > 0 ? (meal.variants[variantIdx] ?? null) : null;
    const effectiveName = activeVariant ? activeVariant.name : meal.name;
    const effectiveMacros = activeVariant ? activeVariant.macros : meal.plannedMacros;

    // Kada Parshad: open quantity picker modal
    if (isKadaParshad(effectiveName)) {
      const isFirstMealOfDay = loadFoodLog(dayKey).meals.filter((m) => m.loggedTime).length === 0;
      setKadaMealId(mealId);
      setKadaQty(2);
      setKadaTime(isFirstMealOfDay ? getCurrentTime() : '');
      return;
    }

    // 0-macro meal: auto-open Something Else with AI estimation pre-triggered
    if (effectiveMacros.calories === 0) {
      setSomethingElseMealId(mealId);
      setDeviationItems([effectiveName]);
      setEstimatedMacros(null);
      setEstimationFailed(false);
      setEstimationError('');
      setManualCalories('');
      setManualProtein('');
      setManualCarbs('');
      setManualFat('');
      setManualFibre('');
      setDeviationTime('');
      setEstimating(true);
      try {
        const macros = await estimateMacros([effectiveName]);
        setEstimatedMacros(macros);
        setManualCalories(macros.calories.toString());
        setManualProtein(macros.protein.toString());
        setManualCarbs(macros.carbs.toString());
        setManualFat(macros.fat.toString());
        setManualFibre(macros.fibre.toString());
      } catch (error: unknown) {
        setEstimationFailed(true);
        setEstimationError(error instanceof Error ? error.message : 'Unknown error');
      } finally {
        setEstimating(false);
      }
      return;
    }

    // Normal flow
    const isFirstMealOfDay = loadFoodLog(dayKey).meals.filter((m) => m.loggedTime).length === 0;
    const isLastMealOfDay = !isFirstMealOfDay && wouldBeLastMeal(mealId);
    if (isFirstMealOfDay) {
      setHadThisMealId(mealId);
      setHadThisTime(getCurrentTime());
    } else if (isLastMealOfDay) {
      setLastMealPickerId(mealId);
      setLastMealTime(getCurrentTime());
    } else {
      logHadThis(mealId, getCurrentTime());
    }
  };

  const logHadThis = (mealId: string, time: string) => {
    const meal = meals.find((m) => m.id === mealId);
    if (!meal) return;

    const variantIdx = selectedVariants[mealId] ?? 0;
    const activeVariant = meal.variants && meal.variants.length > 0 ? (meal.variants[variantIdx] ?? null) : null;
    const effectiveName = activeVariant ? activeVariant.name : meal.name;
    const macros = isKadaParshad(effectiveName)
      ? KADA_PARSHAD_MACROS
      : (activeVariant ? activeVariant.macros : meal.plannedMacros);
    const items = isKadaParshad(effectiveName) ? ['2 tbsp Kada Parshad'] : [];

    const newMeal = {
      id: `${mealId}-${Date.now()}`,
      planItemId: mealId,
      name: effectiveName,
      plannedTime: meal.time,
      loggedTime: time,
      status: 'plan',
      items,
      macros,
      source: 'plan',
      quantity: 1,
      isFirstMeal: false,
      isLastMeal: false,
    } as unknown as MealLog;

    const currentLog = loadFoodLog(dayKey);
    let updatedMeals = [...currentLog.meals];
    const existingIndex = updatedMeals.findIndex((m) => (m as any).planItemId === mealId || m.id === mealId);
    if (existingIndex >= 0) {
      updatedMeals[existingIndex] = newMeal;
    } else {
      updatedMeals.push(newMeal);
    }

    updatedMeals = updateMealFirstLastFlags(updatedMeals);
    const dailyTotals = calculateDailyTotals(updatedMeals);

    saveFoodLog({ ...currentLog, meals: updatedMeals, dailyTotals, fastingHours: null }, dayKey);
    setHadThisMealId(null);
    setHadThisTime('');
    refreshLog();
  };

  const handleConfirmHadThis = () => {
    if (hadThisMealId && hadThisTime) {
      logHadThis(hadThisMealId, hadThisTime);
    }
  };

  const handleConfirmLastMeal = () => {
    if (lastMealPickerId && lastMealTime) {
      logHadThis(lastMealPickerId, lastMealTime);
      setLastMealPickerId(null);
      setLastMealTime('');
    }
  };

  const logKadaParshad = (mealId: string, qty: number, time: string) => {
    const meal = meals.find((m) => m.id === mealId);
    if (!meal) return;

    const factor = qty / 2;
    const macros: FoodMacros = {
      calories: Math.round(factor * KADA_PARSHAD_MACROS.calories),
      protein: Math.round(factor * KADA_PARSHAD_MACROS.protein * 10) / 10,
      carbs: Math.round(factor * KADA_PARSHAD_MACROS.carbs * 10) / 10,
      fat: Math.round(factor * KADA_PARSHAD_MACROS.fat * 10) / 10,
      fibre: 0,
    };

    const newMeal = {
      id: `${mealId}-${Date.now()}`,
      planItemId: mealId,
      name: meal.name,
      plannedTime: meal.time,
      loggedTime: time,
      status: 'plan',
      items: [`${qty} tbsp Kada Parshad`],
      macros,
      source: 'plan',
      quantity: qty,
      isFirstMeal: false,
      isLastMeal: false,
    } as unknown as MealLog;

    const currentLog = loadFoodLog(dayKey);
    let updatedMeals = [...currentLog.meals];
    const existingIndex = updatedMeals.findIndex((m) => (m as any).planItemId === mealId || m.id === mealId);
    if (existingIndex >= 0) {
      updatedMeals[existingIndex] = newMeal;
    } else {
      updatedMeals.push(newMeal);
    }

    updatedMeals = updateMealFirstLastFlags(updatedMeals);
    const dailyTotals = calculateDailyTotals(updatedMeals);

    saveFoodLog({ ...currentLog, meals: updatedMeals, dailyTotals, fastingHours: null }, dayKey);
    setKadaMealId(null);
    refreshLog();
  };

  // SOMETHING ELSE
  const handleSomethingElseClick = (mealId: string) => {
    setSomethingElseMealId(mealId);
    setDeviationItems(['']);
    setEstimatedMacros(null);
    setEstimationFailed(false);
    setEstimationError('');
    setManualCalories('');
    setManualProtein('');
    setManualCarbs('');
    setManualFat('');
    setManualFibre('');
    setDeviationTime('');
  };

  const handleAddDeviationItem = () => {
    setDeviationItems([...deviationItems, '']);
  };

  const handleDeviationItemChange = (index: number, value: string) => {
    const updated = [...deviationItems];
    updated[index] = value;
    setDeviationItems(updated);
  };

  const handleEstimateMacros = async () => {
    const filledItems = deviationItems.filter((item) => item.trim());
    if (filledItems.length === 0) return;

    setEstimating(true);
    setEstimationFailed(false);
    setEstimationError('');

    try {
      const macros = await estimateMacros(filledItems);
      setEstimatedMacros(macros);
      setManualCalories(macros.calories.toString());
      setManualProtein(macros.protein.toString());
      setManualCarbs(macros.carbs.toString());
      setManualFat(macros.fat.toString());
      setManualFibre(macros.fibre.toString());
    } catch (error: any) {
      setEstimationFailed(true);
      setEstimatedMacros(null);
      setEstimationError(error instanceof Error ? error.message : JSON.stringify(error, null, 2) || 'Unknown error');
    } finally {
      setEstimating(false);
    }
  };

  const handleSaveDeviation = () => {
    if (!somethingElseMealId) return;
    if (!manualCalories || !manualProtein || !manualCarbs || !manualFat || !manualFibre) return;

    const meal = meals.find((m) => m.id === somethingElseMealId);
    if (!meal) return;

    const currentLog = loadFoodLog(dayKey);
    const isFirstMealOfDay = currentLog.meals.filter((m) => m.loggedTime).length === 0;
    const isLastMealOfDay = !isFirstMealOfDay && somethingElseMealId ? wouldBeLastMeal(somethingElseMealId) : false;
    const time = (isFirstMealOfDay || isLastMealOfDay) ? (deviationTime || getCurrentTime()) : getCurrentTime();

    const filledItems = deviationItems.filter((item) => item.trim());

    const newMeal = {
      id: `${somethingElseMealId}-${Date.now()}`,
      planItemId: somethingElseMealId,
      name: filledItems.join(', '),
      plannedTime: meal.time,
      loggedTime: time,
      status: 'deviation',
      items: filledItems,
      macros: {
        calories: parseFloat(manualCalories),
        protein: parseFloat(manualProtein),
        carbs: parseFloat(manualCarbs),
        fat: parseFloat(manualFat),
        fibre: parseFloat(manualFibre),
      },
      source: estimatedMacros ? 'ai_estimate' : 'manual',
      quantity: 1,
      isFirstMeal: false,
      isLastMeal: false,
    } as unknown as MealLog;

    let updatedMeals = [...currentLog.meals];
    const existingIndex = updatedMeals.findIndex((m) => (m as any).planItemId === somethingElseMealId || m.id === somethingElseMealId);
    if (existingIndex >= 0) {
      updatedMeals[existingIndex] = newMeal;
    } else {
      updatedMeals.push(newMeal);
    }

    updatedMeals = updateMealFirstLastFlags(updatedMeals);
    const dailyTotals = calculateDailyTotals(updatedMeals);

    saveFoodLog({ ...currentLog, meals: updatedMeals, dailyTotals, fastingHours: null }, dayKey);
    setSomethingElseMealId(null);
    refreshLog();
  };

  // SKIP — one tap, no confirmation; tappable again to undo back to unlogged
  const handleSkipMeal = (mealId: string) => {
    const meal = meals.find((m) => m.id === mealId);
    if (!meal) return;

    const skippedMeal: MealLog = {
      id: mealId,
      name: meal.name,
      plannedTime: meal.time,
      loggedTime: null,
      status: 'skipped',
      items: [],
      macros: { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 },
      source: 'plan',
      isFirstMeal: false,
      isLastMeal: false,
    };

    const currentLog = loadFoodLog(dayKey);
    let updatedMeals = [...currentLog.meals];
    const existingIndex = updatedMeals.findIndex((m) => m.id === mealId);
    if (existingIndex >= 0) {
      updatedMeals[existingIndex] = skippedMeal;
    } else {
      updatedMeals.push(skippedMeal);
    }

    const dailyTotals = calculateDailyTotals(updatedMeals);
    saveFoodLog({ ...currentLog, meals: updatedMeals, dailyTotals, fastingHours: null }, dayKey);
    refreshLog();
  };

  const handleUndoSkip = (mealId: string) => {
    const currentLog = loadFoodLog(dayKey);
    const updatedMeals = currentLog.meals.filter((m) => m.id !== mealId);
    const dailyTotals = calculateDailyTotals(updatedMeals);
    saveFoodLog({ ...currentLog, meals: updatedMeals, dailyTotals, fastingHours: null }, dayKey);
    refreshLog();
  };

  // EDIT LOG
  const handleEditLog = (mealId: string) => {
    const mealLog = foodLog.meals.find((m) => (m as any).planItemId === mealId || m.id === mealId);
    if (!mealLog) return;

    setEditLogMealId(mealId);
    setEditLogTime(mealLog.loggedTime || '');
    setEditLogCalories(mealLog.macros.calories.toString());
    setEditLogProtein(mealLog.macros.protein.toString());
    setEditLogCarbs(mealLog.macros.carbs.toString());
    setEditLogFat(mealLog.macros.fat.toString());
    setEditLogFibre(mealLog.macros.fibre.toString());
  };

  const handleSaveEditLog = () => {
    if (!editLogMealId) return;

    const currentLog = loadFoodLog(dayKey);
    let updatedMeals = currentLog.meals.map((m) =>
      ((m as any).planItemId === editLogMealId || m.id === editLogMealId)
        ? {
            ...m,
            loggedTime: editLogTime,
            macros: {
              calories: parseFloat(editLogCalories),
              protein: parseFloat(editLogProtein),
              carbs: parseFloat(editLogCarbs),
              fat: parseFloat(editLogFat),
              fibre: parseFloat(editLogFibre),
            },
          }
        : m
    );

    updatedMeals = updateMealFirstLastFlags(updatedMeals);
    const dailyTotals = calculateDailyTotals(updatedMeals);

    saveFoodLog({ ...currentLog, meals: updatedMeals, dailyTotals, fastingHours: null }, dayKey);
    setEditLogMealId(null);
    refreshLog();
  };

  const handleClearAndRelog = (mealId: string) => {
    const currentLog = loadFoodLog(dayKey);
    const updatedMeals = currentLog.meals.filter((m) => (m as any).planItemId !== mealId && m.id !== mealId);
    const dailyTotals = calculateDailyTotals(updatedMeals);
    saveFoodLog({ ...currentLog, meals: updatedMeals, dailyTotals, fastingHours: null }, dayKey);
    setEditLogMealId(null);
    refreshLog();
  };

  // SUPPLEMENTS
  const handleToggleSupplement = (suppId: string) => {
    const supp = supplements.find((s) => s.id === suppId);
    if (!supp) return;

    const currentLog = loadFoodLog(dayKey);
    const existing = currentLog.supplements.find((s) => s.id === suppId);
    let updatedSupplements = [...currentLog.supplements];

    if (existing) {
      updatedSupplements = updatedSupplements.map((s) =>
        s.id === suppId ? { ...s, confirmed: !s.confirmed } : s
      );
    } else {
      updatedSupplements.push({
        id: suppId,
        name: supp.name,
        time: supp.time,
        confirmed: true,
      });
    }

    saveFoodLog({ ...currentLog, supplements: updatedSupplements }, dayKey);
    refreshLog();
  };

  return (
    <div className="flex flex-1 flex-col gap-4 pb-20">
      {/* Summary Bar */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-text-secondary">CALORIES</div>
            <div className="mt-1 text-lg font-bold text-primary">
              {Math.round(foodLog.dailyTotals.calories)} / {targets.calories}
            </div>
          </div>
          <div>
            <div className="text-sm text-text-secondary">PROTEIN</div>
            <div className="mt-1 text-lg font-bold text-primary">
              {Math.round(foodLog.dailyTotals.protein)}g / {targets.protein}g
            </div>
          </div>
        </div>
      </Card>

      {/* Empty State */}
      {meals.length === 0 && supplements.length === 0 && (
        <Card>
          <div className="py-8 text-center">
            <div className="mb-4 text-base text-text-secondary">No meals added yet</div>
            <button
              type="button"
              onClick={handleOpenEditPlan}
              className="rounded-brand bg-primary px-6 py-3 font-bold text-background"
            >
              Add your first meal
            </button>
          </div>
        </Card>
      )}

      {/* Meal List */}
      {meals.length > 0 && (
        <Card>
          <div className="mb-3 text-lg font-bold text-white">🍽️ Meals</div>
          <div className="space-y-4">
            {groupedMeals.map(({ group, items }) => {
              const groupLoggedCount = items.filter((m) => {
                const ml = getMealStatus(m.id);
                return ml?.status === 'plan' || ml?.status === 'deviation';
              }).length;
              return (
                <div key={group}>
                  {(() => {
                    const groupMeta: Record<string, { symbol: string; colour: string }> = {
                      'Pre-Gym':        { symbol: '🌅', colour: '#a78bfa' },
                      'Work Morning':   { symbol: '☀️', colour: '#fbbf24' },
                      'Work Afternoon': { symbol: '⚡', colour: '#34d399' },
                      'After Work':     { symbol: '🏠', colour: '#60a5fa' },
                      'Bedtime':        { symbol: '🌙', colour: '#f472b6' },
                      'Other':          { symbol: '📋', colour: '#9ca3af' },
                    };
                    const { symbol: groupSymbol, colour: groupColour } = groupMeta[group] ?? { symbol: '📋', colour: '#9ca3af' };
                    return (
                      <div style={{ color: groupColour }} className="mb-2 text-lg font-bold">
                        {groupSymbol} {group} {groupLoggedCount}/{items.length}
                      </div>
                    );
                  })()}
                  <div className="space-y-3">
                    {items.map((meal) => {
                      const mealLog = getMealStatus(meal.id);
                      const isLogged = mealLog?.status === 'plan' || mealLog?.status === 'deviation';
                      const isSkipped = mealLog?.status === 'skipped';
                      const variantIdx = selectedVariants[meal.id] ?? 0;
                      const activeVariant = meal.variants && meal.variants.length > 0 ? (meal.variants[variantIdx] ?? null) : null;
                      const displayName = isLogged ? (mealLog!.name || meal.name) : (activeVariant ? activeVariant.name : meal.name);
                      const displayMacros = (() => {
                        if (isLogged) {
                          const m = mealLog!.macros;
                          if (isKadaParshad(mealLog!.name || meal.name) && m.calories === 0) return KADA_PARSHAD_MACROS;
                          return m;
                        }
                        if (activeVariant) return activeVariant.macros;
                        if (isKadaParshad(meal.name)) return KADA_PARSHAD_MACROS;
                        return meal.plannedMacros;
                      })();

                      if (isLogged) {
                        return (
                          <div
                            key={meal.id}
                            className="cursor-pointer rounded-brand bg-background p-3"
                            onClick={() => handleEditLog(meal.id)}
                          >
                            <div className="flex items-center gap-2">
                              <div className="flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full bg-[#d4af37]">
                                <span className="text-[10px] font-bold leading-none text-white">✓</span>
                              </div>
                              <span className="flex-1 text-base text-white">{displayName}</span>
                              <span className="text-xs text-zinc-500">tap to edit</span>
                            </div>
                            <div className="mt-1 pl-[26px] text-sm text-text-secondary">
                              {`${displayMacros.calories}cal · P:${displayMacros.protein}g · C:${displayMacros.carbs}g · F:${displayMacros.fat}g`}
                            </div>
                            {mealLog?.status === 'deviation' && mealLog.items.length > 0 && (
                              <div className="mt-0.5 pl-[26px] text-sm text-primary">
                                {mealLog.items.join(', ')}
                              </div>
                            )}
                          </div>
                        );
                      }

                      return (
                        <div key={meal.id} className="rounded-brand bg-background p-3">
                          {meal.variants && meal.variants.length > 1 && !isSkipped && (
                            <div className="mb-2">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setSelectedVariants((prev) => ({ ...prev, [meal.id]: Math.max(0, (prev[meal.id] ?? 0) - 1) }))}
                                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-brand bg-background text-lg text-text-secondary"
                                >
                                  ‹
                                </button>
                                <div className="flex-1 rounded-brand border border-primary px-3 py-2 text-center text-sm font-semibold text-primary">
                                  {meal.variants[variantIdx]?.name ?? meal.variants[0].name}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setSelectedVariants((prev) => ({ ...prev, [meal.id]: Math.min(meal.variants!.length - 1, (prev[meal.id] ?? 0) + 1) }))}
                                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-brand bg-background text-lg text-text-secondary"
                                >
                                  ›
                                </button>
                              </div>
                              <div className="mt-1 flex justify-center gap-1">
                                {meal.variants.map((_, idx) => (
                                  <div
                                    key={idx}
                                    className={`h-1.5 w-1.5 rounded-full ${variantIdx === idx ? 'bg-primary' : 'bg-zinc-600'}`}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="text-base font-semibold text-text-primary">{displayName}</div>
                              <div className="mt-1 text-sm text-text-secondary">
                                {`${meal.time} • ${displayMacros.calories}cal • P:${displayMacros.protein}g C:${displayMacros.carbs}g F:${displayMacros.fat}g`}
                              </div>
                            </div>
                          </div>

                          {isSkipped && (
                            <button
                              type="button"
                              onClick={() => handleUndoSkip(meal.id)}
                              className="mt-3 w-full rounded-brand bg-zinc-800 px-3 py-2 text-sm text-zinc-500"
                            >
                              Skipped — tap to undo
                            </button>
                          )}

                          {!isSkipped && (
                            <div className="mt-3 flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleHadThisClick(meal.id)}
                                className="flex-1 rounded-brand bg-card px-3 py-2 text-sm text-text-primary"
                              >
                                Had this
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSomethingElseClick(meal.id)}
                                className="flex-1 rounded-brand bg-card px-3 py-2 text-sm text-text-primary"
                              >
                                Something else
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSkipMeal(meal.id)}
                                className="flex-1 rounded-brand bg-card px-3 py-2 text-sm text-zinc-500"
                              >
                                Skip
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Supplement List */}
      {supplements.length > 0 && (
        <Card>
          <button
            type="button"
            className="flex w-full items-center justify-between"
            onClick={() => setSuppExpanded((v) => !v)}
          >
            <div className="text-lg font-bold text-white">💊 Supplements</div>
            <div className="text-sm text-text-secondary">
              {(() => {
                const confirmedCount = supplements.filter((s) => getSupplementStatus(s.id)).length;
                return `${confirmedCount} / ${supplements.length} done`;
              })()}
            </div>
          </button>
          {suppExpanded && (
            <div className="mt-3 space-y-2">
              {supplements.filter((s) => !getSupplementStatus(s.id)).map((supplement) => (
                <button
                  key={supplement.id}
                  type="button"
                  onClick={() => handleToggleSupplement(supplement.id)}
                  className="flex w-full items-center gap-3 rounded-brand bg-background p-3"
                >
                  <div className="h-5 w-5 flex items-center justify-center rounded-[4px] border border-text-secondary" />
                  <div className="flex-1 text-left">
                    <div className="text-base text-text-primary">{supplement.name}</div>
                    <div className="text-sm text-text-secondary">{supplement.time}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Edit Plan Button */}
      {(meals.length > 0 || supplements.length > 0) && (
        <button
          type="button"
          onClick={handleOpenEditPlan}
          className="w-full rounded-brand border border-primary px-4 py-3 text-base font-semibold text-primary"
        >
          Edit Plan
        </button>
      )}

      {/* Had This Time Picker Modal */}
      {hadThisMealId && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          onClick={() => setHadThisMealId(null)}
        >
          <div
            className="flex w-full max-w-md flex-col rounded-t-2xl bg-[#141414] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 text-lg font-bold text-text-primary">What time did you eat this?</div>
            <input
              type="time"
              value={hadThisTime}
              onChange={(e) => setHadThisTime(e.target.value)}
              className="mb-4 w-full rounded-brand bg-background px-3 py-2 text-base text-text-primary outline-none"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setHadThisMealId(null)}
                className="flex-1 rounded-brand bg-background px-4 py-3 text-base font-semibold text-text-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmHadThis}
                className="flex-1 rounded-brand bg-primary px-4 py-3 text-base font-semibold text-background"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Last Meal Time Picker Modal */}
      {lastMealPickerId && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          onClick={() => setLastMealPickerId(null)}
        >
          <div
            className="flex w-full max-w-md flex-col rounded-t-2xl bg-[#141414] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 text-lg font-bold text-text-primary">What time did you finish eating?</div>
            <input
              type="time"
              value={lastMealTime}
              onChange={(e) => setLastMealTime(e.target.value)}
              className="mb-4 w-full rounded-brand bg-background px-3 py-2 text-base text-text-primary outline-none"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setLastMealPickerId(null)}
                className="flex-1 rounded-brand bg-background px-4 py-3 text-base font-semibold text-text-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmLastMeal}
                className="flex-1 rounded-brand bg-primary px-4 py-3 text-base font-semibold text-background"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Something Else Modal */}
      {somethingElseMealId && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          onClick={() => setSomethingElseMealId(null)}
        >
          <div
            className="flex h-dvh max-h-[80vh] w-full max-w-md flex-col rounded-t-2xl bg-[#141414]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-[#2a2a2a] p-6 pb-4">
              <div className="text-lg font-bold text-text-primary">What did you have?</div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-6">
              {deviationItems.map((item, index) => (
                <input
                  key={index}
                  ref={index === 0 ? firstInputRef : null}
                  type="text"
                  value={item}
                  onChange={(e) => handleDeviationItemChange(index, e.target.value)}
                  placeholder={index === 0 ? "What did you have?" : "Add another item"}
                  className="w-full rounded-brand bg-background px-3 py-2 text-base text-text-primary outline-none"
                  autoFocus={index === 0}
                />
              ))}

              <button
                type="button"
                onClick={handleAddDeviationItem}
                className="w-full rounded-brand border border-primary px-3 py-2 text-sm text-primary"
              >
                + Add another item
              </button>

              {estimating && (
                <div className="py-2 text-center text-sm text-text-secondary">Estimating...</div>
              )}
              {!estimating && !estimatedMacros && !estimationFailed && (
                <button
                  type="button"
                  onClick={handleEstimateMacros}
                  disabled={deviationItems.filter((i) => i.trim()).length === 0}
                  className={
                    deviationItems.filter((i) => i.trim()).length === 0
                      ? 'w-full rounded-brand bg-gray-700 px-4 py-3 text-base font-semibold text-gray-500 opacity-50'
                      : 'w-full rounded-brand bg-primary px-4 py-3 text-base font-semibold text-background'
                  }
                >
                  Estimate macros
                </button>
              )}

              {estimationFailed && (
                <>
                  <div className="text-center text-base text-red-500">
                    Estimation failed — enter manually
                  </div>
                  {estimationError && (
                    <div className="rounded-brand bg-red-900/20 border border-red-500/30 p-3 text-sm text-red-400 font-mono whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
                      {estimationError}
                    </div>
                  )}
                </>
              )}

              {(estimatedMacros || estimationFailed) && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      value={manualCalories}
                      onChange={(e) => setManualCalories(e.target.value)}
                      placeholder="Calories"
                      className="rounded-brand bg-background px-3 py-2 text-base text-text-primary outline-none"
                    />
                    <input
                      type="number"
                      value={manualProtein}
                      onChange={(e) => setManualProtein(e.target.value)}
                      placeholder="Protein"
                      className="rounded-brand bg-background px-3 py-2 text-base text-text-primary outline-none"
                    />
                    <input
                      type="number"
                      value={manualCarbs}
                      onChange={(e) => setManualCarbs(e.target.value)}
                      placeholder="Carbs"
                      className="rounded-brand bg-background px-3 py-2 text-base text-text-primary outline-none"
                    />
                    <input
                      type="number"
                      value={manualFat}
                      onChange={(e) => setManualFat(e.target.value)}
                      placeholder="Fat"
                      className="rounded-brand bg-background px-3 py-2 text-base text-text-primary outline-none"
                    />
                    <input
                      type="number"
                      value={manualFibre}
                      onChange={(e) => setManualFibre(e.target.value)}
                      placeholder="Fibre"
                      className="rounded-brand bg-background px-3 py-2 text-base text-text-primary outline-none"
                    />
                  </div>

                  {loadFoodLog(dayKey).meals.filter((m) => m.loggedTime).length === 0 && (
                    <>
                      <div className="text-base text-text-secondary">What time did you eat this?</div>
                      <input
                        type="time"
                        value={deviationTime}
                        onChange={(e) => setDeviationTime(e.target.value)}
                        className="w-full rounded-brand bg-background px-3 py-2 text-base text-text-primary outline-none"
                      />
                    </>
                  )}
                  {loadFoodLog(dayKey).meals.filter((m) => m.loggedTime).length > 0 &&
                   somethingElseMealId != null && wouldBeLastMeal(somethingElseMealId) && (
                    <>
                      <div className="text-base text-text-secondary">What time did you finish eating?</div>
                      <input
                        type="time"
                        value={deviationTime}
                        onChange={(e) => setDeviationTime(e.target.value)}
                        className="w-full rounded-brand bg-background px-3 py-2 text-base text-text-primary outline-none"
                      />
                    </>
                  )}
                </>
              )}
            </div>

            <div className="border-t border-[#2a2a2a] p-6 pt-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSomethingElseMealId(null)}
                  className="flex-1 rounded-brand bg-background px-4 py-3 text-base font-semibold text-text-primary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveDeviation}
                  disabled={!manualCalories || !manualProtein || !manualCarbs || !manualFat || !manualFibre}
                  className={
                    manualCalories && manualProtein && manualCarbs && manualFat && manualFibre
                      ? 'flex-1 rounded-brand bg-primary px-4 py-3 text-base font-semibold text-background'
                      : 'flex-1 rounded-brand bg-gray-700 px-4 py-3 text-base font-semibold text-gray-500 opacity-50'
                  }
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Log Modal */}
      {editLogMealId && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          onClick={() => setEditLogMealId(null)}
        >
          <div
            className="flex h-dvh max-h-[80vh] w-full max-w-md flex-col rounded-t-2xl bg-[#141414]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-[#2a2a2a] p-6 pb-4">
              <div className="text-lg font-bold text-text-primary">Edit Log</div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-6">
              <div>
                <div className="mb-1 text-sm text-text-secondary">TIME</div>
                <input
                  type="time"
                  value={editLogTime}
                  onChange={(e) => setEditLogTime(e.target.value)}
                  className="w-full rounded-brand bg-background px-3 py-2 text-base text-text-primary outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="mb-1 text-sm text-text-secondary">CALORIES</div>
                  <input
                    type="number"
                    value={editLogCalories}
                    onChange={(e) => setEditLogCalories(e.target.value)}
                    className="w-full rounded-brand bg-background px-3 py-2 text-base text-text-primary outline-none"
                  />
                </div>
                <div>
                  <div className="mb-1 text-sm text-text-secondary">PROTEIN</div>
                  <input
                    type="number"
                    value={editLogProtein}
                    onChange={(e) => setEditLogProtein(e.target.value)}
                    className="w-full rounded-brand bg-background px-3 py-2 text-base text-text-primary outline-none"
                  />
                </div>
                <div>
                  <div className="mb-1 text-sm text-text-secondary">CARBS</div>
                  <input
                    type="number"
                    value={editLogCarbs}
                    onChange={(e) => setEditLogCarbs(e.target.value)}
                    className="w-full rounded-brand bg-background px-3 py-2 text-base text-text-primary outline-none"
                  />
                </div>
                <div>
                  <div className="mb-1 text-sm text-text-secondary">FAT</div>
                  <input
                    type="number"
                    value={editLogFat}
                    onChange={(e) => setEditLogFat(e.target.value)}
                    className="w-full rounded-brand bg-background px-3 py-2 text-base text-text-primary outline-none"
                  />
                </div>
                <div>
                  <div className="mb-1 text-sm text-text-secondary">FIBRE</div>
                  <input
                    type="number"
                    value={editLogFibre}
                    onChange={(e) => setEditLogFibre(e.target.value)}
                    className="w-full rounded-brand bg-background px-3 py-2 text-base text-text-primary outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-[#2a2a2a] p-6 pt-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditLogMealId(null)}
                  className="flex-1 rounded-brand bg-background px-4 py-3 text-base font-semibold text-text-primary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditLog}
                  className="flex-1 rounded-brand bg-primary px-4 py-3 text-base font-semibold text-background"
                >
                  Save
                </button>
              </div>
              <button
                type="button"
                onClick={() => handleClearAndRelog(editLogMealId!)}
                className="mt-3 w-full text-center text-sm text-red-400"
              >
                Clear &amp; Re-log
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kada Parshad Quantity Modal */}
      {kadaMealId && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          onClick={() => setKadaMealId(null)}
        >
          <div
            className="flex w-full max-w-md flex-col rounded-t-2xl bg-[#141414] p-6"
            style={{ maxHeight: '80vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 text-lg font-bold text-text-primary">Kada Parshad</div>
            <div className="mb-3 text-sm text-text-secondary">How many tablespoons?</div>
            <div className="mb-4 flex items-center gap-4">
              <button
                type="button"
                onClick={() => setKadaQty((q) => Math.max(1, q - 1))}
                className="flex h-12 w-12 items-center justify-center rounded-brand bg-background text-2xl text-text-primary"
              >
                −
              </button>
              <div className="flex-1 text-center text-2xl font-bold text-primary">{kadaQty} tbsp</div>
              <button
                type="button"
                onClick={() => setKadaQty((q) => q + 1)}
                className="flex h-12 w-12 items-center justify-center rounded-brand bg-background text-2xl text-text-primary"
              >
                +
              </button>
            </div>
            <div className="mb-4 rounded-brand bg-background px-4 py-3 text-sm text-text-secondary">
              {Math.round((kadaQty / 2) * KADA_PARSHAD_MACROS.calories)} cal &nbsp;·&nbsp; P:{Math.round((kadaQty / 2) * KADA_PARSHAD_MACROS.protein * 10) / 10}g &nbsp;·&nbsp; C:{Math.round((kadaQty / 2) * KADA_PARSHAD_MACROS.carbs * 10) / 10}g &nbsp;·&nbsp; F:{Math.round((kadaQty / 2) * KADA_PARSHAD_MACROS.fat * 10) / 10}g
            </div>
            {kadaTime !== '' && (
              <>
                <div className="mb-1 text-sm text-text-secondary">What time did you eat this?</div>
                <input
                  type="time"
                  value={kadaTime}
                  onChange={(e) => setKadaTime(e.target.value)}
                  className="mb-4 w-full rounded-brand bg-background px-3 py-2 text-base text-text-primary outline-none"
                />
              </>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setKadaMealId(null)}
                className="flex-1 rounded-brand bg-background px-4 py-3 text-base font-semibold text-text-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => logKadaParshad(kadaMealId, kadaQty, kadaTime || getCurrentTime())}
                className="flex-1 rounded-brand bg-primary px-4 py-3 text-base font-semibold text-background"
              >
                Log {kadaQty} tbsp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Plan Bottom Sheet */}
      {editPlanOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          onClick={handleCloseEditPlan}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-md flex-col rounded-t-2xl bg-[#141414]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-[#2a2a2a] p-6 pb-4">
              <div className="text-lg font-bold text-text-primary">Edit Plan</div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-6">
              {foodPlan.map((item) => (
                <div key={item.id} className="rounded-brand border border-[#2a2a2a] bg-background p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="text-base font-semibold text-text-primary">{item.name}</div>
                        <div className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          {item.type}
                        </div>
                      </div>
                      <div className="mt-1 text-sm text-text-secondary">{item.time}</div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditItem(item)}
                        className="text-sm text-primary"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(item.id)}
                        className="text-sm text-red-500"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {editingItem?.id === item.id && (
                    <div className="mt-3 space-y-2 border-t border-[#2a2a2a] pt-3">
                      <input
                        type="text"
                        value={newItemName}
                        onChange={(e) => setNewItemName(e.target.value)}
                        placeholder="Name *"
                        className="w-full rounded-brand bg-[#141414] px-3 py-2 text-base text-text-primary outline-none"
                      />
                      <input
                        type="time"
                        value={newItemTime}
                        onChange={(e) => setNewItemTime(e.target.value)}
                        className="w-full rounded-brand bg-[#141414] px-3 py-2 text-base text-text-primary outline-none"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          value={newItemCalories}
                          onChange={(e) => setNewItemCalories(e.target.value)}
                          placeholder="Calories"
                          className="rounded-brand bg-[#141414] px-3 py-2 text-base text-text-primary outline-none"
                        />
                        <input
                          type="number"
                          value={newItemProtein}
                          onChange={(e) => setNewItemProtein(e.target.value)}
                          placeholder="Protein"
                          className="rounded-brand bg-[#141414] px-3 py-2 text-base text-text-primary outline-none"
                        />
                        <input
                          type="number"
                          value={newItemCarbs}
                          onChange={(e) => setNewItemCarbs(e.target.value)}
                          placeholder="Carbs"
                          className="rounded-brand bg-[#141414] px-3 py-2 text-base text-text-primary outline-none"
                        />
                        <input
                          type="number"
                          value={newItemFat}
                          onChange={(e) => setNewItemFat(e.target.value)}
                          placeholder="Fat"
                          className="rounded-brand bg-[#141414] px-3 py-2 text-base text-text-primary outline-none"
                        />
                        <input
                          type="number"
                          value={newItemFibre}
                          onChange={(e) => setNewItemFibre(e.target.value)}
                          placeholder="Fibre"
                          className="rounded-brand bg-[#141414] px-3 py-2 text-base text-text-primary outline-none"
                        />
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={() => setVariantsOpen((v) => !v)}
                          className="text-sm text-text-secondary"
                        >
                          Rotation options (optional) {variantsOpen ? '▲' : '▼'}
                        </button>
                        {variantsOpen && (
                          <div className="mt-2 space-y-2">
                            {newItemVariants.map((variant, vIdx) => (
                              <div key={vIdx} className="rounded-brand border border-[#2a2a2a] p-2 space-y-2">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={variant.name}
                                    onChange={(e) => handleVariantNameChange(vIdx, e.target.value)}
                                    placeholder="Variant name"
                                    className="flex-1 rounded-brand bg-background px-2 py-1 text-sm text-text-primary outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveVariant(vIdx)}
                                    className="text-sm text-red-400"
                                  >
                                    Remove
                                  </button>
                                </div>
                                <div className="grid grid-cols-3 gap-1">
                                  <input type="number" value={variant.macros.calories || ''} onChange={(e) => handleVariantMacroChange(vIdx, 'calories', e.target.value)} placeholder="Cal" className="rounded-brand bg-background px-2 py-1 text-sm text-text-primary outline-none" />
                                  <input type="number" value={variant.macros.protein || ''} onChange={(e) => handleVariantMacroChange(vIdx, 'protein', e.target.value)} placeholder="Pro" className="rounded-brand bg-background px-2 py-1 text-sm text-text-primary outline-none" />
                                  <input type="number" value={variant.macros.carbs || ''} onChange={(e) => handleVariantMacroChange(vIdx, 'carbs', e.target.value)} placeholder="Carb" className="rounded-brand bg-background px-2 py-1 text-sm text-text-primary outline-none" />
                                  <input type="number" value={variant.macros.fat || ''} onChange={(e) => handleVariantMacroChange(vIdx, 'fat', e.target.value)} placeholder="Fat" className="rounded-brand bg-background px-2 py-1 text-sm text-text-primary outline-none" />
                                  <input type="number" value={variant.macros.fibre || ''} onChange={(e) => handleVariantMacroChange(vIdx, 'fibre', e.target.value)} placeholder="Fib" className="rounded-brand bg-background px-2 py-1 text-sm text-text-primary outline-none" />
                                </div>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={handleAddVariant}
                              className="text-sm text-primary"
                            >
                              + Add rotation
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingItem(null);
                            resetNewItemForm();
                          }}
                          className="flex-1 rounded-brand bg-[#141414] px-3 py-2 text-sm text-text-secondary"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveEdit}
                          disabled={!newItemName.trim() || !newItemTime.trim()}
                          className={
                            newItemName.trim() && newItemTime.trim()
                              ? 'flex-1 rounded-brand bg-primary px-3 py-2 text-sm font-semibold text-background'
                              : 'flex-1 rounded-brand bg-gray-700 px-3 py-2 text-sm font-semibold text-gray-500 opacity-50'
                          }
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {isAddingMeal && (
                <div className="rounded-brand border-2 border-primary bg-background p-3">
                  <div className="mb-2 text-base font-semibold text-primary">Add Meal</div>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      placeholder="Name *"
                      className="w-full rounded-brand bg-[#141414] px-3 py-2 text-base text-text-primary outline-none"
                    />
                    <input
                      type="time"
                      value={newItemTime}
                      onChange={(e) => setNewItemTime(e.target.value)}
                      className="w-full rounded-brand bg-[#141414] px-3 py-2 text-base text-text-primary outline-none"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        value={newItemCalories}
                        onChange={(e) => setNewItemCalories(e.target.value)}
                        placeholder="Calories"
                        className="rounded-brand bg-[#141414] px-3 py-2 text-base text-text-primary outline-none"
                      />
                      <input
                        type="number"
                        value={newItemProtein}
                        onChange={(e) => setNewItemProtein(e.target.value)}
                        placeholder="Protein"
                        className="rounded-brand bg-[#141414] px-3 py-2 text-base text-text-primary outline-none"
                      />
                      <input
                        type="number"
                        value={newItemCarbs}
                        onChange={(e) => setNewItemCarbs(e.target.value)}
                        placeholder="Carbs"
                        className="rounded-brand bg-[#141414] px-3 py-2 text-base text-text-primary outline-none"
                      />
                      <input
                        type="number"
                        value={newItemFat}
                        onChange={(e) => setNewItemFat(e.target.value)}
                        placeholder="Fat"
                        className="rounded-brand bg-[#141414] px-3 py-2 text-base text-text-primary outline-none"
                      />
                      <input
                        type="number"
                        value={newItemFibre}
                        onChange={(e) => setNewItemFibre(e.target.value)}
                        placeholder="Fibre"
                        className="rounded-brand bg-[#141414] px-3 py-2 text-base text-text-primary outline-none"
                      />
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => setVariantsOpen((v) => !v)}
                        className="text-sm text-text-secondary"
                      >
                        Rotation options (optional) {variantsOpen ? '▲' : '▼'}
                      </button>
                      {variantsOpen && (
                        <div className="mt-2 space-y-2">
                          {newItemVariants.map((variant, vIdx) => (
                            <div key={vIdx} className="rounded-brand border border-[#2a2a2a] p-2 space-y-2">
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={variant.name}
                                  onChange={(e) => handleVariantNameChange(vIdx, e.target.value)}
                                  placeholder="Variant name"
                                  className="flex-1 rounded-brand bg-[#141414] px-2 py-1 text-sm text-text-primary outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleRemoveVariant(vIdx)}
                                  className="text-sm text-red-400"
                                >
                                  Remove
                                </button>
                              </div>
                              <div className="grid grid-cols-3 gap-1">
                                <input type="number" value={variant.macros.calories || ''} onChange={(e) => handleVariantMacroChange(vIdx, 'calories', e.target.value)} placeholder="Cal" className="rounded-brand bg-[#141414] px-2 py-1 text-sm text-text-primary outline-none" />
                                <input type="number" value={variant.macros.protein || ''} onChange={(e) => handleVariantMacroChange(vIdx, 'protein', e.target.value)} placeholder="Pro" className="rounded-brand bg-[#141414] px-2 py-1 text-sm text-text-primary outline-none" />
                                <input type="number" value={variant.macros.carbs || ''} onChange={(e) => handleVariantMacroChange(vIdx, 'carbs', e.target.value)} placeholder="Carb" className="rounded-brand bg-[#141414] px-2 py-1 text-sm text-text-primary outline-none" />
                                <input type="number" value={variant.macros.fat || ''} onChange={(e) => handleVariantMacroChange(vIdx, 'fat', e.target.value)} placeholder="Fat" className="rounded-brand bg-[#141414] px-2 py-1 text-sm text-text-primary outline-none" />
                                <input type="number" value={variant.macros.fibre || ''} onChange={(e) => handleVariantMacroChange(vIdx, 'fibre', e.target.value)} placeholder="Fib" className="rounded-brand bg-[#141414] px-2 py-1 text-sm text-text-primary outline-none" />
                              </div>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={handleAddVariant}
                            className="text-sm text-primary"
                          >
                            + Add rotation
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingMeal(false);
                          resetNewItemForm();
                        }}
                        className="flex-1 rounded-brand bg-[#141414] px-3 py-2 text-sm text-text-secondary"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveNewItem}
                        disabled={!newItemName.trim() || !newItemTime.trim()}
                        className={
                          newItemName.trim() && newItemTime.trim()
                            ? 'flex-1 rounded-brand bg-primary px-3 py-2 text-sm font-semibold text-background'
                            : 'flex-1 rounded-brand bg-gray-700 px-3 py-2 text-sm font-semibold text-gray-500 opacity-50'
                        }
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {isAddingSupplement && (
                <div className="rounded-brand border-2 border-primary bg-background p-3">
                  <div className="mb-2 text-base font-semibold text-primary">Add Supplement</div>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      placeholder="Name *"
                      className="w-full rounded-brand bg-[#141414] px-3 py-2 text-base text-text-primary outline-none"
                    />
                    <input
                      type="time"
                      value={newItemTime}
                      onChange={(e) => setNewItemTime(e.target.value)}
                      className="w-full rounded-brand bg-[#141414] px-3 py-2 text-base text-text-primary outline-none"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingSupplement(false);
                          resetNewItemForm();
                        }}
                        className="flex-1 rounded-brand bg-[#141414] px-3 py-2 text-sm text-text-secondary"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveNewItem}
                        disabled={!newItemName.trim() || !newItemTime.trim()}
                        className={
                          newItemName.trim() && newItemTime.trim()
                            ? 'flex-1 rounded-brand bg-primary px-3 py-2 text-sm font-semibold text-background'
                            : 'flex-1 rounded-brand bg-gray-700 px-3 py-2 text-sm font-semibold text-gray-500 opacity-50'
                        }
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {!isAddingMeal && !isAddingSupplement && !editingItem && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleStartAddMeal}
                    className="flex-1 rounded-brand border border-primary px-4 py-3 text-base font-semibold text-primary"
                  >
                    + Add Meal
                  </button>
                  <button
                    type="button"
                    onClick={handleStartAddSupplement}
                    className="flex-1 rounded-brand border border-primary px-4 py-3 text-base font-semibold text-primary"
                  >
                    + Add Supplement
                  </button>
                </div>
              )}
            </div>

            <div className="border-t border-[#2a2a2a] p-6 pt-4">
              <button
                type="button"
                onClick={handleCloseEditPlan}
                className="w-full rounded-brand bg-background px-4 py-3 text-base font-semibold text-text-primary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
