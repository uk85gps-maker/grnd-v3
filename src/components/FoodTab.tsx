import { useState, useMemo } from 'react';
import { getGrndDayKey } from '@/utils/dayKey';
import { FoodPlanItem, runMigrationIfNeeded } from '@/utils/foodMigration';
import { getMacroTargets, MacroTargets } from '@/utils/mealPlan';

interface FoodLogEntry {
  id: string;
  name: string;
  time: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
  type: 'on-plan' | 'deviation' | 'fast';
  planItemId?: string;
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#2a2a2a] bg-[#141414] p-4">
      {children}
    </div>
  );
}

export default function FoodTab() {
  const dayKey = useMemo(() => getGrndDayKey(), []);
  const foodLogKey = `grnd_food_log_${dayKey}`;

  // Run migration and load food plan synchronously
  const [foodPlan, setFoodPlan] = useState<FoodPlanItem[]>(() => {
    runMigrationIfNeeded();
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

  // Load targets
  const targets = useMemo<MacroTargets>(() => getMacroTargets(), []);

  // Load daily totals from food log
  const dailyTotals = useMemo(() => {
    const raw = localStorage.getItem(foodLogKey);
    if (!raw) {
      return { calories: 0, protein: 0 };
    }
    try {
      const entries = JSON.parse(raw) as FoodLogEntry[];
      return entries.reduce(
        (acc, e) => ({
          calories: acc.calories + e.calories,
          protein: acc.protein + e.protein,
        }),
        { calories: 0, protein: 0 }
      );
    } catch {
      return { calories: 0, protein: 0 };
    }
  }, [foodLogKey]);

  // Separate meals and supplements
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
      purpose: '',
      order: foodPlan.length,
    };

    const updated = [...foodPlan, newItem];
    localStorage.setItem('grnd_food_plan', JSON.stringify(updated));
    
    // Save to edit history
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
  };

  const handleSaveEdit = () => {
    if (!editingItem || !newItemName.trim() || !newItemTime.trim()) return;

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
          }
        : item
    );

    localStorage.setItem('grnd_food_plan', JSON.stringify(updated));
    
    // Save to edit history
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
    // Check if item has any log entries
    const hasLogEntries = false; // TODO: Check grnd_food_log for this item
    
    if (hasLogEntries) {
      // Soft delete
      const updated = foodPlan.map((item) =>
        item.id === itemId ? { ...item, deleted: true } as any : item
      );
      localStorage.setItem('grnd_food_plan', JSON.stringify(updated));
      setFoodPlan(updated);
    } else {
      // Hard delete
      const updated = foodPlan.filter((item) => item.id !== itemId);
      localStorage.setItem('grnd_food_plan', JSON.stringify(updated));
      
      // Save to edit history
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
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-4 pb-20">
      {/* Summary Bar */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-text-secondary">CALORIES</div>
            <div className="mt-1 text-lg font-bold text-primary">
              {dailyTotals.calories} / {targets.calories}
            </div>
          </div>
          <div>
            <div className="text-xs text-text-secondary">PROTEIN</div>
            <div className="mt-1 text-lg font-bold text-primary">
              {dailyTotals.protein}g / {targets.protein}g
            </div>
          </div>
          <div>
            <div className="text-xs text-text-secondary">FASTING</div>
            <div className="mt-1 text-lg font-bold text-text-secondary">-- hrs</div>
          </div>
        </div>
      </Card>

      {/* Empty State */}
      {meals.length === 0 && supplements.length === 0 && (
        <Card>
          <div className="py-8 text-center">
            <div className="mb-4 text-sm text-text-secondary">No meals added yet</div>
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
          <div className="mb-3 text-base font-bold text-white">🍽️ Meals</div>
          <div className="space-y-3">
            {meals.map((meal) => (
              <div key={meal.id} className="rounded-brand bg-background p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-text-primary">{meal.name}</div>
                    <div className="mt-1 text-xs text-text-secondary">
                      {meal.time} • {meal.plannedMacros.calories}cal • P:{meal.plannedMacros.protein}g C:{meal.plannedMacros.carbs}g F:{meal.plannedMacros.fat}g
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled
                    className="flex-1 rounded-brand bg-card px-3 py-2 text-xs text-text-secondary opacity-50"
                  >
                    Had this
                  </button>
                  <button
                    type="button"
                    disabled
                    className="flex-1 rounded-brand bg-card px-3 py-2 text-xs text-text-secondary opacity-50"
                  >
                    Something else
                  </button>
                  <button
                    type="button"
                    disabled
                    className="flex-1 rounded-brand bg-card px-3 py-2 text-xs text-text-secondary opacity-50"
                  >
                    Fast
                  </button>
                </div>
                <div className="mt-1 text-center text-[10px] text-text-secondary">(coming soon)</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Supplement List */}
      {supplements.length > 0 && (
        <Card>
          <div className="mb-3 text-base font-bold text-white">💊 Supplements</div>
          <div className="space-y-2">
            {supplements.map((supplement) => (
              <div key={supplement.id} className="flex items-center gap-3 rounded-brand bg-background p-3">
                <div className="h-5 w-5 rounded-[4px] border border-text-secondary opacity-50" />
                <div className="flex-1">
                  <div className="text-sm text-text-primary">{supplement.name}</div>
                  <div className="text-xs text-text-secondary">{supplement.time}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Edit Plan Button */}
      {(meals.length > 0 || supplements.length > 0) && (
        <button
          type="button"
          onClick={handleOpenEditPlan}
          className="w-full rounded-brand border border-primary px-4 py-3 text-sm font-semibold text-primary"
        >
          Edit Plan
        </button>
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
              {/* Existing Items */}
              {foodPlan.map((item) => (
                <div key={item.id} className="rounded-brand border border-[#2a2a2a] bg-background p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-semibold text-text-primary">{item.name}</div>
                        <div className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          {item.type}
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-text-secondary">{item.time}</div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditItem(item)}
                        className="text-xs text-primary"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(item.id)}
                        className="text-xs text-red-500"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Inline Edit Form */}
                  {editingItem?.id === item.id && (
                    <div className="mt-3 space-y-2 border-t border-[#2a2a2a] pt-3">
                      <input
                        type="text"
                        value={newItemName}
                        onChange={(e) => setNewItemName(e.target.value)}
                        placeholder="Name *"
                        className="w-full rounded-brand bg-[#141414] px-3 py-2 text-sm text-text-primary outline-none"
                      />
                      <input
                        type="time"
                        value={newItemTime}
                        onChange={(e) => setNewItemTime(e.target.value)}
                        className="w-full rounded-brand bg-[#141414] px-3 py-2 text-sm text-text-primary outline-none"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          value={newItemCalories}
                          onChange={(e) => setNewItemCalories(e.target.value)}
                          placeholder="Calories"
                          className="rounded-brand bg-[#141414] px-3 py-2 text-sm text-text-primary outline-none"
                        />
                        <input
                          type="number"
                          value={newItemProtein}
                          onChange={(e) => setNewItemProtein(e.target.value)}
                          placeholder="Protein"
                          className="rounded-brand bg-[#141414] px-3 py-2 text-sm text-text-primary outline-none"
                        />
                        <input
                          type="number"
                          value={newItemCarbs}
                          onChange={(e) => setNewItemCarbs(e.target.value)}
                          placeholder="Carbs"
                          className="rounded-brand bg-[#141414] px-3 py-2 text-sm text-text-primary outline-none"
                        />
                        <input
                          type="number"
                          value={newItemFat}
                          onChange={(e) => setNewItemFat(e.target.value)}
                          placeholder="Fat"
                          className="rounded-brand bg-[#141414] px-3 py-2 text-sm text-text-primary outline-none"
                        />
                        <input
                          type="number"
                          value={newItemFibre}
                          onChange={(e) => setNewItemFibre(e.target.value)}
                          placeholder="Fibre"
                          className="rounded-brand bg-[#141414] px-3 py-2 text-sm text-text-primary outline-none"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingItem(null);
                            resetNewItemForm();
                          }}
                          className="flex-1 rounded-brand bg-[#141414] px-3 py-2 text-xs text-text-secondary"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveEdit}
                          disabled={!newItemName.trim() || !newItemTime.trim()}
                          className={
                            newItemName.trim() && newItemTime.trim()
                              ? 'flex-1 rounded-brand bg-primary px-3 py-2 text-xs font-semibold text-background'
                              : 'flex-1 rounded-brand bg-gray-700 px-3 py-2 text-xs font-semibold text-gray-500 opacity-50'
                          }
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Add Meal Form */}
              {isAddingMeal && (
                <div className="rounded-brand border-2 border-primary bg-background p-3">
                  <div className="mb-2 text-sm font-semibold text-primary">Add Meal</div>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      placeholder="Name *"
                      className="w-full rounded-brand bg-[#141414] px-3 py-2 text-sm text-text-primary outline-none"
                    />
                    <input
                      type="time"
                      value={newItemTime}
                      onChange={(e) => setNewItemTime(e.target.value)}
                      className="w-full rounded-brand bg-[#141414] px-3 py-2 text-sm text-text-primary outline-none"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        value={newItemCalories}
                        onChange={(e) => setNewItemCalories(e.target.value)}
                        placeholder="Calories"
                        className="rounded-brand bg-[#141414] px-3 py-2 text-sm text-text-primary outline-none"
                      />
                      <input
                        type="number"
                        value={newItemProtein}
                        onChange={(e) => setNewItemProtein(e.target.value)}
                        placeholder="Protein"
                        className="rounded-brand bg-[#141414] px-3 py-2 text-sm text-text-primary outline-none"
                      />
                      <input
                        type="number"
                        value={newItemCarbs}
                        onChange={(e) => setNewItemCarbs(e.target.value)}
                        placeholder="Carbs"
                        className="rounded-brand bg-[#141414] px-3 py-2 text-sm text-text-primary outline-none"
                      />
                      <input
                        type="number"
                        value={newItemFat}
                        onChange={(e) => setNewItemFat(e.target.value)}
                        placeholder="Fat"
                        className="rounded-brand bg-[#141414] px-3 py-2 text-sm text-text-primary outline-none"
                      />
                      <input
                        type="number"
                        value={newItemFibre}
                        onChange={(e) => setNewItemFibre(e.target.value)}
                        placeholder="Fibre"
                        className="rounded-brand bg-[#141414] px-3 py-2 text-sm text-text-primary outline-none"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingMeal(false);
                          resetNewItemForm();
                        }}
                        className="flex-1 rounded-brand bg-[#141414] px-3 py-2 text-xs text-text-secondary"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveNewItem}
                        disabled={!newItemName.trim() || !newItemTime.trim()}
                        className={
                          newItemName.trim() && newItemTime.trim()
                            ? 'flex-1 rounded-brand bg-primary px-3 py-2 text-xs font-semibold text-background'
                            : 'flex-1 rounded-brand bg-gray-700 px-3 py-2 text-xs font-semibold text-gray-500 opacity-50'
                        }
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Add Supplement Form */}
              {isAddingSupplement && (
                <div className="rounded-brand border-2 border-primary bg-background p-3">
                  <div className="mb-2 text-sm font-semibold text-primary">Add Supplement</div>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      placeholder="Name *"
                      className="w-full rounded-brand bg-[#141414] px-3 py-2 text-sm text-text-primary outline-none"
                    />
                    <input
                      type="time"
                      value={newItemTime}
                      onChange={(e) => setNewItemTime(e.target.value)}
                      className="w-full rounded-brand bg-[#141414] px-3 py-2 text-sm text-text-primary outline-none"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingSupplement(false);
                          resetNewItemForm();
                        }}
                        className="flex-1 rounded-brand bg-[#141414] px-3 py-2 text-xs text-text-secondary"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveNewItem}
                        disabled={!newItemName.trim() || !newItemTime.trim()}
                        className={
                          newItemName.trim() && newItemTime.trim()
                            ? 'flex-1 rounded-brand bg-primary px-3 py-2 text-xs font-semibold text-background'
                            : 'flex-1 rounded-brand bg-gray-700 px-3 py-2 text-xs font-semibold text-gray-500 opacity-50'
                        }
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Add Buttons */}
              {!isAddingMeal && !isAddingSupplement && !editingItem && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleStartAddMeal}
                    className="flex-1 rounded-brand border border-primary px-4 py-3 text-sm font-semibold text-primary"
                  >
                    + Add Meal
                  </button>
                  <button
                    type="button"
                    onClick={handleStartAddSupplement}
                    className="flex-1 rounded-brand border border-primary px-4 py-3 text-sm font-semibold text-primary"
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
                className="w-full rounded-brand bg-background px-4 py-3 text-sm font-semibold text-text-primary"
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
