import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatHeaderDate, getGrndDayKey, previousDayKey } from '@/utils/dayKey';
import { ChecklistItem, ChecklistSection, DailyCompletion } from '@/utils/checklistTypes';
import { DEFAULT_CHECKLIST } from '@/utils/defaultChecklist';
import { STORAGE_KEYS, MoodLogEntry, MacroLogEntry } from '@/utils/coachContext';
import { getMealPlanDefaults, getMacroTargets, saveMealPlanDefaults, saveMacroTargets, MealPlanItem, MacroTargets } from '@/utils/mealPlan';

type SleepLog = {
  bedTime: string;
  wakeTime: string;
  energy: number | null;
};

type SectionMoodState = {
  energy: number | null;
  mood: number | null;
  cause: string;
};

const DEFAULT_CAUSES = [
  'Work stress',
  'Poor sleep',
  'Good win',
  'Training session',
  'Social interaction',
  'Spiritual practice',
  'Ate well',
  'Skipped meals',
  'Argument',
  'Fatigue',
];

const CHECKLIST_STRUCTURE_KEY = 'grnd_checklist_structure';

function parseTimeToMinutes(t: string) {
  const [hh, mm] = t.split(':').map((v) => Number(v));
  return (hh ?? 0) * 60 + (mm ?? 0);
}

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

function Card({ children, accentLeft }: { children: React.ReactNode; accentLeft?: boolean }) {
  return (
    <div
      className={
        accentLeft
          ? 'rounded-brand bg-card p-4 border-l-[3px] border-primary'
          : 'rounded-brand bg-card p-4'
      }
    >
      {children}
    </div>
  );
}

