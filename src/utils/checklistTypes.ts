export interface ChecklistItem {
  id: string;
  name: string;
  time: string;
  layer: string;
  purpose: string;
  consequence: string;
  completed?: boolean;
  type?: 'daily' | 'weekly';
}

export interface ChecklistSection {
  id: string;
  emoji: string;
  name: string;
  items: ChecklistItem[];
}

export interface DailyCompletion {
  completedIds: string[];
}
