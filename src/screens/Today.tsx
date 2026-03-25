import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatHeaderDate, getGrndDayKey, previousDayKey } from '@/utils/dayKey';
import { ChecklistItem, ChecklistSection, DailyCompletion } from '@/utils/checklistTypes';
import { DEFAULT_CHECKLIST } from '@/utils/defaultChecklist';
import { STORAGE_KEYS, MoodLogEntry } from '@/utils/coachContext';

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
        setCompletedIds(parsed.completedIds ?? []);
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
  }, [completionKey, sleepKey, moodKey]);

  useEffect(() => {
    const completion: DailyCompletion = { completedIds };
    localStorage.setItem(completionKey, JSON.stringify(completion));
  }, [completionKey, completedIds]);

  const allItems = useMemo(() => sections.flatMap((s) => s.items), [sections]);
  const totalCount = allItems.length;
  const checkedCount = completedIds.length;

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

  const handleToggleItem = (id: string) => {
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
    if (!newItem.name || !newItem.time || !newItem.purpose || !newItem.consequence) {
      setShowValidation(true);
      return;
    }

    const item: ChecklistItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: newItem.name,
      time: newItem.time,
      layer: newItem.layer,
      purpose: newItem.purpose,
      consequence: newItem.consequence,
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

  const canSaveNewItem = newItem.name && newItem.time && newItem.purpose && newItem.consequence;

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
          {sections.map((section) => {
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
    </div>
  );
}
