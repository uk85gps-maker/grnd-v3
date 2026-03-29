import { useState, useEffect, useRef } from 'react';
import { getCoachModes, toggleMode, updateMode, deleteMode, addMode, CoachMode } from '@/utils/coachModes';
import { getPortraitMemory, savePortraitMemory, PortraitMemory } from '@/utils/portraitMemory';
import { getConversationHistory, addMessage, clearConversationHistory, formatMessagesForAPI, Message } from '@/utils/conversationHistory';
import { sendMessageToCoach } from '@/utils/coachAPI';

export default function Coach() {
  const [modes, setModes] = useState<CoachMode[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPortrait, setShowPortrait] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showModeEdit, setShowModeEdit] = useState<CoachMode | null>(null);
  const [showNewMode, setShowNewMode] = useState(false);
  const [editingPortraitField, setEditingPortraitField] = useState<keyof PortraitMemory | null>(null);
  const [portrait, setPortrait] = useState<PortraitMemory>(getPortraitMemory());
  const [editModeForm, setEditModeForm] = useState({
    name: '',
    emoji: '',
    purpose: '',
    situations: '',
    desiredOutcome: '',
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setModes(getCoachModes());
    setMessages(getConversationHistory());
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    setError(null);

    // Add user message to UI immediately
    const newUserMessage: Message = {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, newUserMessage]);
    addMessage('user', userMessage);

    setIsLoading(true);

    try {
      const conversationForAPI = formatMessagesForAPI();
      const response = await sendMessageToCoach(userMessage, conversationForAPI);

      // Add assistant response
      const assistantMessage: Message = {
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      addMessage('assistant', response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get response from Coach');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleToggleMode = (modeId: string) => {
    toggleMode(modeId);
    setModes(getCoachModes());
  };

  const handleClearConversation = () => {
    clearConversationHistory();
    setMessages([]);
    setShowClearConfirm(false);
  };

  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  const handleEditMode = (mode: CoachMode) => {
    setShowModeEdit(mode);
    setEditModeForm({
      name: mode.name,
      emoji: mode.emoji,
      purpose: mode.purpose,
      situations: mode.situations,
      desiredOutcome: mode.desiredOutcome,
    });
  };

  const handleSaveMode = () => {
    if (!showModeEdit) return;
    if (!editModeForm.name || !editModeForm.emoji || !editModeForm.purpose || !editModeForm.situations || !editModeForm.desiredOutcome) {
      return;
    }

    updateMode(showModeEdit.id, editModeForm);
    setModes(getCoachModes());
    setShowModeEdit(null);
  };

  const handleDeleteMode = () => {
    if (!showModeEdit) return;
    deleteMode(showModeEdit.id);
    setModes(getCoachModes());
    setShowModeEdit(null);
  };

  const handleAddNewMode = () => {
    if (!editModeForm.name || !editModeForm.emoji || !editModeForm.purpose || !editModeForm.situations || !editModeForm.desiredOutcome) {
      return;
    }

    addMode(editModeForm);
    setModes(getCoachModes());
    setShowNewMode(false);
    setEditModeForm({
      name: '',
      emoji: '',
      purpose: '',
      situations: '',
      desiredOutcome: '',
    });
  };

  const handleUpdatePortraitField = (field: keyof PortraitMemory, value: string | number) => {
    const updated = { ...portrait, [field]: value };
    setPortrait(updated);
    savePortraitMemory(updated);
    setEditingPortraitField(null);
  };

  return (
    <div className="flex flex-1 flex-col pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-lg font-bold tracking-wide text-primary">COACH</div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            className="text-text-secondary"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setShowPortrait(true)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-background"
          >
            <span className="text-base font-bold">{portrait.name.charAt(0)}</span>
          </button>
        </div>
      </div>

      {/* Mode Selector */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
        {modes.map((mode) => (
          <button
            key={mode.id}
            type="button"
            onClick={() => handleToggleMode(mode.id)}
            className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-base ${
              mode.active
                ? 'border-2 border-primary bg-primary/20 text-primary'
                : 'border border-text-secondary bg-card text-text-primary'
            }`}
          >
            <span>{mode.emoji}</span>
            <span>{mode.name}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleEditMode(mode);
              }}
              className="ml-1 text-text-secondary hover:text-text-primary"
            >
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setShowNewMode(true);
            setEditModeForm({
              name: '',
              emoji: '',
              purpose: '',
              situations: '',
              desiredOutcome: '',
            });
          }}
          className="flex shrink-0 items-center justify-center rounded-full border border-primary bg-card px-4 py-2 text-primary"
        >
          <span className="text-lg">+</span>
        </button>
      </div>

      {/* Conversation Area */}
      <div className="mt-4 flex-1 space-y-3 overflow-y-auto">
        {messages.length === 0 && !isLoading && (
          <div className="flex h-full items-center justify-center text-text-secondary">
            What's on your mind?
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`relative max-w-[80%] rounded-2xl p-3 ${
                msg.role === 'user'
                  ? 'bg-[#d4af37] text-black font-medium'
                  : 'bg-[#141414] border border-[#2a2a2a] text-white'
              }`}
            >
              <div className="whitespace-pre-wrap text-base">{msg.content}</div>
              {msg.role === 'assistant' && (
                <button
                  type="button"
                  onClick={() => handleCopyMessage(msg.content)}
                  className="absolute bottom-2 right-2 text-zinc-400 hover:text-[#d4af37]"
                >
                  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="rounded-brand bg-card p-3">
              <div className="flex gap-1">
                <div className="h-2 w-2 animate-bounce rounded-full bg-text-secondary" style={{ animationDelay: '0ms' }} />
                <div className="h-2 w-2 animate-bounce rounded-full bg-text-secondary" style={{ animationDelay: '150ms' }} />
                <div className="h-2 w-2 animate-bounce rounded-full bg-text-secondary" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-brand bg-red-500/20 p-3 text-base text-red-500">
            {error}
            <button
              type="button"
              onClick={() => setError(null)}
              className="ml-2 underline"
            >
              Dismiss
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="mt-4 flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask Coach anything"
          className="flex-1 rounded-2xl border border-[#2a2a2a] bg-[#1e1e1e] px-4 py-3 text-white outline-none focus:border-[#d4af37]"
        />
        <button
          type="button"
          onClick={handleSendMessage}
          disabled={!inputValue.trim() || isLoading}
          className="flex h-12 w-12 items-center justify-center rounded-brand bg-primary text-background disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
          </svg>
        </button>
      </div>

      {/* Clear Conversation Confirmation */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowClearConfirm(false)}>
          <div className="w-full max-w-sm rounded-brand bg-card p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 text-lg font-bold text-text-primary">Clear conversation history?</div>
            <div className="mb-6 text-base text-text-secondary">This cannot be undone.</div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 rounded-brand border border-text-secondary py-2 text-text-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearConversation}
                className="flex-1 rounded-brand bg-red-500 py-2 text-white"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Portrait Memory Sheet */}
      {showPortrait && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setShowPortrait(false)}>
          <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-t-brand bg-card p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div className="text-lg font-bold text-text-primary">Your Portrait</div>
              <button
                type="button"
                onClick={() => setShowPortrait(false)}
                className="text-text-secondary"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {Object.entries(portrait).map(([key, value]) => (
                <div key={key}>
                  <div className="mb-1 text-sm font-semibold uppercase tracking-wide text-text-secondary">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </div>
                  {editingPortraitField === key ? (
                    <input
                      type={key === 'age' ? 'number' : 'text'}
                      value={value}
                      onChange={(e) => handleUpdatePortraitField(key as keyof PortraitMemory, key === 'age' ? Number(e.target.value) : e.target.value)}
                      onBlur={() => setEditingPortraitField(null)}
                      autoFocus
                      className="w-full rounded-brand border border-primary bg-background px-3 py-2 text-base text-text-primary outline-none"
                    />
                  ) : (
                    <div
                      onClick={() => setEditingPortraitField(key as keyof PortraitMemory)}
                      className="cursor-pointer rounded-brand bg-background px-3 py-2 text-base text-text-primary hover:border hover:border-text-secondary"
                    >
                      {value || 'Tap to edit'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Mode Edit Sheet */}
      {(showModeEdit || showNewMode) && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => { setShowModeEdit(null); setShowNewMode(false); }}>
          <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-t-brand bg-card p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div className="text-lg font-bold text-text-primary">{showNewMode ? 'New Mode' : 'Edit Mode'}</div>
              <button
                type="button"
                onClick={() => { setShowModeEdit(null); setShowNewMode(false); }}
                className="text-text-secondary"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-semibold uppercase tracking-wide text-text-secondary">Emoji</label>
                <input
                  type="text"
                  value={editModeForm.emoji}
                  onChange={(e) => setEditModeForm({ ...editModeForm, emoji: e.target.value })}
                  className="w-full rounded-brand border border-text-secondary bg-background px-3 py-2 text-text-primary outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold uppercase tracking-wide text-text-secondary">Name</label>
                <input
                  type="text"
                  value={editModeForm.name}
                  onChange={(e) => setEditModeForm({ ...editModeForm, name: e.target.value })}
                  className="w-full rounded-brand border border-text-secondary bg-background px-3 py-2 text-text-primary outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold uppercase tracking-wide text-text-secondary">Purpose</label>
                <textarea
                  value={editModeForm.purpose}
                  onChange={(e) => setEditModeForm({ ...editModeForm, purpose: e.target.value })}
                  rows={3}
                  className="w-full rounded-brand border border-text-secondary bg-background px-3 py-2 text-text-primary outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold uppercase tracking-wide text-text-secondary">Situations it's for</label>
                <textarea
                  value={editModeForm.situations}
                  onChange={(e) => setEditModeForm({ ...editModeForm, situations: e.target.value })}
                  rows={3}
                  className="w-full rounded-brand border border-text-secondary bg-background px-3 py-2 text-text-primary outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold uppercase tracking-wide text-text-secondary">Desired Outcome</label>
                <textarea
                  value={editModeForm.desiredOutcome}
                  onChange={(e) => setEditModeForm({ ...editModeForm, desiredOutcome: e.target.value })}
                  rows={3}
                  className="w-full rounded-brand border border-text-secondary bg-background px-3 py-2 text-text-primary outline-none focus:border-primary"
                />
              </div>

              <button
                type="button"
                onClick={showNewMode ? handleAddNewMode : handleSaveMode}
                disabled={!editModeForm.name || !editModeForm.emoji || !editModeForm.purpose || !editModeForm.situations || !editModeForm.desiredOutcome}
                className="w-full rounded-brand bg-primary py-3 font-bold text-background disabled:opacity-50"
              >
                Save
              </button>

              {showModeEdit && (
                <button
                  type="button"
                  onClick={handleDeleteMode}
                  className="w-full rounded-brand border border-red-500 py-3 font-bold text-red-500"
                >
                  Delete Mode
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
