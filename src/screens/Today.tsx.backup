import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatHeaderDate, getGrndDayKey, previousDayKey } from '@/utils/dayKey';

type SleepLog = {
  bedTime: string;
  wakeTime: string;
  energy: number | null;
};

type ChecklistItem = {
  id: string;
  text: string;
  time: string;
};

type ChecklistSection = {
  id: string;
  title: string;
  emoji: string;
  items: ChecklistItem[];
};

const sections: ChecklistSection[] = [
  {
    id: 'pre-gym',
    emoji: '🌅',
    title: 'Pre-Gym',
    items: [
      { id: 'wake-0430', text: 'Wake 4:30am', time: '04:30' },
      { id: 'salt-lemon-water', text: 'Salt + lemon water', time: '04:30' },
      { id: 'outdoors-5', text: '5 min outdoors — stretch sunlight', time: '04:35' },
      { id: 'shower-am', text: 'Shower', time: '04:40' },
      { id: 'skincare-am', text: 'AM skincare — Cleanser Vit C Moisturiser SPF50', time: '04:45' },
      { id: 'apple', text: 'Apple', time: '05:45' },
      { id: 'collagen-iron', text: 'Collagen + Vit C + Iron', time: '05:45' },
    ],
  },
  {
    id: 'work-morning',
    emoji: '☀️',
    title: 'Work Morning',
    items: [
      { id: 'wpi-creatine-0730', text: 'WPI shake + creatine', time: '07:30' },
      { id: 'eggs-avocado-0930', text: 'Eggs + avocado', time: '09:30' },
      { id: 'supps-0930', text: 'D3 + K2 + Omega-3 + Curcumin', time: '09:30' },
    ],
  },
  {
    id: 'work-afternoon',
    emoji: '🥗',
    title: 'Work Afternoon',
    items: [
      { id: 'lunch-1230', text: 'Lunch — tofu + potato/veg', time: '12:30' },
      { id: 'electrolytes-walnuts-1400', text: 'Electrolytes + walnuts', time: '14:00' },
      { id: 'wpi-1530', text: 'WPI shake', time: '15:30' },
      { id: 'water-3l-1530', text: 'Water check — 3L target', time: '15:30' },
    ],
  },
  {
    id: 'after-work',
    emoji: '🏠',
    title: 'After Work',
    items: [
      { id: 'arrive-home-1800', text: 'Arrive home — 10 min rest no phone', time: '18:00' },
      { id: 'shower-pm-1810', text: 'Shower', time: '18:10' },
      { id: 'suksham-1820', text: 'Suksham Vyayam', time: '18:20' },
      { id: 'simran-1830', text: 'Waheguru simran', time: '18:30' },
      { id: 'sunlight-1845', text: 'Evening sunlight', time: '18:45' },
      { id: 'egg-whites-1830', text: 'Egg whites', time: '18:30' },
      { id: 'cook-1900', text: 'Cook for tomorrow', time: '19:00' },
      { id: 'kada-1930', text: 'Kada Parshad', time: '19:30' },
      { id: 'read-10-2000', text: 'Read 10 pages', time: '20:00' },
      { id: 'skincare-pm-2000', text: 'PM skincare — Cleanser Retinol Moisturiser', time: '20:00' },
      { id: 'read-aloud-2015', text: 'Read aloud', time: '20:15' },
    ],
  },
  {
    id: 'bedtime',
    emoji: '😴',
    title: 'Bedtime',
    items: [
      { id: 'no-screens-2000', text: 'No screens from 8:00pm', time: '20:00' },
      { id: 'magnesium-2015', text: 'Magnesium glycinate', time: '20:15' },
      { id: 'in-bed-2030', text: 'In bed by 8:30pm', time: '20:30' },
    ],
  },
];

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
  const checklistKey = `grnd_checklist_${dayKey}`;
  const sleepKey = `grnd_sleep_${dayKey}`;

  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(sections.map((s) => [s.id, true]))
  );

  const [ticks, setTicks] = useState<Record<string, boolean>>({});

  const [sleep, setSleep] = useState<SleepLog>({
    bedTime: '20:30',
    wakeTime: '04:30',
    energy: null,
  });
  const [sleepSaved, setSleepSaved] = useState<SleepLog | null>(null);
  const [sleepEditing, setSleepEditing] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem(checklistKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Record<string, boolean>;
        setTicks(parsed ?? {});
      } catch {
        setTicks({});
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
  }, [checklistKey, sleepKey]);

  useEffect(() => {
    localStorage.setItem(checklistKey, JSON.stringify(ticks));
  }, [checklistKey, ticks]);

  const allItems = useMemo(() => sections.flatMap((s) => s.items), []);
  const totalCount = allItems.length;
  const checkedCount = useMemo(
    () => allItems.reduce((acc, item) => (ticks[item.id] ? acc + 1 : acc), 0),
    [allItems, ticks]
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
  }, [allItems, dayKey]);

  const handleToggleItem = (id: string) => {
    setTicks((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSaveSleep = () => {
    localStorage.setItem(sleepKey, JSON.stringify(sleep));
    setSleepSaved(sleep);
    setSleepEditing(false);
  };

  const toggleEnergy = (n: number) => {
    setSleep((prev) => ({ ...prev, energy: prev.energy === n ? null : n }));
  };

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
            const sectionChecked = section.items.reduce((acc, it) => (ticks[it.id] ? acc + 1 : acc), 0);
            const isOpen = expanded[section.id] !== false;

            return (
              <div key={section.id} className="rounded-brand bg-background">
                <button
                  type="button"
                  onClick={() => setExpanded((p) => ({ ...p, [section.id]: !isOpen }))}
                  className="min-h-[44px] w-full px-3 py-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-left">
                      <span className="text-base">{section.emoji}</span>
                      <span className="font-semibold text-text-primary">{section.title}</span>
                    </div>
                    <div className="text-sm text-text-secondary">
                      {sectionChecked}/{section.items.length}
                    </div>
                  </div>
                </button>

                {isOpen ? (
                  <div className="px-3 pb-3">
                    <div className="space-y-2">
                      {section.items.map((item) => {
                        const checked = !!ticks[item.id];
                        return (
                          <button
                            key={item.id}
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
                                <div
                                  className={
                                    checked
                                      ? 'text-sm text-text-secondary line-through'
                                      : 'text-sm text-text-primary'
                                  }
                                >
                                  {item.text}
                                </div>
                              </div>
                              <div className="shrink-0 text-right text-xs text-text-secondary">
                                {item.time}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
