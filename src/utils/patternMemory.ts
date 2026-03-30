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
    .map((p) => `Week of ${p.weekStart}:\n${p.summary}`)
    .join('\n\n');
}
