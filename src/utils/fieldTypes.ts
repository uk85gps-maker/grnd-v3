export interface FieldAction {
  id: string;
  name: string;
  layer: 3 | 4 | 5 | 7;
  fearOrPattern: string;
  successDefinition: string;
  difficultyRating: 1 | 2 | 3 | 4 | 5;
  createdAt: string;
  isArchived: boolean;
}

export interface FieldOutcome {
  id: string;
  actionId: string;
  date: string;
  actionTaken: string;
  context: string;
  outcome: string;
  confidenceRating: 1 | 2 | 3 | 4 | 5;
  patternObserved: 'old' | 'new' | 'mixed';
  notes?: string;
  loggedAt: string;
}
