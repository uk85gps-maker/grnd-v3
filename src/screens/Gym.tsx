import { useState, useEffect, useMemo } from 'react';
import {
  DayType,
  Exercise,
  GymProgram,
  GymSession,
  ExerciseLog,
  InjuryFlag,
  InjuryCheckIn,
  getGymProgram,
  saveGymProgram,
  getGymSessions,
  saveGymSession,
  getLastSessionForDayType,
  getInjuryFlagLabel,
} from '../utils/gymStructure';

interface WorkingSet {
  setNumber: number;
  reps: string;
  kg: string;
  completed: boolean;
}

export default function Gym() {
  const [selectedTab, setSelectedTab] = useState<DayType>('push');
  const [program, setProgram] = useState<GymProgram | null>(null);
  const [sessions, setSessions] = useState<GymSession[]>([]);
  const [energyRating, setEnergyRating] = useState(7);
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null);
  const [workingSets, setWorkingSets] = useState<Record<string, WorkingSet[]>>({});
  
  // Exercise management
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [isAddingExercise, setIsAddingExercise] = useState(false);
  const [newExercise, setNewExercise] = useState<Partial<Exercise>>({
    name: '',
    setsTarget: 3,
    injuryFlags: [],
    why: '',
  });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [viewingSession, setViewingSession] = useState<GymSession | null>(null);
  
  // Injury check-in state
  const [injuryCheckIns, setInjuryCheckIns] = useState<Record<string, InjuryCheckIn>>({
    'Right Shoulder': { name: 'Right Shoulder', painLevel: null, affectedBySession: false, exercises: [], notes: '' },
    'Right Elbow': { name: 'Right Elbow', painLevel: null, affectedBySession: false, exercises: [], notes: '' },
    'Knees': { name: 'Knees', painLevel: null, affectedBySession: false, exercises: [], notes: '' },
  });

  useEffect(() => {
    const loadedProgram = getGymProgram();
    setProgram(loadedProgram);
    const loadedSessions = getGymSessions();
    setSessions(loadedSessions);
  }, []);

  useEffect(() => {
    if (!program || selectedTab === 'rest') return;
    
    const exercises = program[selectedTab];
    const initial: Record<string, WorkingSet[]> = {};
    
    exercises.forEach((ex) => {
      initial[ex.id] = Array.from({ length: ex.setsTarget }, (_, i) => ({
        setNumber: i + 1,
        reps: '',
        kg: '',
        completed: false,
      }));
    });
    
    setWorkingSets(initial);
  }, [program, selectedTab]);

  const currentExercises = useMemo(() => {
    if (!program || selectedTab === 'rest') return [];
    return program[selectedTab as keyof GymProgram];
  }, [program, selectedTab]);

  const lastSession = useMemo(() => {
    if (selectedTab === 'rest') return null;
    return getLastSessionForDayType(selectedTab);
  }, [selectedTab, sessions]);

  const recentSessions = useMemo(() => {
    return sessions.slice(-5).reverse();
  }, [sessions]);

  const handleToggleSet = (exerciseId: string, setNumber: number) => {
    setWorkingSets((prev) => {
      const exerciseSets = prev[exerciseId] || [];
      const updated = exerciseSets.map((s) =>
        s.setNumber === setNumber ? { ...s, completed: !s.completed } : s
      );
      return { ...prev, [exerciseId]: updated };
    });
  };

  const handleSetInput = (exerciseId: string, setNumber: number, field: 'reps' | 'kg', value: string) => {
    setWorkingSets((prev) => {
      const exerciseSets = prev[exerciseId] || [];
      const updated = exerciseSets.map((s) =>
        s.setNumber === setNumber ? { ...s, [field]: value } : s
      );
      return { ...prev, [exerciseId]: updated };
    });
  };

  const handleSaveSession = () => {
    if (!program || selectedTab === 'rest') return;

    const exercises = program[selectedTab as keyof GymProgram];
    const exerciseLogs: ExerciseLog[] = exercises.map((ex: Exercise) => {
      const sets = workingSets[ex.id] || [];
      return {
        name: ex.name,
        injuryFlags: ex.injuryFlags,
        sets: sets.map((s) => ({
          setNumber: s.setNumber,
          reps: parseInt(s.reps) || 0,
          kg: parseFloat(s.kg) || 0,
          completed: s.completed,
        })),
      };
    });

    // Collect injury check-in data (only save injuries where user interacted)
    const injuries = Object.values(injuryCheckIns).filter(
      (injury) => injury.painLevel !== null || injury.affectedBySession || injury.notes.trim() !== ''
    );

    const session: GymSession = {
      date: new Date().toISOString(),
      dayType: selectedTab,
      energyRating,
      exercises: exerciseLogs,
      injuries: injuries.length > 0 ? injuries : undefined,
    };

    saveGymSession(session);
    setSessions(getGymSessions());
    
    // Reset working sets
    const initial: Record<string, WorkingSet[]> = {};
    exercises.forEach((ex) => {
      initial[ex.id] = Array.from({ length: ex.setsTarget }, (_, i) => ({
        setNumber: i + 1,
        reps: '',
        kg: '',
        completed: false,
      }));
    });
    setWorkingSets(initial);
    setEnergyRating(7);
    setExpandedExercise(null);
    
    // Reset injury check-ins
    setInjuryCheckIns({
      'Right Shoulder': { name: 'Right Shoulder', painLevel: null, affectedBySession: false, exercises: [], notes: '' },
      'Right Elbow': { name: 'Right Elbow', painLevel: null, affectedBySession: false, exercises: [], notes: '' },
      'Knees': { name: 'Knees', painLevel: null, affectedBySession: false, exercises: [], notes: '' },
    });
  };

  const handleLogRestDay = () => {
    const session: GymSession = {
      date: new Date().toISOString(),
      dayType: 'rest',
      energyRating: 0,
      exercises: [],
    };

    saveGymSession(session);
    setSessions(getGymSessions());
  };

  const handleSaveExercise = () => {
    if (!program || selectedTab === 'rest') return;

    if (isAddingExercise) {
      if (!newExercise.name || !newExercise.why || newExercise.setsTarget === undefined) return;

      const exercise: Exercise = {
        id: `${selectedTab}-${Date.now()}`,
        name: newExercise.name,
        setsTarget: newExercise.setsTarget,
        injuryFlags: newExercise.injuryFlags || [],
        why: newExercise.why,
      };

      const dayType = selectedTab as keyof GymProgram;
      const updated = {
        ...program,
        [dayType]: [...program[dayType], exercise],
      };

      saveGymProgram(updated);
      setProgram(updated);
      setIsAddingExercise(false);
      setNewExercise({ name: '', setsTarget: 3, injuryFlags: [], why: '' });
    } else if (editingExercise) {
      const dayType = selectedTab as keyof GymProgram;
      const updated = {
        ...program,
        [dayType]: program[dayType].map((ex: Exercise) =>
          ex.id === editingExercise.id ? editingExercise : ex
        ),
      };

      saveGymProgram(updated);
      setProgram(updated);
      setEditingExercise(null);
    }
  };

  const handleDeleteExercise = (exerciseId: string) => {
    if (!program || selectedTab === 'rest') return;

    const dayType = selectedTab as keyof GymProgram;
    const updated = {
      ...program,
      [dayType]: program[dayType].filter((ex: Exercise) => ex.id !== exerciseId),
    };

    saveGymProgram(updated);
    setProgram(updated);
    setDeleteConfirm(null);
  };

  const handleToggleInjuryFlag = (flag: InjuryFlag, isEditing: boolean) => {
    if (isEditing && editingExercise) {
      const flags = editingExercise.injuryFlags.includes(flag)
        ? editingExercise.injuryFlags.filter((f) => f !== flag)
        : [...editingExercise.injuryFlags, flag];
      setEditingExercise({ ...editingExercise, injuryFlags: flags });
    } else {
      const flags = (newExercise.injuryFlags || []).includes(flag)
        ? (newExercise.injuryFlags || []).filter((f) => f !== flag)
        : [...(newExercise.injuryFlags || []), flag];
      setNewExercise({ ...newExercise, injuryFlags: flags });
    }
  };

  const getCompletedSetsCount = (exerciseId: string): number => {
    const sets = workingSets[exerciseId] || [];
    return sets.filter((s) => s.completed).length;
  };

  const getTotalSetsForSession = (session: GymSession): number => {
    return session.exercises.reduce((total, ex) => {
      return total + ex.sets.filter((s) => s.completed).length;
    }, 0);
  };

  const getDayTypeLabel = (dayType: DayType): string => {
    switch (dayType) {
      case 'push':
        return '⚡ Push Day';
      case 'pull':
        return '🔗 Pull Day';
      case 'legs':
        return '🦵 Leg Day';
      case 'rest':
        return '💤 Rest Day';
    }
  };

  const getDayTypeColor = (dayType: DayType): string => {
    switch (dayType) {
      case 'push':
        return 'text-primary';
      case 'pull':
        return 'text-white';
      case 'legs':
        return 'text-green-500';
      case 'rest':
        return 'text-text-secondary';
    }
  };

  const getNextDayInfo = (): { type: DayType; date: string } => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const dayOfWeek = tomorrow.getDay();
    let nextType: DayType = 'rest';
    
    if (dayOfWeek === 1 || dayOfWeek === 4) nextType = 'push';
    else if (dayOfWeek === 2 || dayOfWeek === 5) nextType = 'pull';
    else if (dayOfWeek === 3 || dayOfWeek === 6) nextType = 'legs';
    
    return {
      type: nextType,
      date: tomorrow.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    };
  };

  const nextDay = getNextDayInfo();

  if (!program) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-text-secondary">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 pb-20">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <div className={`text-lg font-bold ${selectedTab === 'rest' ? 'text-text-secondary' : 'text-primary'}`}>
            {getDayTypeLabel(selectedTab)}
          </div>
        </div>
        <div className="text-sm text-text-secondary">
          Next: {getDayTypeLabel(nextDay.type)} · {nextDay.date}
        </div>
      </div>

      {/* Tab Pills */}
      <div className="flex gap-2">
        {(['push', 'pull', 'legs', 'rest'] as DayType[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setSelectedTab(tab)}
            className={
              selectedTab === tab
                ? 'flex-1 rounded-full bg-[#d4af37] px-4 py-2 text-sm font-bold text-black'
                : 'flex-1 rounded-full border border-[#2a2a2a] bg-[#1e1e1e] px-4 py-2 text-sm text-zinc-400'
            }
          >
            {tab.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Rest Day Screen */}
      {selectedTab === 'rest' ? (
        <div className="mt-8 space-y-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-text-primary">Rest Day</div>
            <div className="mt-2 text-base text-text-secondary">
              Recovery is where the growth happens. Eat clean, sleep deep.
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogRestDay}
            className="w-full rounded-brand bg-primary py-3 font-bold text-background"
          >
            Log Rest Day
          </button>
        </div>
      ) : (
        <>
          {/* Exercise List */}
          <div className="space-y-3">
            {currentExercises.map((exercise) => {
              const isExpanded = expandedExercise === exercise.id;
              const completedSets = getCompletedSetsCount(exercise.id);
              const sets = workingSets[exercise.id] || [];
              const lastSessionExercise = lastSession?.exercises.find((e) => e.name === exercise.name);

              return (
                <div key={exercise.id} className="rounded-brand bg-card p-4">
                  {/* Exercise Header */}
                  <div
                    className="flex cursor-pointer items-start justify-between"
                    onClick={() => setExpandedExercise(isExpanded ? null : exercise.id)}
                  >
                    <div className="flex-1">
                      <div className="text-base font-semibold text-text-primary">{exercise.name}</div>
                      <div className="mt-1 text-sm text-text-secondary">
                        {completedSets}/{exercise.setsTarget} sets
                      </div>
                    </div>
                    <svg
                      className={`h-5 w-5 text-text-secondary transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>

                  {/* Expanded Set Logging */}
                  {isExpanded && (
                    <div className="mt-4 space-y-3">
                      {sets.map((set) => (
                        <div key={set.setNumber} className="flex items-center gap-2">
                          <div className="w-12 shrink-0 text-sm text-text-secondary">SET {set.setNumber}</div>
                          <input
                            type="number"
                            value={set.reps}
                            onChange={(e) => handleSetInput(exercise.id, set.setNumber, 'reps', e.target.value)}
                            placeholder="Reps"
                            className="w-20 rounded-brand bg-background px-3 py-2 text-base text-text-primary outline-none"
                          />
                          <input
                            type="number"
                            value={set.kg}
                            onChange={(e) => handleSetInput(exercise.id, set.setNumber, 'kg', e.target.value)}
                            placeholder="KG"
                            className="w-20 rounded-brand bg-background px-3 py-2 text-base text-text-primary outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleToggleSet(exercise.id, set.setNumber)}
                            className="shrink-0"
                          >
                            <div
                              className={
                                set.completed
                                  ? 'flex h-6 w-6 items-center justify-center rounded-full bg-primary text-background'
                                  : 'flex h-6 w-6 items-center justify-center rounded-full border-2 border-text-secondary'
                              }
                            >
                              {set.completed && '✓'}
                            </div>
                          </button>
                        </div>
                      ))}

                      {/* Last Session Reference */}
                      <div className="border-t border-text-secondary/20 pt-3 text-sm text-text-secondary">
                        {lastSessionExercise ? (
                          <div>
                            Last session:{' '}
                            {lastSessionExercise.sets
                              .filter((s) => s.completed)
                              .map((s) => `${s.reps}×${s.kg}kg`)
                              .join(', ') || '—'}
                          </div>
                        ) : (
                          <div>Last session: —</div>
                        )}
                      </div>

                      {/* Edit/Delete Options */}
                      <div className="flex gap-2 border-t border-text-secondary/20 pt-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingExercise(exercise);
                          }}
                          className="flex-1 text-sm text-primary"
                        >
                          Edit Exercise
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirm(exercise.id);
                          }}
                          className="flex-1 text-sm text-red-500"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Add Exercise Button */}
            <button
              type="button"
              onClick={() => setIsAddingExercise(true)}
              className="w-full rounded-brand border-2 border-dashed border-text-secondary py-3 text-base text-text-secondary"
            >
              + Add Exercise
            </button>
          </div>

          {/* Energy Rating */}
          <div className="rounded-brand bg-card p-4">
            <div className="mb-3 text-base font-semibold text-text-primary">Energy Rating</div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="1"
                max="10"
                value={energyRating}
                onChange={(e) => setEnergyRating(parseInt(e.target.value))}
                className="flex-1"
                style={{
                  accentColor: '#B8960C',
                }}
              />
              <div className="w-8 text-center text-base font-bold text-primary">{energyRating}</div>
            </div>
          </div>

          {/* Injury Check-In Section */}
          <div className="rounded-brand border-2 border-text-secondary/30 bg-card p-4">
            <div className="mb-4 text-base font-semibold text-text-primary">Injury Check-In</div>
            
            <div className="space-y-4">
              {Object.entries(injuryCheckIns).map(([injuryName, injury]) => (
                <div key={injuryName} className="space-y-3 rounded-brand bg-background p-3">
                  <div className="text-base font-semibold text-text-primary">{injuryName}</div>
                  
                  {/* Pain Level Selector */}
                  <div>
                    <div className="mb-2 text-sm text-text-secondary">Pain Level (1-10)</div>
                    <div className="flex gap-1">
                      {Array.from({ length: 10 }).map((_, i) => {
                        const level = i + 1;
                        const isSelected = injury.painLevel === level;
                        return (
                          <button
                            key={level}
                            type="button"
                            onClick={() => {
                              setInjuryCheckIns((prev) => ({
                                ...prev,
                                [injuryName]: { ...prev[injuryName], painLevel: isSelected ? null : level },
                              }));
                            }}
                            className="min-h-[32px] flex-1"
                          >
                            <div
                              className={
                                isSelected
                                  ? 'flex h-7 w-full items-center justify-center rounded-brand bg-primary text-[10px] font-bold text-background'
                                  : 'flex h-7 w-full items-center justify-center rounded-brand border border-text-secondary text-[10px] text-text-secondary'
                              }
                            >
                              {level}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Affected by Session Toggle */}
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-text-secondary">Affected by today's session?</div>
                    <button
                      type="button"
                      onClick={() => {
                        setInjuryCheckIns((prev) => ({
                          ...prev,
                          [injuryName]: { 
                            ...prev[injuryName], 
                            affectedBySession: !prev[injuryName].affectedBySession,
                            exercises: !prev[injuryName].affectedBySession ? prev[injuryName].exercises : [],
                          },
                        }));
                      }}
                      className={
                        injury.affectedBySession
                          ? 'rounded-full bg-primary px-3 py-1 text-sm font-semibold text-background'
                          : 'rounded-full border border-text-secondary px-3 py-1 text-sm text-text-secondary'
                      }
                    >
                      {injury.affectedBySession ? 'Yes' : 'No'}
                    </button>
                  </div>

                  {/* Exercise Multi-Select (only if affected) */}
                  {injury.affectedBySession && (
                    <div>
                      <div className="mb-2 text-sm text-text-secondary">Which exercises?</div>
                      <div className="space-y-1">
                        {currentExercises.map((ex) => {
                          const isSelected = injury.exercises.includes(ex.name);
                          return (
                            <button
                              key={ex.id}
                              type="button"
                              onClick={() => {
                                setInjuryCheckIns((prev) => ({
                                  ...prev,
                                  [injuryName]: {
                                    ...prev[injuryName],
                                    exercises: isSelected
                                      ? prev[injuryName].exercises.filter((e) => e !== ex.name)
                                      : [...prev[injuryName].exercises, ex.name],
                                  },
                                }));
                              }}
                              className={
                                isSelected
                                  ? 'w-full rounded-brand border-2 border-primary bg-primary/10 px-3 py-2 text-left text-sm text-primary'
                                  : 'w-full rounded-brand border border-text-secondary px-3 py-2 text-left text-sm text-text-secondary'
                              }
                            >
                              {ex.name}
                            </button>
                          );
                        })}
                        
                        {/* Custom text entry for other exercises */}
                        <input
                          type="text"
                          placeholder="Other exercise (type to add)"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                              const customExercise = e.currentTarget.value.trim();
                              setInjuryCheckIns((prev) => ({
                                ...prev,
                                [injuryName]: {
                                  ...prev[injuryName],
                                  exercises: [...prev[injuryName].exercises, customExercise],
                                },
                              }));
                              e.currentTarget.value = '';
                            }
                          }}
                          className="w-full rounded-brand border border-text-secondary bg-card px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-secondary"
                        />
                      </div>
                    </div>
                  )}

                  {/* Notes Field */}
                  <div>
                    <div className="mb-1 text-sm text-text-secondary">Notes (optional)</div>
                    <textarea
                      value={injury.notes}
                      onChange={(e) => {
                        setInjuryCheckIns((prev) => ({
                          ...prev,
                          [injuryName]: { ...prev[injuryName], notes: e.target.value },
                        }));
                      }}
                      placeholder="Any additional details..."
                      rows={2}
                      className="w-full rounded-brand bg-card px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-secondary"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Save Session Button */}
          <button
            type="button"
            onClick={handleSaveSession}
            className="w-full rounded-brand bg-primary py-3 font-bold text-background"
          >
            Save Session
          </button>
        </>
      )}

      {/* Recent Sessions */}
      <div className="mt-6">
        <div className="mb-3 text-sm font-semibold tracking-widest text-text-secondary">RECENT SESSIONS</div>
        {recentSessions.length === 0 ? (
          <div className="rounded-brand bg-card p-6 text-center text-base text-text-secondary">
            No sessions logged yet. Complete your first workout to see it here.
          </div>
        ) : (
          <div className="space-y-2">
            {recentSessions.map((session, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setViewingSession(session)}
                className="w-full rounded-brand bg-card p-3 text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`text-sm font-semibold ${getDayTypeColor(session.dayType)}`}>
                      {session.dayType.toUpperCase()}
                    </div>
                    <div className="text-sm text-text-secondary">
                      {new Date(session.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                    {session.dayType !== 'rest' && (
                      <div className="text-sm text-text-secondary">{getTotalSetsForSession(session)} sets</div>
                    )}
                  </div>
                  {session.energyRating > 0 && (
                    <div className="flex items-center gap-1">
                      <svg className="h-4 w-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" />
                      </svg>
                      <span className="text-sm text-primary">{session.energyRating}</span>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Edit/Add Exercise Modal */}
      {(editingExercise || isAddingExercise) && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          onClick={() => {
            setEditingExercise(null);
            setIsAddingExercise(false);
            setNewExercise({ name: '', setsTarget: 3, injuryFlags: [], why: '' });
          }}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-md flex-col rounded-t-brand bg-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 pb-4">
              <div className="mb-4 text-lg font-bold text-text-primary">
                {isAddingExercise ? 'Add Exercise' : 'Edit Exercise'}
              </div>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-6">
              <div>
                <label className="mb-1 block text-sm text-text-secondary">Exercise Name</label>
                <input
                  type="text"
                  value={isAddingExercise ? newExercise.name : editingExercise?.name}
                  onChange={(e) =>
                    isAddingExercise
                      ? setNewExercise({ ...newExercise, name: e.target.value })
                      : setEditingExercise(editingExercise ? { ...editingExercise, name: e.target.value } : null)
                  }
                  className="w-full rounded-brand bg-background px-3 py-2 text-base text-text-primary outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-text-secondary">Sets Target</label>
                <input
                  type="number"
                  value={isAddingExercise ? newExercise.setsTarget : editingExercise?.setsTarget}
                  onChange={(e) =>
                    isAddingExercise
                      ? setNewExercise({ ...newExercise, setsTarget: parseInt(e.target.value) || 3 })
                      : setEditingExercise(
                          editingExercise ? { ...editingExercise, setsTarget: parseInt(e.target.value) || 3 } : null
                        )
                  }
                  className="w-full rounded-brand bg-background px-3 py-2 text-base text-text-primary outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-text-secondary">Injury Flags</label>
                <div className="space-y-2">
                  {(['right_shoulder', 'right_elbow', 'left_knee', 'right_knee'] as InjuryFlag[]).map((flag) => {
                    const isSelected = isAddingExercise
                      ? (newExercise.injuryFlags || []).includes(flag)
                      : editingExercise?.injuryFlags.includes(flag);

                    return (
                      <button
                        key={flag}
                        type="button"
                        onClick={() => handleToggleInjuryFlag(flag, !isAddingExercise)}
                        className={
                          isSelected
                            ? 'w-full rounded-brand border-2 border-amber-500 bg-amber-500/20 px-3 py-2 text-left text-base text-amber-500'
                            : 'w-full rounded-brand border border-text-secondary px-3 py-2 text-left text-base text-text-secondary'
                        }
                      >
                        {getInjuryFlagLabel(flag)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm text-text-secondary">Why this exercise is in the program</label>
                <textarea
                  value={isAddingExercise ? newExercise.why : editingExercise?.why}
                  onChange={(e) =>
                    isAddingExercise
                      ? setNewExercise({ ...newExercise, why: e.target.value })
                      : setEditingExercise(editingExercise ? { ...editingExercise, why: e.target.value } : null)
                  }
                  rows={3}
                  className="w-full rounded-brand bg-background px-3 py-2 text-base text-text-primary outline-none"
                />
              </div>
            </div>

            <div className="border-t border-text-secondary/20 p-6 pt-4">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setEditingExercise(null);
                    setIsAddingExercise(false);
                    setNewExercise({ name: '', setsTarget: 3, injuryFlags: [], why: '' });
                  }}
                  className="min-h-[44px] flex-1 rounded-brand bg-background text-text-primary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveExercise}
                  disabled={
                    isAddingExercise
                      ? !newExercise.name || !newExercise.why
                      : !editingExercise?.name || !editingExercise?.why
                  }
                  className={
                    (isAddingExercise ? newExercise.name && newExercise.why : editingExercise?.name && editingExercise?.why)
                      ? 'min-h-[44px] flex-1 rounded-brand bg-primary font-bold text-background'
                      : 'min-h-[44px] flex-1 rounded-brand bg-gray-700 font-bold text-gray-500 opacity-50'
                  }
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          onClick={() => setDeleteConfirm(null)}
        >
          <div className="w-full max-w-md rounded-t-brand bg-card p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 text-lg font-bold text-text-primary">Delete Exercise?</div>
            <div className="mb-6 text-base text-text-secondary">
              This will remove the exercise from your program. This action cannot be undone.
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
                onClick={() => handleDeleteExercise(deleteConfirm)}
                className="min-h-[44px] flex-1 rounded-brand bg-red-500 font-bold text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Session Modal */}
      {viewingSession && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          onClick={() => setViewingSession(null)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-md flex-col rounded-t-brand bg-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 pb-4">
              <div className="mb-2 text-lg font-bold text-text-primary">
                {getDayTypeLabel(viewingSession.dayType)}
              </div>
              <div className="text-sm text-text-secondary">
                {new Date(viewingSession.date).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-6">
              {viewingSession.dayType === 'rest' ? (
                <div className="text-center text-base text-text-secondary">Rest day logged</div>
              ) : (
                viewingSession.exercises.map((ex, idx) => (
                  <div key={idx} className="rounded-brand bg-background p-3">
                    <div className="mb-2 text-base font-semibold text-text-primary">{ex.name}</div>
                    <div className="space-y-1">
                      {ex.sets
                        .filter((s) => s.completed)
                        .map((set, setIdx) => (
                          <div key={setIdx} className="text-sm text-text-secondary">
                            Set {set.setNumber}: {set.reps} reps × {set.kg}kg
                          </div>
                        ))}
                    </div>
                  </div>
                ))
              )}

              {viewingSession.energyRating > 0 && (
                <div className="rounded-brand bg-background p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-base text-text-secondary">Energy Rating</div>
                    <div className="flex items-center gap-1">
                      <svg className="h-4 w-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" />
                      </svg>
                      <span className="text-base font-bold text-primary">{viewingSession.energyRating}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-text-secondary/20 p-6 pt-4">
              <button
                type="button"
                onClick={() => setViewingSession(null)}
                className="min-h-[44px] w-full rounded-brand bg-background text-text-primary"
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
