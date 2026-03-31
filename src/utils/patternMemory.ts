export interface PatternEntry {
  weekStart: string;
  summary: string;
  createdAt: string;
  avgCalories: number | null;
  avgProtein: number | null;
  gymSessionCount: number | null;
  avgSleepHours: number | null;
  complianceScore: number | null;
  bodyWeight: number | null;
}

const STORAGE_KEY = 'grnd_pattern_memory';

export function getPatternMemory(): PatternEntry[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];

  try {
    return JSON.parse(stored) as PatternEntry[];
  } catch {
    return [];
  }
}

export function savePatternMemory(patterns: PatternEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(patterns));
}

export function addPatternEntry(
  weekStart: string,
  summary: string,
  metrics: {
    avgCalories: number | null;
    avgProtein: number | null;
    gymSessionCount: number | null;
    avgSleepHours: number | null;
    complianceScore: number | null;
    bodyWeight: number | null;
  }
): void {
  const patterns = getPatternMemory();
  const entry: PatternEntry = {
    weekStart,
    summary,
    createdAt: new Date().toISOString(),
    ...metrics,
  };
  const existingIndex = patterns.findIndex((p) => p.weekStart === weekStart);
  if (existingIndex !== -1) {
    patterns[existingIndex] = entry;
  } else {
    patterns.push(entry);
  }
  savePatternMemory(patterns);
}

export function formatPatternMemoryForPrompt(): string {
  const patterns = getPatternMemory();
  if (patterns.length === 0) return 'No pattern history yet.';

  return patterns
    .map((p) => {
      const lines = [`Week of ${p.weekStart}:`];
      if (p.avgCalories != null) lines.push(`Avg calories: ${Math.round(p.avgCalories)}`);
      if (p.avgProtein != null) lines.push(`Avg protein: ${Math.round(p.avgProtein)}g`);
      if (p.gymSessionCount != null) lines.push(`Gym sessions: ${p.gymSessionCount}`);
      if (p.avgSleepHours != null) lines.push(`Avg sleep: ${p.avgSleepHours.toFixed(1)}h`);
      if (p.complianceScore != null) lines.push(`System health: ${Math.round(p.complianceScore)}`);
      if (p.bodyWeight != null) lines.push(`Weight: ${p.bodyWeight}kg`);
      lines.push(p.summary);
      return lines.join('\n');
    })
    .join('\n\n');
}