function Arrow({ direction, color }: { direction: 'up' | 'down' | 'right'; color: 'gold' | 'grey' }) {
  const stroke = color === 'gold' ? 'text-primary' : 'text-text-secondary';
  const d =
    direction === 'up'
      ? 'M12 19V5m0 0l-5 5m5-5l5 5'
      : direction === 'down'
        ? 'M12 5v14m0 0l-5-5m5 5l5-5'
        : 'M5 12h14m0 0l-5-5m5 5l-5 5';

  return (
    <svg viewBox="0 0 24 24" className={`h-4 w-4 ${stroke}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <div
      className={
        checked
          ? 'h-5 w-5 rounded-[4px] bg-primary flex items-center justify-center'
          : 'h-5 w-5 rounded-[4px] border border-text-secondary'
      }
    >
      {checked ? (
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-white" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      ) : null}
    </div>
  );
}

export default function Today() {
  const navigate = useNavigate();
  const dayKey = useMemo(() => getGrndDayKey(), []);
  const completionKey = `grnd_checklist_${dayKey}`;
  const sleepKey = `${STORAGE_KEYS.SLEEP_LOG}_${dayKey}`;
  const moodKey = `${STORAGE_KEYS.MOOD_LOG}_${dayKey}`;

  // Load checklist structure from localStorage or use default
  const [sections, setSections] = useState<ChecklistSection[]>(() => {
    const stored = localStorage.getItem(CHECKLIST_STRUCTURE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored) as ChecklistSection[];
      } catch {
        return DEFAULT_CHECKLIST;
      }
    }
    return DEFAULT_CHECKLIST;
  });

  // Save structure whenever it changes
  useEffect(() => {
    localStorage.setItem(CHECKLIST_STRUCTURE_KEY, JSON.stringify(sections));
  }, [sections]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(sections.map((s) => [s.id, true]))
  );

  // Load daily completion (ID-based)
  const [completedIds, setCompletedIds] = useState<string[]>([]);

  const [sleep, setSleep] = useState<SleepLog>({
    bedTime: '20:30',
    wakeTime: '04:30',
    energy: null,
  });
  const [sleepSaved, setSleepSaved] = useState<SleepLog | null>(null);
  const [sleepEditing, setSleepEditing] = useState(true);

  // Mood/Energy log state - per section
  const [moodEntries, setMoodEntries] = useState<MoodLogEntry[]>([]);
  const [sectionMoodStates, setSectionMoodStates] = useState<Record<string, SectionMoodState>>({});
  const [editingMoodSection, setEditingMoodSection] = useState<string | null>(null);
  const [causes, setCauses] = useState<string[]>([]);
  const [newCause, setNewCause] = useState('');
  const [showAddCause, setShowAddCause] = useState<Record<string, boolean>>({});

  // Macro tracking state
  const [macroEntries, setMacroEntries] = useState<MacroLogEntry[]>([]);
  const [mealPlanDefaults, setMealPlanDefaults] = useState<MealPlanItem[]>([]);
  const [macroTargets, setMacroTargets] = useState<MacroTargets>({ calories: 1435, protein: 116.5, carbs: 102.2, fat: 57.9 });
  const [editMealPlanModal, setEditMealPlanModal] = useState(false);
  const [usdaSearchModal, setUsdaSearchModal] = useState(false);
  const [editingMeal, setEditingMeal] = useState<MealPlanItem | null>(null);
  const [newMeal, setNewMeal] = useState<Partial<MealPlanItem>>({});
  const [usdaSearchQuery, setUsdaSearchQuery] = useState('');
  const [usdaResults, setUsdaResults] = useState<any[]>([]);
  const [usdaLoading, setUsdaLoading] = useState(false);
  const [usdaError, setUsdaError] = useState('');
  const [selectedUsdaFood, setSelectedUsdaFood] = useState<any>(null);
  const [usdaQuantity, setUsdaQuantity] = useState('');
  const [manualMealEntry, setManualMealEntry] = useState<Partial<MacroLogEntry>>({});
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [editTargetsMode, setEditTargetsMode] = useState(false);
  const [tempTargets, setTempTargets] = useState<MacroTargets>({ calories: 1435, protein: 116.5, carbs: 102.2, fat: 57.9 });

  // Edit mode state
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<ChecklistItem | null>(null);
  const [addItemSection, setAddItemSection] = useState<string | null>(null);
  const [newItem, setNewItem] = useState({
    name: '',
    time: '',
    layer: 'Foundation',
    purpose: '',
    consequence: '',
  });
  const [deleteConfirm, setDeleteConfirm] = useState<{ sectionId: string; itemId: string } | null>(null);
  const [showValidation, setShowValidation] = useState(false);
  const [weeklyExpanded, setWeeklyExpanded] = useState(false);

  useEffect(() => {
    // Load causes library
    const storedCauses = localStorage.getItem(STORAGE_KEYS.MOOD_CAUSES);
    if (storedCauses) {
      try {
        setCauses(JSON.parse(storedCauses) as string[]);
      } catch {
        setCauses(DEFAULT_CAUSES);
        localStorage.setItem(STORAGE_KEYS.MOOD_CAUSES, JSON.stringify(DEFAULT_CAUSES));
      }
    } else {
      setCauses(DEFAULT_CAUSES);
      localStorage.setItem(STORAGE_KEYS.MOOD_CAUSES, JSON.stringify(DEFAULT_CAUSES));
    }

    const raw = localStorage.getItem(completionKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as DailyCompletion;
        let ids = parsed.completedIds ?? [];
        
        // Check if it's Monday and reset weekly items
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday
        const hour = now.getHours();
        const minute = now.getMinutes();
        
        // If it's Monday at or after 4:30am, clear weekly item completions
        if (dayOfWeek === 1 && (hour > 4 || (hour === 4 && minute >= 30))) {
          const lastResetKey = 'grnd_weekly_last_reset';
          const lastReset = localStorage.getItem(lastResetKey);
          const currentWeekStart = new Date(now);
          currentWeekStart.setHours(4, 30, 0, 0);
          currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay() + 1); // Monday
          
          // Only reset if we haven't reset this week yet
          if (!lastReset || new Date(lastReset) < currentWeekStart) {
            // Filter out weekly item IDs - get from sections directly
            const weeklySection = sections.find(s => s.id === 'weekly-environment');
            const weeklyItemIds = weeklySection?.items.map(item => item.id) || [];
            ids = ids.filter(id => !weeklyItemIds.includes(id));
            
            // Save the reset timestamp
            localStorage.setItem(lastResetKey, currentWeekStart.toISOString());
            
            // Update storage with filtered IDs
            const updatedCompletion: DailyCompletion = { completedIds: ids };
            localStorage.setItem(completionKey, JSON.stringify(updatedCompletion));
          }
        }
        
        setCompletedIds(ids);
      } catch {
        setCompletedIds([]);
      }
    }

    const rawSleep = localStorage.getItem(sleepKey);
    if (rawSleep) {
      try {
        const parsed = JSON.parse(rawSleep) as SleepLog;
        setSleepSaved(parsed);
        setSleep(parsed);
        setSleepEditing(false);
      } catch {
        setSleepSaved(null);
        setSleepEditing(true);
      }
    }

    const rawMood = localStorage.getItem(moodKey);
    if (rawMood) {
      try {
        const parsed = JSON.parse(rawMood) as MoodLogEntry[];
        setMoodEntries(parsed);
      } catch {
        setMoodEntries([]);
      }
    }

    // Load macro data
    const macroKey = `${STORAGE_KEYS.MACRO_LOG}_${dayKey}`;
    const rawMacro = localStorage.getItem(macroKey);
    if (rawMacro) {
      try {
        const parsed = JSON.parse(rawMacro) as MacroLogEntry[];
        setMacroEntries(parsed);
      } catch {
        setMacroEntries([]);
      }
    }

    // Load meal plan defaults and macro targets
    const defaults = getMealPlanDefaults();
    setMealPlanDefaults(defaults);
    const targets = getMacroTargets();
    setMacroTargets(targets);
    setTempTargets(targets);
  }, [completionKey, sleepKey, moodKey, dayKey]);

  useEffect(() => {
    const completion: DailyCompletion = { completedIds };
    localStorage.setItem(completionKey, JSON.stringify(completion));
  }, [completionKey, completedIds]);

  const dailySections = useMemo(() => sections.filter((s) => s.id !== 'weekly-environment'), [sections]);
  const weeklySection = useMemo(() => sections.find((s) => s.id === 'weekly-environment'), [sections]);
  
  const allItems = useMemo(() => dailySections.flatMap((s) => s.items), [dailySections]);
  const totalCount = allItems.length;
  const checkedCount = completedIds.filter((id) => allItems.some((item) => item.id === id)).length;
  
  const weeklyItems = useMemo(() => weeklySection?.items || [], [weeklySection]);
  const weeklyCheckedCount = useMemo(() => 
    completedIds.filter((id) => weeklyItems.some((item) => item.id === id)).length,
    [completedIds, weeklyItems]
  );

  const sleepDurationMinutes = useMemo(() => {
    const bed = parseTimeToMinutes(sleep.bedTime);
    let wake = parseTimeToMinutes(sleep.wakeTime);
    if (wake <= bed) wake += 24 * 60;
    return Math.max(0, wake - bed);
  }, [sleep.bedTime, sleep.wakeTime]);

  const yesterdayProof = useMemo(() => {
    const prevKey = previousDayKey(dayKey);
    const prevChecklist = localStorage.getItem(`grnd_checklist_${prevKey}`);
    if (!prevChecklist) return null;

    try {
      JSON.parse(prevChecklist);
      return 'You showed up 3 days this week. The man who said he would — did.';
    } catch {
      return null;
    }
  }, [dayKey]);

  // Macro tracking handlers - defined before handleToggleItem to avoid reference errors
  const macroKey = `${STORAGE_KEYS.MACRO_LOG}_${dayKey}`;

  const handleToggleMealConfirm = (mealId: string) => {
    const existing = macroEntries.find((e) => e.id === mealId);
    let updated: MacroLogEntry[];

    if (existing) {
      // Toggle confirmation
      updated = macroEntries.map((e) => (e.id === mealId ? { ...e, confirmed: !e.confirmed } : e));
    } else {
      // Add from defaults
      const defaultMeal = mealPlanDefaults.find((m) => m.id === mealId);
      if (!defaultMeal) return;

      const newEntry: MacroLogEntry = {
        id: defaultMeal.id,
        name: defaultMeal.name,
        time: defaultMeal.time,
        calories: defaultMeal.calories,
        protein: defaultMeal.protein,
        carbs: defaultMeal.carbs,
        fat: defaultMeal.fat,
        source: 'default',
        confirmed: true,
        purpose: defaultMeal.purpose,
      };
      updated = [...macroEntries, newEntry];
    }

    setMacroEntries(updated);
    localStorage.setItem(macroKey, JSON.stringify(updated));
  };

  const handleToggleItem = (id: string) => {
    const isCurrentlyCompleted = completedIds.includes(id);
    
    // Find the item to get its name
    const item = allItems.find((i) => i.id === id);
    
    if (item && macroEntries && macroEntries.length > 0) {
      // Try to find a matching meal by name (case insensitive, trimmed)
      const itemName = item.name.trim().toLowerCase();
      const matchingMeal = macroEntries.find(
        (meal) => meal.name.trim().toLowerCase() === itemName
      );
      
      if (matchingMeal) {
        // Auto-confirm or unconfirm the matching meal
        if (!isCurrentlyCompleted) {
          // Ticking the item - confirm the meal if not already confirmed
          if (!matchingMeal.confirmed) {
            handleToggleMealConfirm(matchingMeal.id);
          }
        } else {
          // Unticking the item - unconfirm the meal if currently confirmed
          if (matchingMeal.confirmed) {
            handleToggleMealConfirm(matchingMeal.id);
          }
        }
      }
    }
    
    // Update checklist completion as normal
    setCompletedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSaveSleep = () => {
    localStorage.setItem(sleepKey, JSON.stringify(sleep));
    setSleepSaved(sleep);
    setSleepEditing(false);
  };

  const toggleEnergy = (n: number) => {
    setSleep((prev) => ({ ...prev, energy: prev.energy === n ? null : n }));
  };

  const toggleSectionMoodEnergy = (sectionId: string, n: number) => {
    setSectionMoodStates((prev) => ({
      ...prev,
      [sectionId]: {
        ...prev[sectionId],
        energy: prev[sectionId]?.energy === n ? null : n,
      },
    }));
  };

  const toggleSectionMoodRating = (sectionId: string, n: number) => {
    setSectionMoodStates((prev) => ({
      ...prev,
      [sectionId]: {
        ...prev[sectionId],
        mood: prev[sectionId]?.mood === n ? null : n,
      },
    }));
  };

  const handleSelectSectionCause = (sectionId: string, cause: string) => {
    setSectionMoodStates((prev) => ({
      ...prev,
      [sectionId]: {
        ...prev[sectionId],
        cause: prev[sectionId]?.cause === cause ? '' : cause,
      },
    }));
  };

  const handleSaveSectionMood = (sectionId: string, sectionName: string) => {
    const state = sectionMoodStates[sectionId];
    if (!state || !state.energy || !state.mood || !state.cause) return;

    const entry: MoodLogEntry = {
      section: sectionId,
      sectionName,
      timestamp: new Date().toISOString(),
      energy: state.energy,
      mood: state.mood,
      cause: state.cause,
    };

    const updatedEntries = [...moodEntries.filter((e) => e.section !== sectionId), entry];
    setMoodEntries(updatedEntries);
    localStorage.setItem(moodKey, JSON.stringify(updatedEntries));
    setEditingMoodSection(null);
    setSectionMoodStates((prev) => {
      const updated = { ...prev };
      delete updated[sectionId];
      return updated;
    });
  };

  const handleAddCauseForSection = (sectionId: string) => {
    if (!newCause.trim()) return;
    const updatedCauses = [...causes, newCause.trim()];
    setCauses(updatedCauses);
    localStorage.setItem(STORAGE_KEYS.MOOD_CAUSES, JSON.stringify(updatedCauses));
    setSectionMoodStates((prev) => ({
      ...prev,
      [sectionId]: {
        ...prev[sectionId],
        cause: newCause.trim(),
      },
    }));
    setNewCause('');
    setShowAddCause((prev) => ({ ...prev, [sectionId]: false }));
  };

  const getSectionMoodEntry = (sectionId: string): MoodLogEntry | undefined => {
    return moodEntries.find((e) => e.section === sectionId);
  };

  const getSectionMoodState = (sectionId: string): SectionMoodState => {
    return sectionMoodStates[sectionId] || { energy: null, mood: null, cause: '' };
  };

  // Additional macro handlers

  const handleSearchUsda = async () => {
    if (!usdaSearchQuery.trim()) return;

    setUsdaLoading(true);
    setUsdaError('');
    setUsdaResults([]);

    try {
      const response = await fetch(
        `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(usdaSearchQuery)}&api_key=DEMO_KEY`
      );

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      const foods = data.foods || [];

      if (foods.length === 0) {
        setUsdaError('No results found. Enter manually.');
        setShowManualEntry(true);
      } else {
        setUsdaResults(foods);
      }
    } catch (error) {
      setUsdaError('Search unavailable offline. Enter manually.');
      setShowManualEntry(true);
    } finally {
      setUsdaLoading(false);
    }
  };

  const handleSelectUsdaFood = (food: any) => {
    setSelectedUsdaFood(food);
  };

  const handleConfirmUsdaFood = () => {
    if (!selectedUsdaFood || !usdaQuantity) return;

    const quantity = parseFloat(usdaQuantity);
    if (isNaN(quantity) || quantity <= 0) return;

    // Parse nutrients safely
    const nutrients = selectedUsdaFood.foodNutrients || [];
    const getNutrient = (id: number) => {
      const n = nutrients.find((n: any) => n.nutrientId === id);
      return n?.value || 0;
    };

    const caloriesPer100g = getNutrient(1008); // Energy
    const proteinPer100g = getNutrient(1003); // Protein
    const carbsPer100g = getNutrient(1005); // Carbs
    const fatPer100g = getNutrient(1004); // Fat

    const factor = quantity / 100;

    const newEntry: MacroLogEntry = {
      id: `usda-${Date.now()}`,
      name: selectedUsdaFood.description || 'Custom food',
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      calories: Math.round(caloriesPer100g * factor),
      protein: Math.round(proteinPer100g * factor * 10) / 10,
      carbs: Math.round(carbsPer100g * factor * 10) / 10,
      fat: Math.round(fatPer100g * factor * 10) / 10,
      source: 'usda',
      confirmed: true,
      purpose: 'Custom meal',
    };

    const updated = [...macroEntries, newEntry];
    setMacroEntries(updated);
    localStorage.setItem(macroKey, JSON.stringify(updated));

    // Reset modal
    setUsdaSearchModal(false);
    setUsdaSearchQuery('');
    setUsdaResults([]);
    setSelectedUsdaFood(null);
    setUsdaQuantity('');
    setShowManualEntry(false);
  };

  const handleConfirmManualMeal = () => {
    if (
      !manualMealEntry.name ||
      manualMealEntry.calories === undefined ||
      manualMealEntry.protein === undefined ||
      manualMealEntry.carbs === undefined ||
      manualMealEntry.fat === undefined
    ) {
      return;
    }

    const newEntry: MacroLogEntry = {
      id: `manual-${Date.now()}`,
      name: manualMealEntry.name,
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      calories: manualMealEntry.calories,
      protein: manualMealEntry.protein,
      carbs: manualMealEntry.carbs,
      fat: manualMealEntry.fat,
      source: 'manual',
      confirmed: true,
      purpose: 'Custom meal',
    };

    const updated = [...macroEntries, newEntry];
    setMacroEntries(updated);
    localStorage.setItem(macroKey, JSON.stringify(updated));

    // Reset modal
    setUsdaSearchModal(false);
    setManualMealEntry({});
    setShowManualEntry(false);
  };

  const handleSaveMealPlan = () => {
    saveMealPlanDefaults(mealPlanDefaults);
    setEditMealPlanModal(false);
    setEditingMeal(null);
    setNewMeal({});
  };

  const handleAddMealToPlan = () => {
    if (
      !newMeal.name ||
      !newMeal.time ||
      newMeal.calories === undefined ||
      newMeal.protein === undefined ||
      newMeal.carbs === undefined ||
      newMeal.fat === undefined ||
      !newMeal.purpose
    ) {
      return;
    }

    const meal: MealPlanItem = {
      id: `meal-${Date.now()}`,
      name: newMeal.name,
      time: newMeal.time,
      calories: newMeal.calories,
      protein: newMeal.protein,
      carbs: newMeal.carbs,
      fat: newMeal.fat,
      purpose: newMeal.purpose,
    };

    setMealPlanDefaults([...mealPlanDefaults, meal]);
    setNewMeal({});
  };

  const handleDeleteMealFromPlan = (mealId: string) => {
    setMealPlanDefaults(mealPlanDefaults.filter((m) => m.id !== mealId));
  };

  const handleSaveTargets = () => {
    saveMacroTargets(tempTargets);
    setMacroTargets(tempTargets);
    setEditTargetsMode(false);
  };

  const confirmedMacros = useMemo(() => {
    const confirmed = macroEntries.filter((e) => e.confirmed);
    return confirmed.reduce(
      (acc, e) => ({
        calories: acc.calories + e.calories,
        protein: acc.protein + e.protein,
        carbs: acc.carbs + e.carbs,
        fat: acc.fat + e.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [macroEntries]);

  const getMacroColor = (actual: number, target: number) => {
    const diff = ((actual - target) / target) * 100;
    if (actual === 0) return 'text-text-secondary'; // No data
    if (diff > 0) return 'text-red-500'; // Over target
    if (diff < -20) return 'text-red-500'; // More than 20% under
    if (diff < -10) return 'text-amber-500'; // 10-20% under
    return 'text-primary'; // Within 10%
  };

  const handleDeleteItem = (sectionId: string, itemId: string) => {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? { ...s, items: s.items.filter((i) => i.id !== itemId) }
          : s
      )
    );
    setCompletedIds((prev) => prev.filter((id) => id !== itemId));
    setDeleteConfirm(null);
  };

  const handleAddItem = (sectionId: string) => {
    const isWeeklySection = sectionId === 'weekly-environment';
    
    // Weekly items don't require time field
    if (isWeeklySection) {
      if (!newItem.name || !newItem.purpose || !newItem.consequence) {
        setShowValidation(true);
        return;
      }
    } else {
      if (!newItem.name || !newItem.time || !newItem.purpose || !newItem.consequence) {
        setShowValidation(true);
        return;
      }
    }

    const item: ChecklistItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: newItem.name,
      time: newItem.time,
      layer: newItem.layer,
      purpose: newItem.purpose,
      consequence: newItem.consequence,
      type: isWeeklySection ? 'weekly' : undefined,
    };

    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId ? { ...s, items: [...s.items, item] } : s
      )
    );

    setNewItem({ name: '', time: '', layer: 'Foundation', purpose: '', consequence: '' });
    setShowValidation(false);
    setAddItemSection(null);
  };

  const canSaveNewItem = addItemSection === 'weekly-environment' 
    ? newItem.name && newItem.purpose && newItem.consequence
    : newItem.name && newItem.time && newItem.purpose && newItem.consequence;

  return (
    <div className="flex flex-1 flex-col gap-4 pb-20">
      <div className="flex items-center justify-between">
        <div className="text-lg font-bold tracking-wide text-primary">GRND</div>
        <div className="rounded-brand border border-primary px-3 py-1 text-[11px] font-semibold text-primary">STAGE 1</div>
        <div className="text-[12px] text-text-secondary">{formatHeaderDate()}</div>
      </div>

      <Card accentLeft>
        <div className="text-[11px] font-semibold tracking-widest text-primary">TODAY'S FOCUS</div>
        <div className="mt-3 space-y-4">
          <div>
            <div className="text-text-primary">
              <span className="mr-2 text-text-primary">1.</span>
              Book DEXA scan to establish body composition baseline
            </div>
            <div className="mt-1 text-[10px] font-semibold tracking-widest text-primary">BODY</div>
          </div>
          <div>
            <div className="text-text-primary">
              <span className="mr-2 text-text-primary">2.</span>
              Schedule physio consultation for shoulder and elbow assessment
            </div>
            <div className="mt-1 text-[10px] font-semibold tracking-widest text-primary">FOUNDATION</div>
          </div>
        </div>
      </Card>

      <Card accentLeft>
        <div className="flex items-start justify-between">
          <div className="text-[11px] font-semibold tracking-widest text-primary">YESTERDAY'S PROOF</div>
        </div>
        <div className="mt-3 text-sm text-text-primary">
          {yesterdayProof ? (
            yesterdayProof
          ) : (
            <span className="italic text-text-secondary">Start logging today. Your proof builds from here.</span>
          )}
        </div>
      </Card>

      <Card>
        <div className="flex items-start justify-between">
          <div className="text-base font-bold text-text-primary">Sleep Check-In</div>
          {!sleepEditing && sleepSaved ? (
            <button
              type="button"
              onClick={() => setSleepEditing(true)}
              className="min-h-[44px] px-2 text-sm font-semibold text-primary"
            >
              Edit
            </button>
          ) : null}
        </div>

        {!sleepEditing && sleepSaved ? (
          <div className="mt-3 space-y-3">
            <div className="flex gap-3">
              <div className="flex-1 rounded-brand bg-background p-3">
                <div className="text-[11px] tracking-widest text-text-secondary">BED TIME</div>
                <div className="mt-1 text-sm font-semibold text-text-primary">{sleepSaved.bedTime}</div>
              </div>
              <div className="flex-1 rounded-brand bg-background p-3">
                <div className="text-[11px] tracking-widest text-text-secondary">WAKE TIME</div>
                <div className="mt-1 text-sm font-semibold text-text-primary">{sleepSaved.wakeTime}</div>
              </div>
            </div>

            <div className="rounded-brand bg-background p-3">
              <div className="text-[11px] tracking-widest text-text-secondary">SLEEP DURATION</div>
              <div className="mt-1 text-lg font-bold text-primary">{formatDuration(sleepDurationMinutes)}</div>
            </div>

            <div className="rounded-brand bg-background p-3">
              <div className="text-[11px] tracking-widest text-text-secondary">ENERGY RATING</div>
              <div className="mt-2 text-sm font-semibold text-text-primary">{sleepSaved.energy ?? '—'}</div>
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-4">
            <div className="flex gap-3">
              <label className="flex-1">
                <div className="mb-1 text-[11px] tracking-widest text-text-secondary">BED TIME</div>
                <input
                  type="time"
                  value={sleep.bedTime}
                  onChange={(e) => setSleep((prev) => ({ ...prev, bedTime: e.target.value }))}
                  className="min-h-[44px] w-full rounded-brand bg-background px-3 text-sm text-text-primary outline-none"
                />
              </label>
              <label className="flex-1">
                <div className="mb-1 text-[11px] tracking-widest text-text-secondary">WAKE TIME</div>
                <input
                  type="time"
                  value={sleep.wakeTime}
                  onChange={(e) => setSleep((prev) => ({ ...prev, wakeTime: e.target.value }))}
                  className="min-h-[44px] w-full rounded-brand bg-background px-3 text-sm text-text-primary outline-none"
                />
              </label>
            </div>

            <div className="rounded-brand bg-background p-3">
              <div className="text-[11px] tracking-widest text-text-secondary">SLEEP DURATION</div>
              <div className="mt-1 text-lg font-bold text-primary">{formatDuration(sleepDurationMinutes)}</div>
            </div>

            <div>
              <div className="text-[11px] font-semibold tracking-widest text-text-secondary">ENERGY RATING</div>
              <div className="mt-2 flex gap-1">
                {Array.from({ length: 10 }).map((_, i) => {
                  const n = i + 1;
                  const active = sleep.energy === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => toggleEnergy(n)}
                      className="min-h-[44px] flex-1"
                    >
                      <div
                        className={
                          active
                            ? 'mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-primary text-background font-semibold'
                            : 'mx-auto flex h-9 w-9 items-center justify-center rounded-full border border-text-secondary text-text-secondary'
                        }
                      >
                        {n}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveSleep}
              className="min-h-[44px] w-full rounded-brand bg-primary text-background font-bold"
            >
              Save
            </button>
          </div>
        )}
      </Card>

      {/* Macro Summary Card */}
      <Card>
        <div className="text-base font-bold text-text-primary">Macros</div>
        
        {/* Summary Row */}
        <div className="mt-3 grid grid-cols-4 gap-2">
          <div className="rounded-brand bg-background p-2">
            <div className="text-[10px] tracking-widest text-text-secondary">CALORIES</div>
            <div className={`mt-1 text-sm font-semibold ${getMacroColor(confirmedMacros.calories, macroTargets.calories)}`}>
              {confirmedMacros.calories} / {macroTargets.calories}
            </div>
          </div>
          <div className="rounded-brand bg-background p-2">
            <div className="text-[10px] tracking-widest text-text-secondary">PROTEIN</div>
            <div className={`mt-1 text-sm font-semibold ${getMacroColor(confirmedMacros.protein, macroTargets.protein)}`}>
              {confirmedMacros.protein}g / {macroTargets.protein}g
            </div>
          </div>
          <div className="rounded-brand bg-background p-2">
            <div className="text-[10px] tracking-widest text-text-secondary">CARBS</div>
            <div className={`mt-1 text-sm font-semibold ${getMacroColor(confirmedMacros.carbs, macroTargets.carbs)}`}>
              {confirmedMacros.carbs}g / {macroTargets.carbs}g
            </div>
          </div>
          <div className="rounded-brand bg-background p-2">
            <div className="text-[10px] tracking-widest text-text-secondary">FAT</div>
            <div className={`mt-1 text-sm font-semibold ${getMacroColor(confirmedMacros.fat, macroTargets.fat)}`}>
              {confirmedMacros.fat}g / {macroTargets.fat}g
            </div>
          </div>
        </div>

        {/* Empty State */}
        {macroEntries.filter((e) => e.confirmed).length === 0 && (
          <div className="mt-3 text-center text-sm italic text-text-secondary">
            Tap meals to confirm
          </div>
        )}

        {/* Meal List */}
        <div className="mt-3 max-h-[300px] space-y-2 overflow-y-auto">
          {mealPlanDefaults.map((meal) => {
            const entry = macroEntries.find((e) => e.id === meal.id);
            const isConfirmed = entry?.confirmed || false;

            return (
              <button
                key={meal.id}
                type="button"
                onClick={() => handleToggleMealConfirm(meal.id)}
                className={
                  isConfirmed
                    ? 'w-full rounded-brand bg-primary/10 border-2 border-primary p-2 text-left'
                    : 'w-full rounded-brand bg-card border border-text-secondary p-2 text-left'
                }
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className={isConfirmed ? 'text-sm font-semibold text-primary' : 'text-sm text-text-secondary'}>
                      {meal.name}
                    </div>
                    <div className="mt-1 text-[10px] text-text-secondary">
                      {meal.time} • {meal.calories}cal • P:{meal.protein}g C:{meal.carbs}g F:{meal.fat}g
                    </div>
                  </div>
                  <div className={isConfirmed ? 'text-primary text-lg' : 'text-text-secondary text-lg'}>
                    {isConfirmed ? '✓' : '○'}
                  </div>
                </div>
              </button>
            );
          })}

          {/* Custom meals from USDA/manual */}
          {macroEntries
            .filter((e) => e.source !== 'default')
            .map((meal) => (
              <button
                key={meal.id}
                type="button"
                onClick={() => handleToggleMealConfirm(meal.id)}
                className={
                  meal.confirmed
                    ? 'w-full rounded-brand bg-primary/10 border-2 border-primary p-2 text-left'
                    : 'w-full rounded-brand bg-card border border-text-secondary p-2 text-left'
                }
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className={meal.confirmed ? 'text-sm font-semibold text-primary' : 'text-sm text-text-secondary'}>
                      {meal.name}
                    </div>
                    <div className="mt-1 text-[10px] text-text-secondary">
                      {meal.time} • {meal.calories}cal • P:{meal.protein}g C:{meal.carbs}g F:{meal.fat}g • {meal.source}
                    </div>
                  </div>
                  <div className={meal.confirmed ? 'text-primary text-lg' : 'text-text-secondary text-lg'}>
                    {meal.confirmed ? '✓' : '○'}
                  </div>
                </div>
              </button>
            ))}
        </div>

        {/* Action Buttons */}
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setEditMealPlanModal(true)}
            className="flex-1 text-xs text-primary"
          >
            Edit meal plan
          </button>
          <button
            type="button"
            onClick={() => setUsdaSearchModal(true)}
            className="flex-1 rounded-brand border border-primary px-3 py-2 text-xs font-semibold text-primary"
          >
            Log Custom Meal
          </button>
        </div>
      </Card>

      <div className="-mx-5 overflow-x-auto px-5">
        <div className="flex w-max gap-3 pr-10">
          <div className="w-[160px] shrink-0 rounded-brand bg-card p-3">
            <div className="text-[11px] tracking-widest text-text-secondary">WEIGHT</div>
            <div className="mt-1 text-lg font-bold text-text-primary">80.8kg</div>
            <div className="mt-1 flex items-center gap-1 text-xs">
              <Arrow direction="down" color="gold" />
              <span className="text-primary">-1.3kg</span>
            </div>
          </div>

          <div className="w-[160px] shrink-0 rounded-brand bg-card p-3">
            <div className="text-[11px] tracking-widest text-text-secondary">BODY FAT</div>
            <div className="mt-1 text-lg font-bold text-text-primary">29.4%</div>
            <div className="mt-1 flex items-center gap-1 text-xs">
              <Arrow direction="down" color="gold" />
              <span className="text-primary">improving</span>
            </div>
          </div>

          <div className="w-[160px] shrink-0 rounded-brand bg-card p-3">
            <div className="text-[11px] tracking-widest text-text-secondary">GYM</div>
            <div className="mt-1 text-lg font-bold text-text-primary">3 sessions</div>
            <div className="mt-1 flex items-center gap-1 text-xs">
              <Arrow direction="up" color="gold" />
              <span className="text-primary">this week</span>
            </div>
          </div>

          <div className="w-[160px] shrink-0 rounded-brand bg-card p-3">
            <div className="text-[11px] tracking-widest text-text-secondary">SLEEP</div>
            <div className="mt-1 text-lg font-bold text-text-primary">8/10</div>
            <div className="mt-1 flex items-center gap-1 text-xs">
              <Arrow direction="up" color="gold" />
              <span className="text-primary">energy</span>
            </div>
          </div>

          <div className="w-[160px] shrink-0 rounded-brand bg-card p-3">
            <div className="text-[11px] tracking-widest text-text-secondary">CHECKLIST</div>
            <div className="mt-1 text-lg font-bold text-text-primary">57%</div>
            <div className="mt-1 flex items-center gap-1 text-xs">
              <Arrow direction="right" color="grey" />
              <span className="text-text-secondary">building</span>
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => navigate('/gym')}
        className="min-h-[44px] w-full rounded-brand border border-primary bg-card px-4"
      >
        <div className="flex items-center gap-3">
          <div className="text-primary">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 7v10" />
              <path d="M18 7v10" />
              <path d="M4 10v4" />
              <path d="M20 10v4" />
              <path d="M6 12h12" />
            </svg>
          </div>
          <div className="flex-1 text-left">
            <div className="font-bold text-text-primary">Push Day</div>
            <div className="text-sm text-text-secondary">Tap to log session</div>
          </div>
          <div className="text-primary">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </div>
        </div>
      </button>

      <Card>
        <div className="flex items-center justify-between">
          <div className="text-base font-bold text-text-primary">Today's Score</div>
          <div className="text-base font-bold text-primary">
            {checkedCount}/{totalCount}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {dailySections.map((section) => {
            const sectionChecked = section.items.filter((it) => completedIds.includes(it.id)).length;
            const isOpen = expanded[section.id] !== false;
            const isEditing = editingSection === section.id;

            return (
              <div key={section.id} className="rounded-brand bg-background">
                <div className="flex items-center justify-between px-3 py-3">
                  <button
                    type="button"
                    onClick={() => setExpanded((p) => ({ ...p, [section.id]: !isOpen }))}
                    className="min-h-[44px] flex-1 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">{section.emoji}</span>
                      <span className="font-semibold text-text-primary">{section.name}</span>
                    </div>
                  </button>
                  <div className="flex items-center gap-2">
                    <div className="text-sm text-text-secondary">
                      {sectionChecked}/{section.items.length}
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingSection(isEditing ? null : section.id)}
                      className="min-h-[44px] px-2"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4 text-text-secondary" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                  </div>
                </div>

                {isOpen ? (
                  <div className="px-3 pb-3">
                    <div className="space-y-2">
                      {section.items.map((item) => {
                        const checked = completedIds.includes(item.id);
                        return (
                          <div key={item.id} className="flex items-center gap-2">
                            {isEditing ? (
                              <>
                                <div className="text-text-secondary">☰</div>
                                <button
                                  type="button"
                                  onClick={() => setDetailItem(item)}
                                  className="flex-1 rounded-brand bg-card px-3 py-3 text-left"
                                >
                                  <div className="text-sm text-text-primary">{item.name}</div>
                                  <div className="mt-1 text-xs text-text-secondary">{item.time}</div>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirm({ sectionId: section.id, itemId: item.id })}
                                  className="min-h-[44px] px-2 text-red-500"
                                >
                                  ✕
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleToggleItem(item.id)}
                                className={
                                  checked
                                    ? 'w-full rounded-brand bg-card/60 px-3 py-3'
                                    : 'w-full rounded-brand bg-card px-3 py-3'
                                }
                              >
                                <div className="flex items-start gap-3">
                                  <div className="mt-1 shrink-0">
                                    <Checkbox checked={checked} />
                                  </div>
                                  <div className="flex-1 text-left">
                                    <span
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDetailItem(item);
                                      }}
                                      className={
                                        checked
                                          ? 'text-sm text-text-secondary line-through text-left cursor-pointer'
                                          : 'text-sm text-text-primary text-left cursor-pointer'
                                      }
                                    >
                                      {item.name}
                                    </span>
                                  </div>
                                  <div className="shrink-0 text-right text-xs text-text-secondary">
                                    {item.time}
                                  </div>
                                </div>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Per-section mood/energy stamp */}
                    {(() => {
                      const savedEntry = getSectionMoodEntry(section.id);
                      const currentState = getSectionMoodState(section.id);
                      const isEditingMood = editingMoodSection === section.id;
                      const canSave = currentState.energy && currentState.mood && currentState.cause;

                      if (savedEntry && !isEditingMood) {
                        return (
                          <div className="mt-3 rounded-brand bg-card/40 p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4 text-xs">
                                <div>
                                  <span className="text-text-secondary">Energy:</span>{' '}
                                  <span className="font-semibold text-text-primary">{savedEntry.energy}</span>
                                </div>
                                <div>
                                  <span className="text-text-secondary">Mood:</span>{' '}
                                  <span className="font-semibold text-text-primary">{savedEntry.mood}</span>
                                </div>
                                <div>
                                  <span className="text-text-secondary">Cause:</span>{' '}
                                  <span className="text-text-primary">{savedEntry.cause}</span>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingMoodSection(section.id);
                                  setSectionMoodStates((prev) => ({
                                    ...prev,
                                    [section.id]: {
                                      energy: savedEntry.energy,
                                      mood: savedEntry.mood,
                                      cause: savedEntry.cause,
                                    },
                                  }));
                                }}
                                className="text-xs text-primary"
                              >
                                Edit
                              </button>
                            </div>
                          </div>
                        );
                      }

                      if (isEditingMood || !savedEntry) {
                        return (
                          <div className="mt-3 space-y-3 rounded-brand bg-card/40 p-3">
                            <div className="flex items-center gap-2">
                              <div className="text-[10px] font-semibold tracking-widest text-text-secondary">ENERGY</div>
                              <div className="flex gap-1">
                                {Array.from({ length: 10 }).map((_, i) => {
                                  const n = i + 1;
                                  const active = currentState.energy === n;
                                  return (
                                    <button
                                      key={n}
                                      type="button"
                                      onClick={() => toggleSectionMoodEnergy(section.id, n)}
                                      className="min-h-[32px] w-7"
                                    >
                                      <div
                                        className={
                                          active
                                            ? 'mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-background'
                                            : 'mx-auto flex h-6 w-6 items-center justify-center rounded-full border border-text-secondary text-[10px] text-text-secondary'
                                        }
                                      >
                                        {n}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <div className="text-[10px] font-semibold tracking-widest text-text-secondary">MOOD</div>
                              <div className="flex gap-1">
                                {Array.from({ length: 10 }).map((_, i) => {
                                  const n = i + 1;
                                  const active = currentState.mood === n;
                                  return (
                                    <button
                                      key={n}
                                      type="button"
                                      onClick={() => toggleSectionMoodRating(section.id, n)}
                                      className="min-h-[32px] w-7"
                                    >
                                      <div
                                        className={
                                          active
                                            ? 'mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-background'
                                            : 'mx-auto flex h-6 w-6 items-center justify-center rounded-full border border-text-secondary text-[10px] text-text-secondary'
                                        }
                                      >
                                        {n}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <div>
                              <div className="text-[10px] font-semibold tracking-widest text-text-secondary">CAUSE</div>
                              <div className="mt-2 flex flex-wrap gap-1">
                                {causes.map((cause) => {
                                  const selected = currentState.cause === cause;
                                  return (
                                    <button
                                      key={cause}
                                      type="button"
                                      onClick={() => handleSelectSectionCause(section.id, cause)}
                                      className={
                                        selected
                                          ? 'rounded-full border-2 border-primary bg-primary/10 px-3 py-1 text-[10px] font-semibold text-primary'
                                          : 'rounded-full border border-text-secondary px-3 py-1 text-[10px] text-text-secondary'
                                      }
                                    >
                                      {cause}
                                    </button>
                                  );
                                })}
                                {showAddCause[section.id] ? (
                                  <div className="flex gap-1">
                                    <input
                                      type="text"
                                      value={newCause}
                                      onChange={(e) => setNewCause(e.target.value)}
                                      placeholder="New cause"
                                      className="min-h-[28px] rounded-full border border-text-secondary bg-background px-3 text-[10px] text-text-primary outline-none"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleAddCauseForSection(section.id)}
                                      className="rounded-full border border-primary px-3 py-1 text-[10px] font-semibold text-primary"
                                    >
                                      Add
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setShowAddCause((prev) => ({ ...prev, [section.id]: true }))}
                                    className="rounded-full border border-text-secondary px-3 py-1 text-[10px] text-text-secondary"
                                  >
                                    + Add cause
                                  </button>
                                )}
                              </div>
                            </div>

                            {canSave ? (
                              <button
                                type="button"
                                onClick={() => handleSaveSectionMood(section.id, section.name)}
                                className="min-h-[32px] w-full rounded-brand bg-primary text-xs font-bold text-background"
                              >
                                Save
                              </button>
                            ) : null}
                          </div>
                        );
                      }

                      return null;
                    })()}

                    {isEditing ? (
                      <button
                        type="button"
                        onClick={() => setAddItemSection(section.id)}
                        className="mt-3 min-h-[44px] w-full rounded-brand border border-primary text-primary"
                      >
                        + Add item
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Weekly Environment Checklist */}
      {weeklySection && (
        <Card>
          <button
            type="button"
            onClick={() => setWeeklyExpanded(!weeklyExpanded)}
            className="flex w-full items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <span className="text-base">{weeklySection.emoji}</span>
              <span className="text-xs font-semibold tracking-widest text-text-secondary">WEEKLY ENVIRONMENT</span>
              {weeklyCheckedCount === weeklyItems.length && weeklyItems.length > 0 && (
                <div className="h-2 w-2 rounded-full bg-green-500" />
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="text-sm text-text-secondary">
                {weeklyCheckedCount}/{weeklyItems.length}
              </div>
              <svg
                viewBox="0 0 24 24"
                className={`h-4 w-4 text-text-secondary transition-transform ${weeklyExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </div>
          </button>

          {weeklyExpanded && (
            <div className="mt-3 space-y-2">
              {weeklyItems.map((item) => {
                const checked = completedIds.includes(item.id);
                const isEditing = editingSection === weeklySection.id;

                return (
                  <div key={item.id} className="flex items-center gap-2">
                    {isEditing ? (
                      <>
                        <div className="text-text-secondary">☰</div>
                        <button
                          type="button"
                          onClick={() => setDetailItem(item)}
                          className="flex-1 rounded-brand bg-card px-3 py-3 text-left"
                        >
                          <div className="text-sm text-text-primary">{item.name}</div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm({ sectionId: weeklySection.id, itemId: item.id })}
                          className="min-h-[44px] px-2 text-red-500"
                        >
                          ✕
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleToggleItem(item.id)}
                        className={
                          checked
                            ? 'w-full rounded-brand bg-card/60 px-3 py-3'
                            : 'w-full rounded-brand bg-card px-3 py-3'
                        }
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-1 shrink-0">
                            <Checkbox checked={checked} />
                          </div>
                          <div className="flex-1 text-left">
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                setDetailItem(item);
                              }}
                              className={
                                checked
                                  ? 'text-sm text-text-secondary line-through cursor-pointer'
                                  : 'text-sm text-text-primary cursor-pointer'
                              }
                            >
                              {item.name}
                            </span>
                          </div>
                        </div>
                      </button>
                    )}
                  </div>
                );
              })}

              {editingSection === weeklySection.id && (
                <button
                  type="button"
                  onClick={() => setAddItemSection(weeklySection.id)}
                  className="mt-3 min-h-[44px] w-full rounded-brand border border-primary text-primary"
                >
                  + Add item
                </button>
              )}

              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => setEditingSection(editingSection === weeklySection.id ? null : weeklySection.id)}
                  className="min-h-[44px] px-2"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 text-text-secondary" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Item Detail Modal */}
      {detailItem ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setDetailItem(null)}>
          <div className="w-full max-w-md rounded-t-brand bg-card p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 text-lg font-bold text-text-primary">{detailItem.name}</div>
            <div className="mb-4 inline-block rounded-brand bg-primary px-3 py-1 text-xs font-semibold text-background">
              {detailItem.layer}
            </div>
            <div className="mb-4">
              <div className="text-xs text-text-secondary">Why it's here:</div>
              <div className="mt-1 text-sm text-text-primary">{detailItem.purpose}</div>
            </div>
            <div className="mb-6">
              <div className="text-xs text-text-secondary">If missed:</div>
              <div className="mt-1 text-sm text-text-primary">{detailItem.consequence}</div>
            </div>
            <button
              type="button"
              onClick={() => setDetailItem(null)}
              className="min-h-[44px] w-full rounded-brand bg-background text-text-primary"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}

      {/* Add Item Modal */}
      {addItemSection ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => { setAddItemSection(null); setShowValidation(false); }}>
          <div className="w-full max-w-md rounded-t-brand bg-card max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 pb-4">
              <div className="mb-4 text-lg font-bold text-text-primary">Add Item</div>
            </div>
            <div className="overflow-y-auto flex-1 px-6">
              <div className="space-y-4 pb-4">
                <input
                  type="text"
                  placeholder="Item name"
                  value={newItem.name}
                  onChange={(e) => setNewItem((p) => ({ ...p, name: e.target.value }))}
                  className={`min-h-[44px] w-full rounded-brand bg-background px-3 text-sm text-text-primary outline-none ${
                    showValidation && !newItem.name ? 'border-2 border-red-500' : ''
                  }`}
                />
                <input
                  type="time"
                  value={newItem.time}
                  onChange={(e) => setNewItem((p) => ({ ...p, time: e.target.value }))}
                  className={`min-h-[44px] w-full rounded-brand bg-background px-3 text-sm text-text-primary outline-none ${
                    showValidation && !newItem.time ? 'border-2 border-red-500' : ''
                  }`}
                />
                <select
                  value={newItem.layer}
                  onChange={(e) => setNewItem((p) => ({ ...p, layer: e.target.value }))}
                  className="min-h-[44px] w-full rounded-brand bg-background px-3 text-sm text-text-primary outline-none"
                >
                  <option value="Foundation">Foundation</option>
                  <option value="Sleep">Sleep</option>
                  <option value="Medical">Medical</option>
                  <option value="Physical Product">Physical Product</option>
                  <option value="Presence">Presence</option>
                  <option value="Inner Game">Inner Game</option>
                  <option value="Income">Income</option>
                  <option value="Reputation">Reputation</option>
                </select>
                <input
                  type="text"
                  placeholder="Why does this item exist?"
                  value={newItem.purpose}
                  onChange={(e) => setNewItem((p) => ({ ...p, purpose: e.target.value }))}
                  className={`min-h-[44px] w-full rounded-brand bg-background px-3 text-sm text-text-primary outline-none ${
                    showValidation && !newItem.purpose ? 'border-2 border-red-500' : ''
                  }`}
                />
                <input
                  type="text"
                  placeholder="What breaks if this is skipped?"
                  value={newItem.consequence}
                  onChange={(e) => setNewItem((p) => ({ ...p, consequence: e.target.value }))}
                  className={`min-h-[44px] w-full rounded-brand bg-background px-3 text-sm text-text-primary outline-none ${
                    showValidation && !newItem.consequence ? 'border-2 border-red-500' : ''
                  }`}
                />
              </div>
            </div>
            <div className="p-6 pt-4 space-y-3">
              <button
                type="button"
                onClick={() => { setAddItemSection(null); setShowValidation(false); }}
                className="w-full text-center text-sm text-text-secondary min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleAddItem(addItemSection)}
                className={
                  canSaveNewItem
                    ? 'min-h-[44px] w-full rounded-brand bg-primary text-background font-bold cursor-pointer'
                    : 'min-h-[44px] w-full rounded-brand bg-gray-700 text-gray-500 font-bold cursor-not-allowed opacity-50'
                }
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Delete Confirmation Modal */}
      {deleteConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDeleteConfirm(null)}>
          <div className="w-full max-w-sm rounded-brand bg-card p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 text-lg font-bold text-text-primary">
              Remove {sections.find((s) => s.id === deleteConfirm.sectionId)?.items.find((i) => i.id === deleteConfirm.itemId)?.name}?
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="min-h-[44px] flex-1 rounded-brand bg-background text-text-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteItem(deleteConfirm.sectionId, deleteConfirm.itemId)}
                className="min-h-[44px] flex-1 rounded-brand bg-red-500 text-white font-bold"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Edit Meal Plan Modal */}
      {editMealPlanModal ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setEditMealPlanModal(false)}>
          <div className="w-full max-w-md rounded-t-brand bg-card max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 pb-4">
              <div className="mb-4 text-lg font-bold text-text-primary">Edit Meal Plan</div>
              
              {/* Edit Targets Section */}
              {editTargetsMode ? (
                <div className="mb-4 space-y-3 rounded-brand bg-background p-3">
                  <div className="text-sm font-semibold text-text-primary">Daily Targets</div>
                  <input
                    type="number"
                    value={tempTargets.calories}
                    onChange={(e) => setTempTargets({ ...tempTargets, calories: parseFloat(e.target.value) || 0 })}
                    placeholder="Calories"
                    className="w-full rounded-brand bg-card px-3 py-2 text-sm text-text-primary outline-none"
                  />
                  <input
                    type="number"
                    value={tempTargets.protein}
                    onChange={(e) => setTempTargets({ ...tempTargets, protein: parseFloat(e.target.value) || 0 })}
                    placeholder="Protein (g)"
                    className="w-full rounded-brand bg-card px-3 py-2 text-sm text-text-primary outline-none"
                  />
                  <input
                    type="number"
                    value={tempTargets.carbs}
                    onChange={(e) => setTempTargets({ ...tempTargets, carbs: parseFloat(e.target.value) || 0 })}
                    placeholder="Carbs (g)"
                    className="w-full rounded-brand bg-card px-3 py-2 text-sm text-text-primary outline-none"
                  />
                  <input
                    type="number"
                    value={tempTargets.fat}
                    onChange={(e) => setTempTargets({ ...tempTargets, fat: parseFloat(e.target.value) || 0 })}
                    placeholder="Fat (g)"
                    className="w-full rounded-brand bg-card px-3 py-2 text-sm text-text-primary outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleSaveTargets}
                    className="w-full rounded-brand bg-primary px-3 py-2 text-sm font-semibold text-background"
                  >
                    Save Targets
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditTargetsMode(false)}
                    className="w-full text-sm text-text-secondary"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditTargetsMode(true)}
                  className="mb-4 w-full text-left text-xs text-primary"
                >
                  Edit daily targets
                </button>
              )}
            </div>

            {/* Scrollable meal list */}
            <div className="flex-1 overflow-y-auto px-6">
              <div className="space-y-2">
                {mealPlanDefaults.map((meal) => (
                  <div key={meal.id} className="rounded-brand bg-background p-3">
                    {editingMeal?.id === meal.id ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editingMeal.name}
                          onChange={(e) => setEditingMeal({ ...editingMeal, name: e.target.value })}
                          className="w-full rounded-brand bg-card px-3 py-2 text-sm text-text-primary outline-none"
                        />
                        <input
                          type="time"
                          value={editingMeal.time}
                          onChange={(e) => setEditingMeal({ ...editingMeal, time: e.target.value })}
                          className="w-full rounded-brand bg-card px-3 py-2 text-sm text-text-primary outline-none"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="number"
                            value={editingMeal.calories}
                            onChange={(e) => setEditingMeal({ ...editingMeal, calories: parseFloat(e.target.value) || 0 })}
                            placeholder="Cal"
                            className="rounded-brand bg-card px-3 py-2 text-sm text-text-primary outline-none"
                          />
                          <input
                            type="number"
                            value={editingMeal.protein}
                            onChange={(e) => setEditingMeal({ ...editingMeal, protein: parseFloat(e.target.value) || 0 })}
                            placeholder="Protein"
                            className="rounded-brand bg-card px-3 py-2 text-sm text-text-primary outline-none"
                          />
                          <input
                            type="number"
                            value={editingMeal.carbs}
                            onChange={(e) => setEditingMeal({ ...editingMeal, carbs: parseFloat(e.target.value) || 0 })}
                            placeholder="Carbs"
                            className="rounded-brand bg-card px-3 py-2 text-sm text-text-primary outline-none"
                          />
                          <input
                            type="number"
                            value={editingMeal.fat}
                            onChange={(e) => setEditingMeal({ ...editingMeal, fat: parseFloat(e.target.value) || 0 })}
                            placeholder="Fat"
                            className="rounded-brand bg-card px-3 py-2 text-sm text-text-primary outline-none"
                          />
                        </div>
                        <input
                          type="text"
                          value={editingMeal.purpose}
                          onChange={(e) => setEditingMeal({ ...editingMeal, purpose: e.target.value })}
                          placeholder="Purpose"
                          className="w-full rounded-brand bg-card px-3 py-2 text-sm text-text-primary outline-none"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setMealPlanDefaults(mealPlanDefaults.map((m) => (m.id === editingMeal.id ? editingMeal : m)));
                              setEditingMeal(null);
                            }}
                            className="flex-1 rounded-brand bg-primary px-3 py-2 text-xs font-semibold text-background"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingMeal(null)}
                            className="flex-1 text-xs text-text-secondary"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-text-primary">{meal.name}</div>
                            <div className="mt-1 text-[10px] text-text-secondary">
                              {meal.time} • {meal.calories}cal • P:{meal.protein}g C:{meal.carbs}g F:{meal.fat}g
                            </div>
                            <div className="mt-1 text-[10px] italic text-text-secondary">{meal.purpose}</div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingMeal(meal)}
                              className="text-xs text-primary"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteMealFromPlan(meal.id)}
                              className="text-xs text-red-500"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Add New Meal */}
                <div className="rounded-brand bg-background p-3">
                  <div className="mb-2 text-sm font-semibold text-text-primary">Add New Meal</div>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={newMeal.name || ''}
                      onChange={(e) => setNewMeal({ ...newMeal, name: e.target.value })}
                      placeholder="Meal name"
                      className="w-full rounded-brand bg-card px-3 py-2 text-sm text-text-primary outline-none"
                    />
                    <input
                      type="time"
                      value={newMeal.time || ''}
                      onChange={(e) => setNewMeal({ ...newMeal, time: e.target.value })}
                      className="w-full rounded-brand bg-card px-3 py-2 text-sm text-text-primary outline-none"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        value={newMeal.calories || ''}
                        onChange={(e) => setNewMeal({ ...newMeal, calories: parseFloat(e.target.value) || 0 })}
                        placeholder="Calories"
                        className="rounded-brand bg-card px-3 py-2 text-sm text-text-primary outline-none"
                      />
                      <input
                        type="number"
                        value={newMeal.protein || ''}
                        onChange={(e) => setNewMeal({ ...newMeal, protein: parseFloat(e.target.value) || 0 })}
                        placeholder="Protein (g)"
                        className="rounded-brand bg-card px-3 py-2 text-sm text-text-primary outline-none"
                      />
                      <input
                        type="number"
                        value={newMeal.carbs || ''}
                        onChange={(e) => setNewMeal({ ...newMeal, carbs: parseFloat(e.target.value) || 0 })}
                        placeholder="Carbs (g)"
                        className="rounded-brand bg-card px-3 py-2 text-sm text-text-primary outline-none"
                      />
                      <input
                        type="number"
                        value={newMeal.fat || ''}
                        onChange={(e) => setNewMeal({ ...newMeal, fat: parseFloat(e.target.value) || 0 })}
                        placeholder="Fat (g)"
                        className="rounded-brand bg-card px-3 py-2 text-sm text-text-primary outline-none"
                      />
                    </div>
                    <input
                      type="text"
                      value={newMeal.purpose || ''}
                      onChange={(e) => setNewMeal({ ...newMeal, purpose: e.target.value })}
                      placeholder="Purpose"
                      className="w-full rounded-brand bg-card px-3 py-2 text-sm text-text-primary outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddMealToPlan}
                      disabled={!newMeal.name || !newMeal.time || newMeal.calories === undefined || newMeal.protein === undefined || newMeal.carbs === undefined || newMeal.fat === undefined || !newMeal.purpose}
                      className={
                        newMeal.name && newMeal.time && newMeal.calories !== undefined && newMeal.protein !== undefined && newMeal.carbs !== undefined && newMeal.fat !== undefined && newMeal.purpose
                          ? 'w-full rounded-brand bg-primary px-3 py-2 text-sm font-semibold text-background'
                          : 'w-full rounded-brand bg-gray-700 px-3 py-2 text-sm font-semibold text-gray-500 opacity-50'
                      }
                    >
                      Add Meal
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Fixed bottom buttons */}
            <div className="border-t border-text-secondary/20 p-6 pt-4">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditMealPlanModal(false)}
                  className="min-h-[44px] flex-1 rounded-brand bg-background text-text-primary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveMealPlan}
                  className="min-h-[44px] flex-1 rounded-brand bg-primary text-background font-bold"
                >
                  Save Plan
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* USDA Search Modal */}
      {usdaSearchModal ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => { setUsdaSearchModal(false); setShowManualEntry(false); }}>
          <div className="w-full max-w-md rounded-t-brand bg-card max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 pb-4">
              <div className="mb-4 text-lg font-bold text-text-primary">Log Custom Meal</div>
              
              {!showManualEntry ? (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={usdaSearchQuery}
                      onChange={(e) => setUsdaSearchQuery(e.target.value)}
                      placeholder="Search food..."
                      className="flex-1 rounded-brand bg-background px-3 py-2 text-sm text-text-primary outline-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSearchUsda();
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleSearchUsda}
                      disabled={usdaLoading}
                      className="rounded-brand bg-primary px-4 py-2 text-sm font-semibold text-background"
                    >
                      {usdaLoading ? 'Searching...' : 'Search'}
                    </button>
                  </div>

                  {usdaError && (
                    <div className="text-xs text-amber-500">{usdaError}</div>
                  )}
                </div>
              ) : null}
            </div>

            <div className="flex-1 overflow-y-auto px-6">
              {!showManualEntry && usdaResults.length > 0 && !selectedUsdaFood ? (
                <div className="space-y-2">
                  {usdaResults.slice(0, 10).map((food: any, idx: number) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectUsdaFood(food)}
                      className="w-full rounded-brand bg-background p-3 text-left"
                    >
                      <div className="text-sm text-text-primary">{food.description || 'Unknown food'}</div>
                      <div className="mt-1 text-[10px] text-text-secondary">
                        {food.foodNutrients?.find((n: any) => n.nutrientId === 1008)?.value || 0} cal per 100g
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}

              {selectedUsdaFood && !showManualEntry ? (
                <div className="space-y-3">
                  <div className="rounded-brand bg-background p-3">
                    <div className="text-sm font-semibold text-text-primary">{selectedUsdaFood.description}</div>
                    <div className="mt-2 text-[10px] text-text-secondary">
                      Per 100g: {selectedUsdaFood.foodNutrients?.find((n: any) => n.nutrientId === 1008)?.value || 0} cal
                    </div>
                  </div>
                  <input
                    type="number"
                    value={usdaQuantity}
                    onChange={(e) => setUsdaQuantity(e.target.value)}
                    placeholder="Quantity in grams"
                    className="w-full rounded-brand bg-background px-3 py-2 text-sm text-text-primary outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleConfirmUsdaFood}
                    disabled={!usdaQuantity}
                    className={
                      usdaQuantity
                        ? 'w-full rounded-brand bg-primary px-3 py-2 text-sm font-semibold text-background'
                        : 'w-full rounded-brand bg-gray-700 px-3 py-2 text-sm font-semibold text-gray-500 opacity-50'
                    }
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedUsdaFood(null)}
                    className="w-full text-sm text-text-secondary"
                  >
                    Back to results
                  </button>
                </div>
              ) : null}

              {showManualEntry ? (
                <div className="space-y-3">
                  <div className="text-sm text-text-secondary">Enter meal details manually:</div>
                  <input
                    type="text"
                    value={manualMealEntry.name || ''}
                    onChange={(e) => setManualMealEntry({ ...manualMealEntry, name: e.target.value })}
                    placeholder="Meal name"
                    className="w-full rounded-brand bg-background px-3 py-2 text-sm text-text-primary outline-none"
                  />
                  <input
                    type="number"
                    value={manualMealEntry.calories || ''}
                    onChange={(e) => setManualMealEntry({ ...manualMealEntry, calories: parseFloat(e.target.value) || 0 })}
                    placeholder="Calories"
                    className="w-full rounded-brand bg-background px-3 py-2 text-sm text-text-primary outline-none"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="number"
                      value={manualMealEntry.protein || ''}
                      onChange={(e) => setManualMealEntry({ ...manualMealEntry, protein: parseFloat(e.target.value) || 0 })}
                      placeholder="Protein (g)"
                      className="rounded-brand bg-background px-3 py-2 text-sm text-text-primary outline-none"
                    />
                    <input
                      type="number"
                      value={manualMealEntry.carbs || ''}
                      onChange={(e) => setManualMealEntry({ ...manualMealEntry, carbs: parseFloat(e.target.value) || 0 })}
                      placeholder="Carbs (g)"
                      className="rounded-brand bg-background px-3 py-2 text-sm text-text-primary outline-none"
                    />
                    <input
                      type="number"
                      value={manualMealEntry.fat || ''}
                      onChange={(e) => setManualMealEntry({ ...manualMealEntry, fat: parseFloat(e.target.value) || 0 })}
                      placeholder="Fat (g)"
                      className="rounded-brand bg-background px-3 py-2 text-sm text-text-primary outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleConfirmManualMeal}
                    disabled={!manualMealEntry.name || manualMealEntry.calories === undefined || manualMealEntry.protein === undefined || manualMealEntry.carbs === undefined || manualMealEntry.fat === undefined}
                    className={
                      manualMealEntry.name && manualMealEntry.calories !== undefined && manualMealEntry.protein !== undefined && manualMealEntry.carbs !== undefined && manualMealEntry.fat !== undefined
                        ? 'w-full rounded-brand bg-primary px-3 py-2 text-sm font-semibold text-background'
                        : 'w-full rounded-brand bg-gray-700 px-3 py-2 text-sm font-semibold text-gray-500 opacity-50'
                    }
                  >
                    Add Meal
                  </button>
                </div>
              ) : null}
            </div>

            <div className="border-t border-text-secondary/20 p-6 pt-4">
              <button
                type="button"
                onClick={() => { setUsdaSearchModal(false); setShowManualEntry(false); setUsdaSearchQuery(''); setUsdaResults([]); setSelectedUsdaFood(null); }}
                className="min-h-[44px] w-full rounded-brand bg-background text-text-primary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
