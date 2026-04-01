import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BodyLogEntry,
  BloodMarker,
  PyramidLayer,
  StageData,
  PeerComparison,
  saveBodyLogEntry,
  getLatestBodyStats,
  getBloodResults,
  getMarkerStatus,
  getStageData,
  saveStageData,
  getPyramidLayers,
  savePyramidLayers,
  getPeerComparison,
  savePeerComparison,
} from '../utils/reviewData';
import { getGymSessions } from '../utils/gymStructure';
import { getComplianceSnapshot, getCoachContext, SpecialistAction, STORAGE_KEYS, getMilestones, MilestoneEntry } from '../utils/coachContext';
import { addPatternEntry, getPatternMemory } from '../utils/patternMemory';

type StreamStatus = 'green' | 'amber' | 'red' | 'grey';

interface StreamRow {
  name: string;
  status: StreamStatus;
  lastActivity: string;
  built: boolean;
}

export default function Review() {
  const navigate = useNavigate();
  const [latestStats, setLatestStats] = useState<BodyLogEntry | null>(null);
  const [bloodResults, setBloodResults] = useState<{ markers: BloodMarker[]; nextTestDate: string | null }>({ markers: [], nextTestDate: null });
  const [stageData, setStageData] = useState<StageData & { pyramid?: PyramidLayer[] }>(getStageData());
  const [pyramidLayers, setPyramidLayers] = useState<PyramidLayer[]>(getPyramidLayers());
  const [peerComparison, setPeerComparison] = useState<PeerComparison>(getPeerComparison());
  const [gymSessions, setGymSessions] = useState(getGymSessions());

  const [showLogMeasurements, setShowLogMeasurements] = useState(false);
  const [showPyramidDetail, setShowPyramidDetail] = useState<PyramidLayer | null>(null);
  const [showEditDimension, setShowEditDimension] = useState<string | null>(null);
  const [showEditBenchmark, setShowEditBenchmark] = useState<{ type: 'fit40' | 'elite40'; field: string } | null>(null);

  const [newMeasurement, setNewMeasurement] = useState<Partial<BodyLogEntry>>({
    date: new Date().toISOString().split('T')[0],
  });
  const [bodyFatManual, setBodyFatManual] = useState(false);

  const [editingPyramid, setEditingPyramid] = useState<PyramidLayer | null>(null);
  const [dimensionScore, setDimensionScore] = useState(0);
  const [benchmarkValue, setBenchmarkValue] = useState(0);

  const [weeklyReviewLoading, setWeeklyReviewLoading] = useState(false);
  const [weeklyReviewStatus, setWeeklyReviewStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [weeklyReviewError, setWeeklyReviewError] = useState('');

  const [milestones, setMilestones] = useState<MilestoneEntry[]>([]);

  const [specialists, setSpecialists] = useState<SpecialistAction[]>([]);
  const [tick, setTick] = useState(0);
  const [showSpecialistModal, setShowSpecialistModal] = useState(false);
  const [editingSpecialistIndex, setEditingSpecialistIndex] = useState<number | null>(null);
  const [specialistForm, setSpecialistForm] = useState<SpecialistAction>({
    name: '', status: 'pending', purposeNote: '', outcome: '', dueDate: null, bookedDate: null,
  });

  const isSunday = new Date().toLocaleDateString('en-AU', {
    timeZone: 'Australia/Sydney',
    weekday: 'long',
  }) === 'Sunday';

  const handleWeeklyReview = async () => {
    setWeeklyReviewLoading(true);
    setWeeklyReviewStatus('idle');
    setWeeklyReviewError('');

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

      const context = getCoachContext();

      const systemPrompt = 'You are analysing one week of health and behaviour data for a 40 year old Sikh man building his life deliberately. Write a plain text weekly pattern summary in 4-6 sentences. Cover: what held this week, what slipped, any pattern worth naming, one specific focus for next week. No bullet points. No headers. Plain paragraphs only. Be direct and honest.';

      const response = await fetch(`${supabaseUrl}/functions/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
        },
        body: JSON.stringify({
          system: systemPrompt,
          messages: [{ role: 'user', content: JSON.stringify(context) }],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`API error: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();

      if (!data.content || !data.content[0] || !data.content[0].text) {
        throw new Error('Invalid response from API');
      }

      const summary = data.content[0].text as string;

      // Compute Monday of current week as YYYY-MM-DD using Sydney timezone
      const nowSydney = new Date(new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' }));
      const dayOfWeek = nowSydney.getDay();
      const monday = new Date(nowSydney);
      monday.setDate(nowSydney.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      const weekStart = monday.toISOString().split('T')[0];

      // Extract numeric metrics from already-fetched context
      let avgCalories: number | null = null;
      let avgProtein: number | null = null;
      if (Array.isArray(context.macros) && context.macros.length > 0) {
        const calValues = context.macros.map((d: any) => d.totals?.calories).filter((v: any) => typeof v === 'number');
        const protValues = context.macros.map((d: any) => d.totals?.protein).filter((v: any) => typeof v === 'number');
        if (calValues.length > 0) avgCalories = Math.round(calValues.reduce((a: number, b: number) => a + b, 0) / calValues.length);
        if (protValues.length > 0) avgProtein = Math.round(protValues.reduce((a: number, b: number) => a + b, 0) / protValues.length);
      } else if (Array.isArray(context.food?.last7Days) && context.food.last7Days.length > 0) {
        const calValues = context.food.last7Days.map((d: any) => d.dailyTotals?.calories).filter((v: any) => typeof v === 'number');
        const protValues = context.food.last7Days.map((d: any) => d.dailyTotals?.protein).filter((v: any) => typeof v === 'number');
        if (calValues.length > 0) avgCalories = Math.round(calValues.reduce((a: number, b: number) => a + b, 0) / calValues.length);
        if (protValues.length > 0) avgProtein = Math.round(protValues.reduce((a: number, b: number) => a + b, 0) / protValues.length);
      }

      const gymSessionCount: number = (() => {
        try {
          const raw = localStorage.getItem('grnd_gym_log');
          if (!raw) return 0;
          const sessions = JSON.parse(raw) as Array<{ date: string }>;
          const nowSydney = new Date(new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' }));
          const sevenDaysAgo = new Date(nowSydney);
          sevenDaysAgo.setDate(nowSydney.getDate() - 7);
          const sevenDaysAgoStr = sevenDaysAgo.toISOString().slice(0, 10);
          const todayStr = nowSydney.toISOString().slice(0, 10);
          return sessions.filter((s) => s.date >= sevenDaysAgoStr && s.date <= todayStr).length;
        } catch {
          return 0;
        }
      })();

      let avgSleepHours: number | null = null;
      if (Array.isArray(context.sleep) && context.sleep.length > 0) {
        const durations = context.sleep.map((d: any) => d.durationMinutes).filter((v: any) => typeof v === 'number');
        if (durations.length > 0) avgSleepHours = Math.round((durations.reduce((a: number, b: number) => a + b, 0) / durations.length / 60) * 10) / 10;
      }

      const complianceScore: number | null = systemHealthScore ?? null;
      const bodyWeight: number | null = context.body?.latest?.weight ?? null;

      const supplementCompliance: number | null = (() => {
        const days = context.food?.last7Days;
        const totalCount = context.food?.supplements?.totalCount ?? 0;
        if (!Array.isArray(days) || days.length === 0 || totalCount === 0) return null;
        const fullDays = days.filter((d: any) => d.supplementsConfirmed >= totalCount).length;
        return Math.round((fullDays / 7) * 100);
      })();

      addPatternEntry(weekStart, summary, {
        avgCalories,
        avgProtein,
        gymSessionCount,
        avgSleepHours,
        complianceScore,
        bodyWeight,
        supplementCompliance,
      });

      setWeeklyReviewStatus('success');
      setTimeout(() => setWeeklyReviewStatus('idle'), 2000);
    } catch (err) {
      setWeeklyReviewError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setWeeklyReviewStatus('error');
    } finally {
      setWeeklyReviewLoading(false);
    }
  };

  const DEFAULT_SPECIALISTS: SpecialistAction[] = [
    { name: 'DEXA scan', status: 'pending', purposeNote: '', outcome: '', dueDate: '2026-02-01', bookedDate: null },
    { name: 'Specialist barber', status: 'pending', purposeNote: '', outcome: '', dueDate: '2026-02-01', bookedDate: null },
    { name: 'Personal stylist', status: 'pending', purposeNote: '', outcome: '', dueDate: '2026-02-01', bookedDate: null },
    { name: 'Voice coach', status: 'pending', purposeNote: '', outcome: '', dueDate: '2026-02-01', bookedDate: null },
    { name: 'Toastmasters', status: 'pending', purposeNote: '', outcome: '', dueDate: '2026-02-01', bookedDate: null },
    { name: 'BJJ/Muay Thai research', status: 'pending', purposeNote: '', outcome: '', dueDate: '2026-02-01', bookedDate: null },
    { name: 'Dermatologist', status: 'pending', purposeNote: '', outcome: '', dueDate: '2026-02-01', bookedDate: null },
    { name: 'Sports Dietitian', status: 'booked', purposeNote: 'Follow-up', outcome: '', dueDate: '2026-05-07', bookedDate: '2026-03-26' },
    { name: 'Physio', status: 'booked', purposeNote: 'Active weekly', outcome: '', dueDate: null, bookedDate: null },
  ];

  useEffect(() => {
    setLatestStats(getLatestBodyStats());
    setBloodResults(getBloodResults());
    setGymSessions(getGymSessions());
    setMilestones(getMilestones());

    const existing = localStorage.getItem(STORAGE_KEYS.SPECIALIST_ACTIONS);
    if (!existing) {
      localStorage.setItem(STORAGE_KEYS.SPECIALIST_ACTIONS, JSON.stringify(DEFAULT_SPECIALISTS));
      setSpecialists(DEFAULT_SPECIALISTS);
    } else {
      try {
        setSpecialists(JSON.parse(existing) as SpecialistAction[]);
      } catch {
        setSpecialists(DEFAULT_SPECIALISTS);
      }
    }
  }, []);

  useEffect(() => {
    if (!isSunday) return;
    if (!latestStats) return;
    const currentMondayKey = (() => {
      const nowSydney = new Date(new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' }));
      const dayOfWeek = nowSydney.getDay();
      const monday = new Date(nowSydney);
      monday.setDate(nowSydney.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      return monday.toISOString().split('T')[0];
    })();
    const patterns = getPatternMemory();
    const alreadyRun = patterns.some(p => p.weekStart === currentMondayKey);
    if (alreadyRun) return;
    handleWeeklyReview();
  }, [isSunday, latestStats]);

  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    window.addEventListener('focus', bump);
    document.addEventListener('visibilitychange', bump);
    return () => {
      window.removeEventListener('focus', bump);
      document.removeEventListener('visibilitychange', bump);
    };
  }, []);

  const complianceSnapshot = useMemo(() => getComplianceSnapshot(), []);

  const meaningScore = useMemo(() => {
    try {
      const raw = localStorage.getItem('grnd_checklist_structure');
      if (!raw) return 0;
      const sections = JSON.parse(raw) as Array<{ items?: Array<{ purpose?: string }> }>;
      let total = 0;
      let withPurpose = 0;
      for (const section of sections) {
        for (const item of section.items ?? []) {
          total++;
          if (item.purpose && item.purpose.trim().length > 0) withPurpose++;
        }
      }
      return total === 0 ? 0 : Math.round((withPurpose / total) * 100);
    } catch {
      return 0;
    }
  }, [tick]);

  const systemHealthScore = useMemo(() => {
    const weights = {
      checklist: 0.25,
      sleep: 0.20,
      gym: 0.20,
      macros: 0.15,
      body: 0.05,
      meaning: 0.10,
      specialists: 0.05,
    };

    const statusToScore = (status: string | undefined) => {
      if (status === 'green') return 100;
      if (status === 'amber') return 60;
      if (status === 'red') return 20;
      return 0;
    };

    let totalScore = 0;
    totalScore += statusToScore(complianceSnapshot.checklist?.status) * weights.checklist;
    totalScore += statusToScore(complianceSnapshot.sleep?.status) * weights.sleep;
    totalScore += statusToScore(complianceSnapshot.gym?.status) * weights.gym;
    totalScore += statusToScore(complianceSnapshot.macros?.status) * weights.macros;
    totalScore += (latestStats ? 100 : 0) * weights.body;
    totalScore += meaningScore * weights.meaning;
    totalScore += statusToScore(complianceSnapshot.specialists?.status) * weights.specialists;

    return Math.round(totalScore);
  }, [complianceSnapshot, latestStats, meaningScore]);

  const streamRows: StreamRow[] = useMemo(() => {
    return [
      {
        name: 'Checklist',
        status: (complianceSnapshot.checklist?.status as StreamStatus) || 'grey',
        lastActivity: complianceSnapshot.checklist?.value?.toString() || 'Not yet tracking',
        built: !!complianceSnapshot.checklist,
      },
      {
        name: 'Sleep',
        status: (complianceSnapshot.sleep?.status as StreamStatus) || 'grey',
        lastActivity: complianceSnapshot.sleep?.value?.toString() || 'Not yet tracking',
        built: !!complianceSnapshot.sleep,
      },
      {
        name: 'Macros',
        status: (complianceSnapshot.macros?.status as StreamStatus) || 'grey',
        lastActivity: complianceSnapshot.macros?.value?.toString() || 'Not yet tracking',
        built: !!complianceSnapshot.macros,
      },
      {
        name: 'Gym Sessions',
        status: (complianceSnapshot.gym?.status as StreamStatus) || 'grey',
        lastActivity: complianceSnapshot.gym?.value?.toString() || 'Not yet tracking',
        built: !!complianceSnapshot.gym,
      },
      {
        name: 'Meaning Fields',
        status: meaningScore >= 80 ? 'green' : meaningScore >= 40 ? 'amber' : 'red',
        lastActivity: `${meaningScore}% items have purpose`,
        built: true,
      },
      {
        name: 'Body Stats',
        status: latestStats ? 'green' : 'grey',
        lastActivity: latestStats ? 'Logged' : 'Not yet tracking',
        built: true,
      },
      {
        name: 'Specialist Actions',
        status: (complianceSnapshot.specialists?.status as StreamStatus) || 'grey',
        lastActivity: complianceSnapshot.specialists
          ? complianceSnapshot.specialists.value === 0
            ? 'All actions booked'
            : `${complianceSnapshot.specialists.value} actions overdue`
          : 'Not yet tracking',
        built: !!complianceSnapshot.specialists,
      },
    ];
  }, [complianceSnapshot, latestStats, meaningScore]);

  const gymPerformanceScore = useMemo(() => {
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);
    const recentSessions = gymSessions.filter((s) => new Date(s.date) >= last30Days);
    const target = 12;
    const percentage = Math.min(100, Math.round((recentSessions.length / target) * 100));
    return percentage;
  }, [gymSessions]);

  const stageReadinessPercentage = useMemo(() => {
    if (!latestStats) return 0;
    const stage1 = stageData.stages[0];
    if (!stage1.unlockConditions) return 0;

    let progress = 0;
    let total = 0;

    if (stage1.unlockConditions.weight && latestStats.weight) {
      total++;
      if (latestStats.weight <= stage1.unlockConditions.weight) progress++;
    }

    if (stage1.unlockConditions.bodyFat && latestStats.bodyFat) {
      total++;
      if (latestStats.bodyFat < stage1.unlockConditions.bodyFat) progress++;
    }

    if (stage1.unlockConditions.waist && latestStats.waist) {
      total++;
      if (latestStats.waist <= stage1.unlockConditions.waist) progress++;
    }

    if (stage1.unlockConditions.gymConsistency) {
      total++;
      if (gymPerformanceScore >= stage1.unlockConditions.gymConsistency) progress++;
    }

    return total > 0 ? Math.round((progress / total) * 100) : 0;
  }, [latestStats, stageData, gymPerformanceScore]);

  // US Navy formula (male): BF% = 495 / (1.0324 - 0.19077×log10(waist_cm - neck_cm) + 0.15456×log10(height_cm)) - 450
  // waist and neck are stored in mm → divide by 10 to get cm
  const calcNavyBodyFat = (waistMm: number, neckMm: number, heightCm = 173): number => {
    const neckCm = neckMm / 10;
    const diff = waistMm / 10 - neckCm;
    if (diff <= 0) return 0;
    const bf = 495 / (1.0324 - 0.19077 * Math.log10(diff) + 0.15456 * Math.log10(heightCm)) - 450;
    return Math.round(bf * 10) / 10;
  };

  const handleSaveMeasurement = () => {
    if (!newMeasurement.date) return;

    let bodyFat = newMeasurement.bodyFat;
    if (!bodyFat && newMeasurement.waist && newMeasurement.neck) {
      bodyFat = calcNavyBodyFat(newMeasurement.waist, newMeasurement.neck);
    }

    const entry: BodyLogEntry = {
      date: newMeasurement.date,
      weight: newMeasurement.weight,
      bodyFat,
      waist: newMeasurement.waist,
      neck: newMeasurement.neck,
      restingHR: newMeasurement.restingHR,
      systolic: newMeasurement.systolic,
      diastolic: newMeasurement.diastolic,
    };

    saveBodyLogEntry(entry);
    setLatestStats(getLatestBodyStats());
    setShowLogMeasurements(false);
    setNewMeasurement({ date: new Date().toISOString().split('T')[0] });
    setBodyFatManual(false);
  };

  const handleSavePyramidLayer = () => {
    if (!editingPyramid) return;

    const updated = pyramidLayers.map((layer) =>
      layer.id === editingPyramid.id ? editingPyramid : layer
    );

    savePyramidLayers(updated);
    setPyramidLayers(updated);
    setEditingPyramid(null);
    setShowPyramidDetail(null);
  };

  const handleSaveDimension = () => {
    if (!showEditDimension) return;

    const updated = {
      ...stageData,
      workReadiness: {
        ...stageData.workReadiness,
        [showEditDimension]: dimensionScore,
      },
    };

    saveStageData(updated);
    setStageData(updated);
    setShowEditDimension(null);
  };

  const handleSaveBenchmark = () => {
    if (!showEditBenchmark) return;

    const { type, field } = showEditBenchmark;
    const updated = {
      ...peerComparison,
      [type]: {
        ...peerComparison[type],
        [field]: benchmarkValue,
      },
    };

    savePeerComparison(updated);
    setPeerComparison(updated);
    setShowEditBenchmark(null);
  };

  const handleSaveSpecialist = () => {
    if (!specialistForm.name.trim()) return;
    const updated = [...specialists];
    if (editingSpecialistIndex !== null) {
      updated[editingSpecialistIndex] = specialistForm;
    } else {
      updated.push(specialistForm);
    }
    localStorage.setItem(STORAGE_KEYS.SPECIALIST_ACTIONS, JSON.stringify(updated));
    setSpecialists(updated);
    setShowSpecialistModal(false);
  };

  const calcDaysOverdue = (dueDate: string | null): number | null => {
    if (!dueDate) return null;
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.floor((today.getTime() - due.getTime()) / (24 * 60 * 60 * 1000));
  };

  const getStatusColor = (status: StreamStatus) => {
    switch (status) {
      case 'green':
        return 'bg-green-500';
      case 'amber':
        return 'bg-amber-500';
      case 'red':
        return 'bg-red-500';
      case 'grey':
        return 'bg-gray-500';
    }
  };

  const bestStream = useMemo(() => {
    const built = streamRows.filter((s) => s.built && s.status !== 'grey');
    if (built.length === 0) return null;
    const sorted = [...built].sort((a, b) => {
      const order = { green: 3, amber: 2, red: 1, grey: 0 };
      return order[b.status] - order[a.status];
    });
    return sorted[0];
  }, [streamRows]);

  const weakestStream = useMemo(() => {
    const built = streamRows.filter((s) => s.built && s.status !== 'grey');
    if (built.length === 0) return null;
    const sorted = [...built].sort((a, b) => {
      const order = { green: 3, amber: 2, red: 1, grey: 0 };
      return order[a.status] - order[b.status];
    });
    return sorted[0];
  }, [streamRows]);

  return (
    <div className="flex flex-1 flex-col gap-6 pb-20">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="text-lg font-bold text-primary">Review</div>
        <div className="text-[10px] tracking-widest text-text-secondary">INTELLIGENCE DASHBOARD</div>
      </div>

      {/* Weekly Review */}
      {isSunday ? (
        <div className="rounded-2xl border border-[#d4af37] bg-[#141414] p-4">
          <div className="mb-3 text-sm font-semibold text-[#d4af37]">Weekly Review</div>
          <p className="mb-4 text-xs text-zinc-400">Generate a plain-text pattern summary for this week and save it to Coach memory.</p>
          <button
            type="button"
            onClick={handleWeeklyReview}
            disabled={weeklyReviewLoading || weeklyReviewStatus === 'success'}
            className="w-full rounded-brand border border-[#d4af37] bg-background py-3 text-sm font-semibold text-[#d4af37] disabled:opacity-50"
          >
            {weeklyReviewLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Reviewing your week...
              </span>
            ) : weeklyReviewStatus === 'success' ? (
              <span className="flex items-center justify-center gap-2 text-green-400">
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Week saved.
              </span>
            ) : (
              'Review this week'
            )}
          </button>
          {weeklyReviewStatus === 'error' && (
            <p className="mt-3 text-xs text-red-400">{weeklyReviewError}</p>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-[#d4af37] bg-[#141414] p-4 opacity-50">
          <div className="text-sm font-semibold text-[#d4af37]">Weekly Review</div>
          <div className="mt-1 text-xs text-zinc-400">Available Sunday</div>
        </div>
      )}

      {/* 1. Compliance Dashboard */}
      <div className="rounded-2xl border border-[#2a2a2a] bg-[#141414] p-4">
        <div className="mb-4 text-center">
          <div className="text-3xl font-bold text-[#d4af37]">{systemHealthScore}</div>
          <div className="mt-1 text-sm text-zinc-400">System Health Score</div>
        </div>

        <div className="space-y-2">
          {streamRows.map((stream) => (
            <div
              key={stream.name}
              className="w-full rounded-brand bg-background p-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-3 w-3 rounded-full ${getStatusColor(stream.status)}`} />
                  <div className="text-base text-text-primary">{stream.name}</div>
                </div>
                <div className="text-sm text-text-secondary">{stream.lastActivity}</div>
              </div>
              {stream.status === 'red' && stream.built && (
                <button
                  type="button"
                  onClick={() => navigate('/coach')}
                  className="mt-2 w-full rounded-brand border border-primary px-3 py-1 text-sm text-primary"
                >
                  Talk to Coach about this
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-2xl border border-[#2a2a2a] bg-[#141414] p-3">
          <div className="mb-2 text-sm font-semibold text-zinc-400">WEEKLY SUMMARY</div>
          <div className="space-y-1 text-sm text-text-primary">
            <div>System Health: {systemHealthScore}/100</div>
            {bestStream && <div>Best Stream: {bestStream.name}</div>}
            {weakestStream && <div>Weakest Stream: {weakestStream.name}</div>}
          </div>
        </div>
      </div>

      {/* 2. Identity Milestones */}
      <div>
        <div className="mb-3 text-sm font-semibold tracking-widest text-text-secondary">IDENTITY MILESTONES</div>

        {milestones.length === 0 ? (
          <div className="rounded-2xl border border-[#2a2a2a] bg-[#141414] p-4 text-center text-sm text-zinc-400">
            Milestones appear when you hold a stream green for 7, 14, or 30 days.
          </div>
        ) : (
          <div className="space-y-2">
            {[...milestones]
              .sort((a, b) => b.achievedDate.localeCompare(a.achievedDate))
              .map((m) => {
                const [y, mo, d] = m.achievedDate.split('-');
                const dateObj = new Date(Number(y), Number(mo) - 1, Number(d));
                const formatted = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                return (
                  <div key={m.id} className="rounded-2xl border border-[#d4af37] bg-[#141414] p-4">
                    <div className="text-base font-semibold text-[#d4af37]">{m.label}</div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="rounded-full bg-[#2a2a2a] px-2 py-0.5 text-[10px] tracking-widest text-zinc-400">
                        {m.stream.toUpperCase()}
                      </span>
                      <span className="text-xs text-zinc-500">{formatted}</span>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* 3. Pyramid Status */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold tracking-widest text-text-secondary">PYRAMID STATUS</div>
          <button type="button" className="text-sm text-primary">
            Recalculate
          </button>
        </div>

        <div className="rounded-2xl border border-[#2a2a2a] bg-[#141414] p-6">
          <div className="space-y-1">
            {pyramidLayers.slice().reverse().map((layer) => (
              <button
                key={layer.id}
                type="button"
                onClick={() => setShowPyramidDetail(layer)}
                className="w-full rounded-2xl px-4 py-2 text-center text-sm font-bold text-black"
                style={{
                  width: `${100 - (layer.id - 1) * 6}%`,
                  margin: '0 auto',
                  backgroundColor: layer.id === 10 ? '#ffd700' : layer.id === 9 ? '#d4af37' : layer.id === 8 ? '#d4a030' : layer.id === 7 ? '#c49028' : layer.id === 6 ? '#b08020' : layer.id === 5 ? '#9a7018' : layer.id === 4 ? '#8a6214' : layer.id === 3 ? '#7a5510' : layer.id === 2 ? '#6b4a0d' : '#5a3e0a'
                } as React.CSSProperties}
              >
                {layer.name}
              </button>
            ))}
          </div>

          <div className="mt-4 flex justify-center gap-4 text-[10px] text-text-secondary">
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span>Stable</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <span>Building</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-amber-500" />
              <span>Cracking</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-red-500" />
              <span>Broken</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Body Stats */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold tracking-widest text-text-secondary">BODY STATS</div>
          <button
            type="button"
            onClick={() => {
              const prev = getLatestBodyStats();
              setNewMeasurement({
                date: new Date().toISOString().split('T')[0],
                weight: prev?.weight,
                bodyFat: prev?.bodyFat,
                waist: prev?.waist,
                neck: prev?.neck,
                restingHR: prev?.restingHR,
                systolic: prev?.systolic,
                diastolic: prev?.diastolic,
              });
              setBodyFatManual(false);
              setShowLogMeasurements(true);
            }}
            className="rounded-brand border border-primary px-3 py-1 text-sm text-primary"
          >
            Log Measurements
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-brand bg-card p-3">
            <div className="text-[10px] tracking-widest text-text-secondary">WEIGHT</div>
            <div className="mt-1 text-xl font-bold text-text-primary">
              {latestStats?.weight ? `${latestStats.weight}kg` : '—'}
            </div>
          </div>
          <div className="rounded-brand bg-card p-3">
            <div className="text-[10px] tracking-widest text-text-secondary">BODY FAT</div>
            <div className="mt-1 text-xl font-bold text-text-primary">
              {latestStats?.bodyFat ? `${latestStats.bodyFat}%` : '—'}
            </div>
            {latestStats?.bodyFat && latestStats?.neck && (
              <div className="mt-0.5 text-[10px] text-zinc-500">Navy formula</div>
            )}
          </div>
          <div className="rounded-brand bg-card p-3">
            <div className="text-[10px] tracking-widest text-text-secondary">WAIST</div>
            <div className="mt-1 text-xl font-bold text-text-primary">
              {latestStats?.waist ? `${latestStats.waist}mm` : '—'}
            </div>
          </div>
          <div className="rounded-brand bg-card p-3">
            <div className="text-[10px] tracking-widest text-text-secondary">RESTING HR</div>
            <div className="mt-1 text-xl font-bold text-text-primary">
              {latestStats?.restingHR ? `${latestStats.restingHR}bpm` : '—'}
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-brand bg-card p-3">
          <div className="text-[10px] tracking-widest text-text-secondary">BLOOD PRESSURE</div>
          <div className="mt-1 text-xl font-bold text-text-primary">
            {latestStats?.systolic && latestStats?.diastolic
              ? `${latestStats.systolic}/${latestStats.diastolic} mmHg`
              : '—'}
          </div>
        </div>
      </div>

      {/* 4. Gym Performance */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold tracking-widest text-text-secondary">GYM PERFORMANCE</div>
          <div className="text-base font-bold text-primary">{gymPerformanceScore}%</div>
        </div>

        <div className="rounded-brand bg-card p-4">
          <div className="mb-2 h-2 w-full rounded-full bg-background">
            <div
              className="h-2 rounded-full bg-primary"
              style={{ width: `${gymPerformanceScore}%` }}
            />
          </div>
          <div className="text-sm text-text-secondary">
            Last scored: {gymSessions.length > 0 ? new Date(gymSessions[gymSessions.length - 1].date).toLocaleDateString() : '—'}
          </div>
        </div>
      </div>

      {/* 5. Stage Readiness */}
      <div>
        <div className="mb-3 text-sm font-semibold tracking-widest text-text-secondary">STAGE READINESS</div>

        <div className="rounded-brand bg-card p-4">
          <div className="mb-4 text-center">
            <div className="text-base font-bold text-primary">STAGE 1 READINESS — BUILD</div>
            <div className="mt-4">
              <svg className="mx-auto h-24 w-24" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#333" strokeWidth="8" />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#B8960C"
                  strokeWidth="8"
                  strokeDasharray={`${stageReadinessPercentage * 2.51} 251`}
                  strokeLinecap="round"
                  transform="rotate(-90 50 50)"
                />
                <text x="50" y="50" textAnchor="middle" dy="7" fontSize="20" fill="#B8960C" fontWeight="bold">
                  {stageReadinessPercentage}%
                </text>
              </svg>
            </div>
          </div>

          <div className="space-y-2">
            {stageData.stages[0].unlockConditions.weight && (
              <div>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-text-secondary">Weight</span>
                  <span className="text-text-primary">
                    {latestStats?.weight || '—'} → {stageData.stages[0].unlockConditions.weight}kg
                  </span>
                </div>
                <div className="h-1 w-full rounded-full bg-background">
                  <div
                    className="h-1 rounded-full bg-primary"
                    style={{
                      width: latestStats?.weight
                        ? `${Math.min(100, ((stageData.stages[0].unlockConditions.weight - latestStats.weight) / stageData.stages[0].unlockConditions.weight) * 100 + 100)}%`
                        : '0%',
                    }}
                  />
                </div>
              </div>
            )}
            {stageData.stages[0].unlockConditions.bodyFat && (
              <div>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-text-secondary">Body Fat</span>
                  <span className="text-text-primary">
                    {latestStats?.bodyFat || '—'} → &lt;{stageData.stages[0].unlockConditions.bodyFat}%
                  </span>
                </div>
                <div className="h-1 w-full rounded-full bg-background">
                  <div
                    className="h-1 rounded-full bg-primary"
                    style={{
                      width: latestStats?.bodyFat
                        ? `${Math.min(100, ((stageData.stages[0].unlockConditions.bodyFat - latestStats.bodyFat) / stageData.stages[0].unlockConditions.bodyFat) * 100 + 100)}%`
                        : '0%',
                    }}
                  />
                </div>
              </div>
            )}
            {stageData.stages[0].unlockConditions.gymConsistency && (
              <div>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-text-secondary">Gym 6mo consistency</span>
                  <span className="text-text-primary">
                    {gymPerformanceScore}% → {stageData.stages[0].unlockConditions.gymConsistency}%
                  </span>
                </div>
                <div className="h-1 w-full rounded-full bg-background">
                  <div
                    className="h-1 rounded-full bg-primary"
                    style={{ width: `${(gymPerformanceScore / stageData.stages[0].unlockConditions.gymConsistency) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 text-sm text-text-secondary">
            Unlock: ≤{stageData.stages[0].unlockConditions.weight}kg, BF &lt;{stageData.stages[0].unlockConditions.bodyFat}%, 6 months consistent
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {stageData.stages.map((stage) => (
            <div
              key={stage.number}
              className={
                stage.number === stageData.currentStage
                  ? 'w-full rounded-brand border-2 border-primary bg-primary/10 p-2'
                  : stage.unlocked
                    ? 'w-full rounded-brand bg-primary p-2'
                    : 'w-full rounded-brand bg-card p-2 opacity-50'
              }
            >
              <div className="text-sm font-semibold text-text-primary">
                Stage {stage.number}: {stage.name}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 6. Work Readiness */}
      <div>
        <div className="mb-3 text-sm font-semibold tracking-widest text-text-secondary">WORK READINESS</div>

        {Object.values(stageData.workReadiness).every((v) => v === 0) ? (
          <div className="rounded-brand bg-card p-6 text-center">
            <div className="mb-4 text-base text-text-secondary">Ask GRND to assess your work readiness</div>
            <button
              type="button"
              onClick={() => navigate('/coach')}
              className="rounded-brand border border-primary px-4 py-2 text-base text-primary"
            >
              Ask GRND to assess
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(stageData.workReadiness).map(([key, value]) => {
              const label = key
                .replace(/([A-Z])/g, ' $1')
                .replace(/^./, (str) => str.toUpperCase())
                .trim();

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setShowEditDimension(key);
                    setDimensionScore(value);
                  }}
                  className="w-full rounded-brand bg-card p-3 text-left"
                >
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="text-text-primary">{label}</span>
                    <span className="text-text-secondary">{value}/10</span>
                  </div>
                  <div className="relative h-2 w-full rounded-full bg-background">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${(value / 10) * 100}%` }}
                    />
                    <div
                      className="absolute top-0 h-2 w-0.5 bg-amber-500"
                      style={{ left: '70%' }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 7. Blood Results */}
      <div>
        <div className="mb-1 text-sm font-semibold tracking-widest text-text-secondary">BLOOD RESULTS</div>
        {bloodResults.nextTestDate && (
          <div className="mb-3 text-sm text-[#b8960c]">
            Next panel: {new Date(bloodResults.nextTestDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
        )}

        {bloodResults.markers.length === 0 ? (
          <div className="rounded-brand bg-card p-6 text-center text-base text-text-secondary">
            No results uploaded yet. Upload blood results via the Library in the Coach tab.
          </div>
        ) : (
          <div className="space-y-2">
            {bloodResults.markers.map((marker, idx) => {
              const status = getMarkerStatus(marker);
              const badgeClass =
                status === 'optimal' ? 'bg-green-500 text-background' :
                status === 'normal' ? 'bg-[#d4af37] text-black' :
                status === 'low' ? 'bg-amber-500 text-black' :
                'bg-red-500 text-white';
              return (
                <div key={idx} className="rounded-brand bg-card p-3">
                  <div className="mb-1 flex items-start justify-between">
                    <div className="text-base font-semibold text-text-primary">{marker.name}</div>
                    <div className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeClass}`}>
                      {status.toUpperCase()}
                    </div>
                  </div>
                  <div className="text-lg font-bold text-primary">
                    {marker.value} {marker.unit}
                  </div>
                  <div className="mt-1 text-sm text-text-secondary">
                    Optimal: {marker.optimalMin}-{marker.optimalMax} {marker.unit} · {new Date(marker.date).toLocaleDateString()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 8. Specialist Actions */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold tracking-widest text-text-secondary">SPECIALIST ACTIONS</div>
          <button
            type="button"
            onClick={() => {
              setSpecialistForm({ name: '', status: 'pending', purposeNote: '', outcome: '', dueDate: null, bookedDate: null });
              setEditingSpecialistIndex(null);
              setShowSpecialistModal(true);
            }}
            className="rounded-brand border border-primary px-3 py-1 text-sm text-primary"
          >
            + Add
          </button>
        </div>

        <div className="space-y-2">
          {specialists.map((s, idx) => {
            const daysOverdue = s.status === 'pending' ? calcDaysOverdue(s.dueDate) : null;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setSpecialistForm({ ...s });
                  setEditingSpecialistIndex(idx);
                  setShowSpecialistModal(true);
                }}
                className="w-full rounded-brand bg-card p-3 text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="text-base font-semibold text-text-primary">{s.name}</div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    s.status === 'booked' ? 'bg-green-500 text-black' :
                    s.status === 'completed' ? 'bg-zinc-600 text-white' :
                    'bg-amber-500 text-black'
                  }`}>
                    {s.status.toUpperCase()}
                  </span>
                </div>
                {s.status === 'pending' && daysOverdue !== null && daysOverdue > 0 && (
                  <div className={`mt-1 text-sm ${daysOverdue > 14 ? 'text-red-400' : 'text-amber-400'}`}>
                    {daysOverdue} days overdue
                  </div>
                )}
                {s.status === 'booked' && s.bookedDate && (
                  <div className="mt-1 text-sm text-zinc-400">Booked: {s.bookedDate}</div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 9. Peer Comparison */}
      <div>
        <div className="mb-3 text-sm font-semibold tracking-widest text-text-secondary">PEER COMPARISON</div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-text-secondary/20">
                <th className="pb-2 text-left text-text-secondary">METRIC</th>
                <th className="pb-2 text-center text-text-secondary">YOU</th>
                <th className="pb-2 text-center text-text-secondary">FIT 40</th>
                <th className="pb-2 text-center text-text-secondary">ELITE 40</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-text-secondary/20">
                <td className="py-3 text-text-primary">Weight</td>
                <td className="py-3 text-center text-text-primary">{latestStats?.weight ? `${latestStats.weight}kg` : '—'}</td>
                <td className="py-3 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditBenchmark({ type: 'fit40', field: 'weight' });
                      setBenchmarkValue(peerComparison.fit40.weight);
                    }}
                    className="text-text-secondary hover:text-primary"
                  >
                    {peerComparison.fit40.weight}kg
                  </button>
                </td>
                <td className="py-3 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditBenchmark({ type: 'elite40', field: 'weight' });
                      setBenchmarkValue(peerComparison.elite40.weight);
                    }}
                    className="text-text-secondary hover:text-primary"
                  >
                    {peerComparison.elite40.weight}kg
                  </button>
                </td>
              </tr>
              <tr className="border-b border-text-secondary/20">
                <td className="py-3 text-text-primary">Body Fat</td>
                <td className="py-3 text-center text-text-primary">{latestStats?.bodyFat ? `${latestStats.bodyFat}%` : '—'}</td>
                <td className="py-3 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditBenchmark({ type: 'fit40', field: 'bodyFat' });
                      setBenchmarkValue(peerComparison.fit40.bodyFat);
                    }}
                    className="text-text-secondary hover:text-primary"
                  >
                    {peerComparison.fit40.bodyFat}%
                  </button>
                </td>
                <td className="py-3 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditBenchmark({ type: 'elite40', field: 'bodyFat' });
                      setBenchmarkValue(peerComparison.elite40.bodyFat);
                    }}
                    className="text-text-secondary hover:text-primary"
                  >
                    {peerComparison.elite40.bodyFat}%
                  </button>
                </td>
              </tr>
              <tr className="border-b border-text-secondary/20">
                <td className="py-3 text-text-primary">Waist</td>
                <td className="py-3 text-center text-text-primary">{latestStats?.waist ? `${latestStats.waist}mm` : '—'}</td>
                <td className="py-3 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditBenchmark({ type: 'fit40', field: 'waist' });
                      setBenchmarkValue(peerComparison.fit40.waist);
                    }}
                    className="text-text-secondary hover:text-primary"
                  >
                    {peerComparison.fit40.waist}cm
                  </button>
                </td>
                <td className="py-3 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditBenchmark({ type: 'elite40', field: 'waist' });
                      setBenchmarkValue(peerComparison.elite40.waist);
                    }}
                    className="text-text-secondary hover:text-primary"
                  >
                    {peerComparison.elite40.waist}cm
                  </button>
                </td>
              </tr>
              <tr>
                <td className="py-3 text-text-primary">Resting HR</td>
                <td className="py-3 text-center text-text-primary">{latestStats?.restingHR ? `${latestStats.restingHR}bpm` : '—'}</td>
                <td className="py-3 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditBenchmark({ type: 'fit40', field: 'restingHR' });
                      setBenchmarkValue(peerComparison.fit40.restingHR);
                    }}
                    className="text-text-secondary hover:text-primary"
                  >
                    {peerComparison.fit40.restingHR}bpm
                  </button>
                </td>
                <td className="py-3 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditBenchmark({ type: 'elite40', field: 'restingHR' });
                      setBenchmarkValue(peerComparison.elite40.restingHR);
                    }}
                    className="text-text-secondary hover:text-primary"
                  >
                    {peerComparison.elite40.restingHR}bpm
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Measurements Modal */}
      {showLogMeasurements && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          onClick={() => setShowLogMeasurements(false)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-md flex-col rounded-t-brand bg-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 pb-4">
              <div className="text-lg font-bold text-text-primary">Log Measurements</div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-6">
              <div>
                <label className="mb-1 block text-sm text-text-secondary">Date</label>
                <input
                  type="date"
                  value={newMeasurement.date}
                  onChange={(e) => setNewMeasurement({ ...newMeasurement, date: e.target.value })}
                  className="w-full rounded-brand bg-background px-3 py-2 text-base text-text-primary outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-text-secondary">Weight (kg)</label>
                <input
                  type="number"
                  value={newMeasurement.weight || ''}
                  onChange={(e) => setNewMeasurement({ ...newMeasurement, weight: parseFloat(e.target.value) || undefined })}
                  className="w-full rounded-brand bg-background px-3 py-2 text-base text-text-primary outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-text-secondary">
                  Body Fat (%) {!bodyFatManual && newMeasurement.waist && newMeasurement.neck ? <span className="text-zinc-500">— auto (Navy)</span> : null}
                </label>
                <input
                  type="number"
                  value={newMeasurement.bodyFat || ''}
                  onChange={(e) => {
                    setBodyFatManual(true);
                    setNewMeasurement({ ...newMeasurement, bodyFat: parseFloat(e.target.value) || undefined });
                  }}
                  className="w-full rounded-brand bg-background px-3 py-2 text-base text-text-primary outline-none"
                  placeholder="Auto-calculated from waist + neck"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm text-text-secondary">Waist (mm)</label>
                  <input
                    type="number"
                    value={newMeasurement.waist || ''}
                    onChange={(e) => {
                      const waist = parseFloat(e.target.value) || undefined;
                      const neck = newMeasurement.neck;
                      const bf = !bodyFatManual && waist && neck ? calcNavyBodyFat(waist, neck) : newMeasurement.bodyFat;
                      setNewMeasurement({ ...newMeasurement, waist, bodyFat: bf });
                    }}
                    className="w-full rounded-brand bg-background px-3 py-2 text-base text-text-primary outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-text-secondary">Neck (mm)</label>
                  <input
                    type="number"
                    value={newMeasurement.neck || ''}
                    onChange={(e) => {
                      const neck = parseFloat(e.target.value) || undefined;
                      const waist = newMeasurement.waist;
                      const bf = !bodyFatManual && waist && neck ? calcNavyBodyFat(waist, neck) : newMeasurement.bodyFat;
                      setNewMeasurement({ ...newMeasurement, neck, bodyFat: bf });
                    }}
                    className="w-full rounded-brand bg-background px-3 py-2 text-base text-text-primary outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm text-text-secondary">Resting HR (bpm)</label>
                <input
                  type="number"
                  value={newMeasurement.restingHR || ''}
                  onChange={(e) => setNewMeasurement({ ...newMeasurement, restingHR: parseFloat(e.target.value) || undefined })}
                  className="w-full rounded-brand bg-background px-3 py-2 text-base text-text-primary outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm text-text-secondary">Systolic</label>
                  <input
                    type="number"
                    value={newMeasurement.systolic || ''}
                    onChange={(e) => setNewMeasurement({ ...newMeasurement, systolic: parseFloat(e.target.value) || undefined })}
                    className="w-full rounded-brand bg-background px-3 py-2 text-base text-text-primary outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-text-secondary">Diastolic</label>
                  <input
                    type="number"
                    value={newMeasurement.diastolic || ''}
                    onChange={(e) => setNewMeasurement({ ...newMeasurement, diastolic: parseFloat(e.target.value) || undefined })}
                    className="w-full rounded-brand bg-background px-3 py-2 text-base text-text-primary outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-text-secondary/20 p-6 pt-4">
              <button
                type="button"
                onClick={handleSaveMeasurement}
                className="min-h-[44px] w-full rounded-brand bg-primary font-bold text-background"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pyramid Detail Modal */}
      {showPyramidDetail && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          onClick={() => {
            setShowPyramidDetail(null);
            setEditingPyramid(null);
          }}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-md flex-col rounded-t-brand bg-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 pb-4">
              <div className="text-lg font-bold text-text-primary">{showPyramidDetail.name}</div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-6">
              <div>
                <label className="mb-1 block text-sm text-text-secondary">Status</label>
                <select
                  value={editingPyramid?.status || showPyramidDetail.status}
                  onChange={(e) =>
                    setEditingPyramid({
                      ...(editingPyramid || showPyramidDetail),
                      status: e.target.value as PyramidLayer['status'],
                    })
                  }
                  className="w-full rounded-brand bg-background px-3 py-2 text-base text-text-primary outline-none"
                >
                  <option value="stable">Stable</option>
                  <option value="building">Building</option>
                  <option value="cracking">Cracking</option>
                  <option value="broken">Broken</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-text-secondary">Active Actions</label>
                <textarea
                  value={editingPyramid?.activeActions || showPyramidDetail.activeActions}
                  onChange={(e) =>
                    setEditingPyramid({
                      ...(editingPyramid || showPyramidDetail),
                      activeActions: e.target.value,
                    })
                  }
                  rows={3}
                  className="w-full rounded-brand bg-background px-3 py-2 text-base text-text-primary outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-text-secondary">Evidence Logged</label>
                <textarea
                  value={editingPyramid?.evidence || showPyramidDetail.evidence}
                  onChange={(e) =>
                    setEditingPyramid({
                      ...(editingPyramid || showPyramidDetail),
                      evidence: e.target.value,
                    })
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
                    setShowPyramidDetail(null);
                    setEditingPyramid(null);
                  }}
                  className="min-h-[44px] flex-1 rounded-brand bg-background text-text-primary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSavePyramidLayer}
                  className="min-h-[44px] flex-1 rounded-brand bg-primary font-bold text-background"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Dimension Modal */}
      {showEditDimension && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          onClick={() => setShowEditDimension(null)}
        >
          <div
            className="w-full max-w-md rounded-t-brand bg-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 text-lg font-bold text-text-primary">
              {showEditDimension.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase()).trim()}
            </div>
            <div className="mb-4">
              <label className="mb-2 block text-sm text-text-secondary">Score (1-10)</label>
              <input
                type="number"
                min="0"
                max="10"
                value={dimensionScore}
                onChange={(e) => setDimensionScore(parseInt(e.target.value) || 0)}
                className="w-full rounded-brand bg-background px-3 py-2 text-base text-text-primary outline-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowEditDimension(null)}
                className="min-h-[44px] flex-1 rounded-brand bg-background text-text-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveDimension}
                className="min-h-[44px] flex-1 rounded-brand bg-primary font-bold text-background"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Specialist Modal */}
      {showSpecialistModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          onClick={() => setShowSpecialistModal(false)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-md flex-col rounded-t-brand bg-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 pb-4">
              <div className="text-lg font-bold text-text-primary">
                {editingSpecialistIndex !== null ? specialistForm.name : 'Add Specialist'}
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-6">
              {editingSpecialistIndex === null && (
                <div>
                  <label className="mb-1 block text-sm text-text-secondary">Name</label>
                  <input
                    type="text"
                    value={specialistForm.name}
                    onChange={(e) => setSpecialistForm({ ...specialistForm, name: e.target.value })}
                    className="w-full rounded-brand bg-background px-3 py-2 text-base text-text-primary outline-none"
                    placeholder="e.g. GP, Physio"
                  />
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm text-text-secondary">Status</label>
                <select
                  value={specialistForm.status}
                  onChange={(e) => setSpecialistForm({ ...specialistForm, status: e.target.value as SpecialistAction['status'] })}
                  className="w-full rounded-brand bg-background px-3 py-2 text-base text-text-primary outline-none"
                >
                  <option value="pending">Pending</option>
                  <option value="booked">Booked</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-text-secondary">Due Date</label>
                <input
                  type="date"
                  value={specialistForm.dueDate || ''}
                  onChange={(e) => setSpecialistForm({ ...specialistForm, dueDate: e.target.value || null })}
                  className="w-full rounded-brand bg-background px-3 py-2 text-base text-text-primary outline-none"
                />
              </div>
              {specialistForm.status === 'booked' && (
                <div>
                  <label className="mb-1 block text-sm text-text-secondary">Booked Date</label>
                  <input
                    type="date"
                    value={specialistForm.bookedDate || ''}
                    onChange={(e) => setSpecialistForm({ ...specialistForm, bookedDate: e.target.value || null })}
                    className="w-full rounded-brand bg-background px-3 py-2 text-base text-text-primary outline-none"
                  />
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm text-text-secondary">Outcome notes</label>
                <textarea
                  value={specialistForm.outcome}
                  onChange={(e) => setSpecialistForm({ ...specialistForm, outcome: e.target.value })}
                  rows={3}
                  className="w-full rounded-brand bg-background px-3 py-2 text-base text-text-primary outline-none"
                />
              </div>
            </div>

            <div className="border-t border-text-secondary/20 p-6 pt-4">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowSpecialistModal(false)}
                  className="min-h-[44px] flex-1 rounded-brand bg-background text-text-primary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveSpecialist}
                  className="min-h-[44px] flex-1 rounded-brand bg-primary font-bold text-background"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Benchmark Modal */}
      {showEditBenchmark && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          onClick={() => setShowEditBenchmark(null)}
        >
          <div
            className="w-full max-w-md rounded-t-brand bg-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 text-lg font-bold text-text-primary">
              Edit {showEditBenchmark.type === 'fit40' ? 'Fit 40' : 'Elite 40'} Benchmark
            </div>
            <div className="mb-4">
              <label className="mb-2 block text-sm text-text-secondary">
                {showEditBenchmark.field.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase()).trim()}
              </label>
              <input
                type="number"
                value={benchmarkValue}
                onChange={(e) => setBenchmarkValue(parseFloat(e.target.value) || 0)}
                className="w-full rounded-brand bg-background px-3 py-2 text-base text-text-primary outline-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowEditBenchmark(null)}
                className="min-h-[44px] flex-1 rounded-brand bg-background text-text-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveBenchmark}
                className="min-h-[44px] flex-1 rounded-brand bg-primary font-bold text-background"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
