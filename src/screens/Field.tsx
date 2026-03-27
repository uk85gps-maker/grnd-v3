import { useEffect, useState } from 'react';
import { FieldAction, FieldOutcome } from '@/utils/fieldTypes';

const STORAGE_KEY_ACTIONS = 'grnd_field_log_actions';
const STORAGE_KEY_OUTCOMES = 'grnd_field_log';

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-brand bg-card p-4">{children}</div>;
}

function RatingCircles({ rating, max = 5, onRate }: { rating: number; max?: number; onRate?: (r: number) => void }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: max }, (_, i) => i + 1).map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onRate?.(r)}
          disabled={!onRate}
          className={r <= rating ? 'h-6 w-6 rounded-full bg-primary' : 'h-6 w-6 rounded-full border border-text-secondary'}
        />
      ))}
    </div>
  );
}

function LayerBadge({ layer }: { layer: 3 | 4 | 5 | 7 }) {
  const config = {
    3: { label: 'Physical Product', color: 'bg-amber-500/20 text-amber-500 border-amber-500' },
    4: { label: 'Presence', color: 'bg-blue-500/20 text-blue-500 border-blue-500' },
    5: { label: 'Inner Game', color: 'bg-purple-500/20 text-purple-500 border-purple-500' },
    7: { label: 'Reputation', color: 'bg-green-500/20 text-green-500 border-green-500' },
  };
  const { label, color } = config[layer];
  return (
    <span className={`inline-block rounded-brand border px-2 py-1 text-xs font-semibold ${color}`}>
      L{layer} {label}
    </span>
  );
}

export default function Field() {
  const [actions, setActions] = useState<FieldAction[]>([]);
  const [outcomes, setOutcomes] = useState<FieldOutcome[]>([]);
  const [showActionModal, setShowActionModal] = useState(false);
  const [showOutcomeModal, setShowOutcomeModal] = useState(false);
  const [editingAction, setEditingAction] = useState<FieldAction | null>(null);
  const [loggingOutcomeFor, setLoggingOutcomeFor] = useState<FieldAction | null>(null);
  const [editingOutcome, setEditingOutcome] = useState<FieldOutcome | null>(null);
  const [expandedLayer, setExpandedLayer] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'action' | 'outcome'; id: string } | null>(null);

  const [actionForm, setActionForm] = useState({
    name: '',
    layer: 3 as 3 | 4 | 5 | 7,
    fearOrPattern: '',
    successDefinition: '',
    difficultyRating: 1 as 1 | 2 | 3 | 4 | 5,
  });

  const [outcomeForm, setOutcomeForm] = useState({
    date: new Date().toISOString().split('T')[0],
    actionTaken: '',
    context: '',
    outcome: '',
    confidenceRating: 1 as 1 | 2 | 3 | 4 | 5,
    patternObserved: 'mixed' as 'old' | 'new' | 'mixed',
    notes: '',
  });

  useEffect(() => {
    const storedActions = localStorage.getItem(STORAGE_KEY_ACTIONS);
    const storedOutcomes = localStorage.getItem(STORAGE_KEY_OUTCOMES);
    if (storedActions) {
      try {
        setActions(JSON.parse(storedActions));
      } catch {
        setActions([]);
      }
    }
    if (storedOutcomes) {
      try {
        setOutcomes(JSON.parse(storedOutcomes));
      } catch {
        setOutcomes([]);
      }
    }
  }, []);

  const saveActions = (newActions: FieldAction[]) => {
    setActions(newActions);
    localStorage.setItem(STORAGE_KEY_ACTIONS, JSON.stringify(newActions));
  };

  const saveOutcomes = (newOutcomes: FieldOutcome[]) => {
    setOutcomes(newOutcomes);
    localStorage.setItem(STORAGE_KEY_OUTCOMES, JSON.stringify(newOutcomes));
  };

  const openAddAction = () => {
    setEditingAction(null);
    setActionForm({
      name: '',
      layer: 3,
      fearOrPattern: '',
      successDefinition: '',
      difficultyRating: 1,
    });
    setShowActionModal(true);
  };

  const openEditAction = (action: FieldAction) => {
    setEditingAction(action);
    setActionForm({
      name: action.name,
      layer: action.layer,
      fearOrPattern: action.fearOrPattern,
      successDefinition: action.successDefinition,
      difficultyRating: action.difficultyRating,
    });
    setShowActionModal(true);
  };

  const saveAction = () => {
    if (!actionForm.name || !actionForm.fearOrPattern || !actionForm.successDefinition) return;

    if (editingAction) {
      const updated = actions.map((a) =>
        a.id === editingAction.id
          ? { ...a, ...actionForm }
          : a
      );
      saveActions(updated);
    } else {
      const newAction: FieldAction = {
        id: crypto.randomUUID(),
        ...actionForm,
        createdAt: new Date().toISOString(),
        isArchived: false,
      };
      saveActions([...actions, newAction]);
    }
    setShowActionModal(false);
  };

  const archiveAction = (id: string) => {
    const updated = actions.map((a) => (a.id === id ? { ...a, isArchived: true } : a));
    saveActions(updated);
    setDeleteConfirm(null);
  };

  const deleteAction = (id: string) => {
    const hasOutcomes = outcomes.some((o) => o.actionId === id);
    if (hasOutcomes) {
      archiveAction(id);
    } else {
      saveActions(actions.filter((a) => a.id !== id));
    }
    setDeleteConfirm(null);
  };

  const openLogOutcome = (action: FieldAction) => {
    setLoggingOutcomeFor(action);
    setEditingOutcome(null);
    setOutcomeForm({
      date: new Date().toISOString().split('T')[0],
      actionTaken: '',
      context: '',
      outcome: '',
      confidenceRating: 1,
      patternObserved: 'mixed',
      notes: '',
    });
    setShowOutcomeModal(true);
  };

  const openEditOutcome = (outcome: FieldOutcome) => {
    const action = actions.find((a) => a.id === outcome.actionId);
    if (!action) return;
    setLoggingOutcomeFor(action);
    setEditingOutcome(outcome);
    setOutcomeForm({
      date: outcome.date,
      actionTaken: outcome.actionTaken,
      context: outcome.context,
      outcome: outcome.outcome,
      confidenceRating: outcome.confidenceRating,
      patternObserved: outcome.patternObserved,
      notes: outcome.notes || '',
    });
    setShowOutcomeModal(true);
  };

  const saveOutcome = () => {
    if (!loggingOutcomeFor || !outcomeForm.actionTaken || !outcomeForm.context || !outcomeForm.outcome) return;

    if (editingOutcome) {
      const updated = outcomes.map((o) =>
        o.id === editingOutcome.id
          ? { ...o, ...outcomeForm }
          : o
      );
      saveOutcomes(updated);
    } else {
      const newOutcome: FieldOutcome = {
        id: crypto.randomUUID(),
        actionId: loggingOutcomeFor.id,
        ...outcomeForm,
        loggedAt: new Date().toISOString(),
      };
      saveOutcomes([...outcomes, newOutcome]);
    }
    setShowOutcomeModal(false);
  };

  const deleteOutcome = (id: string) => {
    saveOutcomes(outcomes.filter((o) => o.id !== id));
    setDeleteConfirm(null);
  };

  const copyOutcomeToClipboard = (outcome: FieldOutcome) => {
    const action = actions.find((a) => a.id === outcome.actionId);
    if (!action) return;

    const text = `DATE: ${outcome.date}
SITUATION: ${outcome.context}
ACTION: ${outcome.actionTaken}
OUTCOME: ${outcome.outcome}
PATTERN: ${outcome.patternObserved}
CONFIDENCE: ${outcome.confidenceRating}/5
LAYER: ${action.layer}`;

    navigator.clipboard.writeText(text);
  };

  const activeActions = actions.filter((a) => !a.isArchived);
  const outcomesByLayer = [3, 4, 5, 7].map((layer) => ({
    layer: layer as 3 | 4 | 5 | 7,
    outcomes: outcomes.filter((o) => {
      const action = actions.find((a) => a.id === o.actionId);
      return action?.layer === layer;
    }),
  }));

  const sortedOutcomes = [...outcomes].sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime());

  const actionFormValid = actionForm.name && actionForm.fearOrPattern && actionForm.successDefinition;
  const outcomeFormValid = outcomeForm.actionTaken && outcomeForm.context && outcomeForm.outcome;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-10 bg-background px-4 py-4">
        <h1 className="text-2xl font-bold text-text-primary">Field</h1>
        <p className="text-sm text-text-secondary">Mission log & evidence case file</p>
      </div>

      <div className="space-y-6 px-4">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-text-primary">Active Missions</h2>
            <button
              type="button"
              onClick={openAddAction}
              className="min-h-[44px] rounded-brand bg-primary px-4 text-sm font-semibold text-white"
            >
              + Add Mission
            </button>
          </div>

          {activeActions.length === 0 ? (
            <Card>
              <div className="py-8 text-center">
                <div className="text-base font-semibold text-text-primary">No missions yet. Add your first one.</div>
                <div className="mt-2 text-sm text-text-secondary">
                  A mission is one real-world action that pushes against a pattern. Start with something uncomfortable but achievable.
                </div>
                <button
                  type="button"
                  onClick={openAddAction}
                  className="mt-4 min-h-[44px] rounded-brand border border-primary px-6 text-primary"
                >
                  + Add Mission
                </button>
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              {activeActions.map((action) => (
                <Card key={action.id}>
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="font-semibold text-text-primary">{action.name}</div>
                        <div className="mt-1">
                          <LayerBadge layer={action.layer} />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => openEditAction(action)}
                        className="min-h-[44px] px-2 text-text-secondary"
                      >
                        ⋯
                      </button>
                    </div>
                    <div className="text-sm text-text-secondary">
                      <div>
                        <span className="font-semibold">Targets:</span> {action.fearOrPattern}
                      </div>
                      <div className="mt-1">
                        <span className="font-semibold">Success:</span> {action.successDefinition}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-text-secondary">
                        <div>Difficulty</div>
                        <div className="mt-1">
                          <RatingCircles rating={action.difficultyRating} />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => openLogOutcome(action)}
                        className="min-h-[44px] rounded-brand bg-primary px-4 text-sm font-semibold text-white"
                      >
                        Log Outcome
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="mb-3 text-lg font-bold text-text-primary">Evidence Case File</h2>
          {outcomes.length === 0 ? (
            <Card>
              <div className="py-8 text-center">
                <div className="text-base font-semibold text-text-primary">Nothing logged yet. Complete a mission and come back.</div>
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              {outcomesByLayer.map(({ layer, outcomes: layerOutcomes }) => {
                if (layerOutcomes.length === 0) return null;
                const isExpanded = expandedLayer === layer;
                return (
                  <Card key={layer}>
                    <button
                      type="button"
                      onClick={() => setExpandedLayer(isExpanded ? null : layer)}
                      className="w-full text-left"
                    >
                      <div className="flex items-center justify-between">
                        <LayerBadge layer={layer} />
                        <div className="text-sm text-text-secondary">{layerOutcomes.length} logged</div>
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="mt-3 space-y-2">
                        {layerOutcomes.map((outcome) => {
                          const action = actions.find((a) => a.id === outcome.actionId);
                          if (!action) return null;
                          return (
                            <div key={outcome.id} className="rounded-brand bg-background p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1">
                                  <div className="text-sm font-semibold text-text-primary">{action.name}</div>
                                  <div className="mt-1 text-xs text-text-secondary">{outcome.date}</div>
                                  <div className="mt-2 text-sm text-text-primary">
                                    <div>
                                      <span className="font-semibold">Action:</span> {outcome.actionTaken}
                                    </div>
                                    <div className="mt-1">
                                      <span className="font-semibold">Outcome:</span> {outcome.outcome}
                                    </div>
                                    <div className="mt-1">
                                      <span className="font-semibold">Pattern:</span> {outcome.patternObserved}
                                    </div>
                                  </div>
                                  <div className="mt-2 text-xs text-text-secondary">
                                    Confidence: {outcome.confidenceRating}/5
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => copyOutcomeToClipboard(outcome)}
                                  className="min-h-[44px] px-2 text-primary"
                                  title="Copy to clipboard"
                                >
                                  📋
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <h2 className="mb-3 text-lg font-bold text-text-primary">Mission History</h2>
          {sortedOutcomes.length === 0 ? (
            <Card>
              <div className="py-8 text-center">
                <div className="text-base font-semibold text-text-primary">No history yet.</div>
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              {sortedOutcomes.map((outcome) => {
                const action = actions.find((a) => a.id === outcome.actionId);
                if (!action) return null;
                return (
                  <Card key={outcome.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-semibold text-text-primary">{action.name}</div>
                          <LayerBadge layer={action.layer} />
                        </div>
                        <div className="mt-1 text-xs text-text-secondary">{outcome.date}</div>
                        <div className="mt-2 text-sm text-text-primary">
                          <div>
                            <span className="font-semibold">Action:</span> {outcome.actionTaken}
                          </div>
                          <div className="mt-1">
                            <span className="font-semibold">Context:</span> {outcome.context}
                          </div>
                          <div className="mt-1">
                            <span className="font-semibold">Outcome:</span> {outcome.outcome}
                          </div>
                          <div className="mt-1">
                            <span className="font-semibold">Pattern:</span> {outcome.patternObserved}
                          </div>
                          {outcome.notes && (
                            <div className="mt-1">
                              <span className="font-semibold">Notes:</span> {outcome.notes}
                            </div>
                          )}
                        </div>
                        <div className="mt-2 text-xs text-text-secondary">Confidence: {outcome.confidenceRating}/5</div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => copyOutcomeToClipboard(outcome)}
                          className="min-h-[44px] px-2 text-primary"
                          title="Copy to clipboard"
                        >
                          📋
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditOutcome(outcome)}
                          className="min-h-[44px] px-2 text-text-secondary"
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm({ type: 'outcome', id: outcome.id })}
                          className="min-h-[44px] px-2 text-red-500"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showActionModal && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50">
          <div className="max-h-[80vh] w-full overflow-y-auto rounded-t-brand bg-card">
            <div className="sticky top-0 bg-card px-4 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-text-primary">{editingAction ? 'Edit Mission' : 'Add Mission'}</h3>
                <button type="button" onClick={() => setShowActionModal(false)} className="min-h-[44px] px-2 text-text-secondary">
                  ✕
                </button>
              </div>
            </div>

            <div className="space-y-4 px-4 pb-4">
              <div>
                <label className="block text-sm font-semibold text-text-primary">Action Name</label>
                <input
                  type="text"
                  value={actionForm.name}
                  onChange={(e) => setActionForm({ ...actionForm, name: e.target.value })}
                  className="mt-1 w-full rounded-brand border border-text-secondary bg-background px-3 py-2 text-text-primary"
                  placeholder="e.g., Ask a question in the meeting"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-text-primary">Layer</label>
                <div className="mt-2 space-y-2">
                  {([3, 4, 5, 7] as const).map((layer) => (
                    <button
                      key={layer}
                      type="button"
                      onClick={() => setActionForm({ ...actionForm, layer })}
                      className={`w-full rounded-brand border px-3 py-2 text-left ${
                        actionForm.layer === layer ? 'border-primary bg-primary/10' : 'border-text-secondary'
                      }`}
                    >
                      <LayerBadge layer={layer} />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-text-primary">Fear or Pattern Being Targeted</label>
                <textarea
                  value={actionForm.fearOrPattern}
                  onChange={(e) => setActionForm({ ...actionForm, fearOrPattern: e.target.value })}
                  className="mt-1 w-full rounded-brand border border-text-secondary bg-background px-3 py-2 text-text-primary"
                  rows={3}
                  placeholder="e.g., Fear of being judged as incompetent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-text-primary">Success Definition</label>
                <textarea
                  value={actionForm.successDefinition}
                  onChange={(e) => setActionForm({ ...actionForm, successDefinition: e.target.value })}
                  className="mt-1 w-full rounded-brand border border-text-secondary bg-background px-3 py-2 text-text-primary"
                  rows={3}
                  placeholder="e.g., I asked the question without pre-apologizing"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-text-primary">Difficulty Rating</label>
                <div className="mt-2">
                  <RatingCircles
                    rating={actionForm.difficultyRating}
                    onRate={(r) => setActionForm({ ...actionForm, difficultyRating: r as 1 | 2 | 3 | 4 | 5 })}
                  />
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 flex gap-3 bg-card px-4 py-4">
              {editingAction && (
                <button
                  type="button"
                  onClick={() => setDeleteConfirm({ type: 'action', id: editingAction.id })}
                  className="min-h-[44px] flex-1 rounded-brand border border-red-500 text-red-500"
                >
                  {outcomes.some((o) => o.actionId === editingAction.id) ? 'Archive' : 'Delete'}
                </button>
              )}
              <button
                type="button"
                onClick={saveAction}
                disabled={!actionFormValid}
                className="min-h-[44px] flex-1 rounded-brand bg-primary text-white disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showOutcomeModal && loggingOutcomeFor && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50">
          <div className="max-h-[80vh] w-full overflow-y-auto rounded-t-brand bg-card">
            <div className="sticky top-0 bg-card px-4 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-text-primary">
                  {editingOutcome ? 'Edit Outcome' : 'Log Outcome'}
                </h3>
                <button type="button" onClick={() => setShowOutcomeModal(false)} className="min-h-[44px] px-2 text-text-secondary">
                  ✕
                </button>
              </div>
              <div className="mt-1 text-sm text-text-secondary">{loggingOutcomeFor.name}</div>
            </div>

            <div className="space-y-4 px-4 pb-4">
              <div>
                <label className="block text-sm font-semibold text-text-primary">Date</label>
                <input
                  type="date"
                  value={outcomeForm.date}
                  onChange={(e) => setOutcomeForm({ ...outcomeForm, date: e.target.value })}
                  className="mt-1 w-full rounded-brand border border-text-secondary bg-background px-3 py-2 text-text-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-text-primary">What Action Did You Take?</label>
                <textarea
                  value={outcomeForm.actionTaken}
                  onChange={(e) => setOutcomeForm({ ...outcomeForm, actionTaken: e.target.value })}
                  className="mt-1 w-full rounded-brand border border-text-secondary bg-background px-3 py-2 text-text-primary"
                  rows={3}
                  placeholder="Describe what you actually did"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-text-primary">Context</label>
                <textarea
                  value={outcomeForm.context}
                  onChange={(e) => setOutcomeForm({ ...outcomeForm, context: e.target.value })}
                  className="mt-1 w-full rounded-brand border border-text-secondary bg-background px-3 py-2 text-text-primary"
                  rows={3}
                  placeholder="Where, who was present, what was the situation"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-text-primary">Outcome</label>
                <textarea
                  value={outcomeForm.outcome}
                  onChange={(e) => setOutcomeForm({ ...outcomeForm, outcome: e.target.value })}
                  className="mt-1 w-full rounded-brand border border-text-secondary bg-background px-3 py-2 text-text-primary"
                  rows={3}
                  placeholder="What was the result"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-text-primary">Confidence Rating</label>
                <div className="mt-2">
                  <RatingCircles
                    rating={outcomeForm.confidenceRating}
                    onRate={(r) => setOutcomeForm({ ...outcomeForm, confidenceRating: r as 1 | 2 | 3 | 4 | 5 })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-text-primary">Pattern Observed</label>
                <div className="mt-2 flex gap-2">
                  {(['old', 'mixed', 'new'] as const).map((pattern) => (
                    <button
                      key={pattern}
                      type="button"
                      onClick={() => setOutcomeForm({ ...outcomeForm, patternObserved: pattern })}
                      className={`flex-1 rounded-brand border px-3 py-2 text-sm ${
                        outcomeForm.patternObserved === pattern
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-text-secondary text-text-secondary'
                      }`}
                    >
                      {pattern === 'old' ? 'Old pattern' : pattern === 'new' ? 'New pattern' : 'Mixed'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-text-primary">Notes (Optional)</label>
                <textarea
                  value={outcomeForm.notes}
                  onChange={(e) => setOutcomeForm({ ...outcomeForm, notes: e.target.value })}
                  className="mt-1 w-full rounded-brand border border-text-secondary bg-background px-3 py-2 text-text-primary"
                  rows={2}
                  placeholder="Any additional observations"
                />
              </div>
            </div>

            <div className="sticky bottom-0 flex gap-3 bg-card px-4 py-4">
              <button
                type="button"
                onClick={saveOutcome}
                disabled={!outcomeFormValid}
                className="min-h-[44px] flex-1 rounded-brand bg-primary text-white disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-brand bg-card p-4">
            <div className="text-base font-semibold text-text-primary">
              {deleteConfirm.type === 'action' ? 'Delete or Archive?' : 'Delete Outcome?'}
            </div>
            <div className="mt-2 text-sm text-text-secondary">
              {deleteConfirm.type === 'action'
                ? outcomes.some((o) => o.actionId === deleteConfirm.id)
                  ? 'This action has logged outcomes. It will be archived, not deleted.'
                  : 'This action has no logged outcomes and will be permanently deleted.'
                : 'This outcome will be permanently deleted.'}
            </div>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="min-h-[44px] flex-1 rounded-brand border border-text-secondary text-text-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (deleteConfirm.type === 'action') {
                    deleteAction(deleteConfirm.id);
                  } else {
                    deleteOutcome(deleteConfirm.id);
                  }
                }}
                className="min-h-[44px] flex-1 rounded-brand bg-red-500 text-white"
              >
                {deleteConfirm.type === 'action' && outcomes.some((o) => o.actionId === deleteConfirm.id)
                  ? 'Archive'
                  : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
