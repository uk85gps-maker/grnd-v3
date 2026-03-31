import { useState, useEffect, useRef } from 'react';
import { getCoachModes, toggleMode, updateMode, deleteMode, addMode, CoachMode } from '@/utils/coachModes';
import { getPortraitMemory, savePortraitMemory, PortraitMemory } from '@/utils/portraitMemory';
import { getConversationHistory, addMessage, clearConversationHistory, formatMessagesForAPI, Message } from '@/utils/conversationHistory';
import { sendMessageToCoach } from '@/utils/coachAPI';
import { LearnMaterial } from '@/utils/learnTypes';
import { supabase } from '@/integrations/supabase/client';

const LEARN_STORAGE_KEY = 'grnd_learn_materials';
const LEARN_BUCKET = 'grnd-learn-materials';
const LEARN_MAX_FILE_SIZE = 10 * 1024 * 1024;

const LEARN_SUPPORTED_TYPES: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/jpeg': 'Image',
  'image/jpg': 'Image',
  'image/png': 'Image',
  'image/webp': 'Image',
  'audio/m4a': 'Audio',
  'audio/mp3': 'Audio',
  'audio/mpeg': 'Audio',
  'audio/wav': 'Audio',
  'text/plain': 'Text',
};

function LearnCard({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-[#2a2a2a] bg-[#141414] p-4">{children}</div>;
}

function LayerBadge({ layer }: { layer: 2 | 3 | 4 | 5 | 6 | 7 }) {
  const config: Record<number, { label: string; color: string }> = {
    2: { label: 'Foundation', color: 'bg-gray-500/20 text-gray-500 border-gray-500' },
    3: { label: 'Physical Product', color: 'bg-amber-500/20 text-amber-500 border-amber-500' },
    4: { label: 'Presence', color: 'bg-blue-500/20 text-blue-500 border-blue-500' },
    5: { label: 'Inner Game', color: 'bg-purple-500/20 text-purple-500 border-purple-500' },
    6: { label: 'Income', color: 'bg-emerald-500/20 text-emerald-500 border-emerald-500' },
    7: { label: 'Reputation', color: 'bg-green-500/20 text-green-500 border-green-500' },
  };
  const { label, color } = config[layer];
  return (
    <span className={`inline-block rounded-brand border px-2 py-1 text-sm font-semibold ${color}`}>
      L{layer} {label}
    </span>
  );
}

function FileTypeIcon({ type }: { type: string }) {
  const displayType = LEARN_SUPPORTED_TYPES[type] || 'File';
  if (displayType === 'PDF') {
    return (
      <div className="flex h-12 w-12 items-center justify-center rounded-brand bg-red-500/20">
        <svg viewBox="0 0 24 24" className="h-6 w-6 text-red-500" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
        </svg>
      </div>
    );
  }
  if (displayType === 'Image') {
    return (
      <div className="flex h-12 w-12 items-center justify-center rounded-brand bg-blue-500/20">
        <svg viewBox="0 0 24 24" className="h-6 w-6 text-blue-500" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
      </div>
    );
  }
  if (displayType === 'Audio') {
    return (
      <div className="flex h-12 w-12 items-center justify-center rounded-brand bg-purple-500/20">
        <svg viewBox="0 0 24 24" className="h-6 w-6 text-purple-500" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      </div>
    );
  }
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-brand bg-gray-500/20">
      <svg viewBox="0 0 24 24" className="h-6 w-6 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
      </svg>
    </div>
  );
}

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
  const [modeToast, setModeToast] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Library state
  const [showLibrary, setShowLibrary] = useState(false);
  const [learnMaterials, setLearnMaterials] = useState<LearnMaterial[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<LearnMaterial | null>(null);
  const [editingMaterial, setEditingMaterial] = useState<LearnMaterial | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(false);
  const [learnError, setLearnError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadForm, setUploadForm] = useState({
    fileName: '',
    whyUploaded: '',
    whatYouWant: '',
    layerServed: 2 as 2 | 3 | 4 | 5 | 6 | 7,
    modesTagged: [] as string[],
  });

  useEffect(() => {
    setModes(getCoachModes());
    setMessages(getConversationHistory());
    // Load library materials
    const stored = localStorage.getItem(LEARN_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as LearnMaterial[];
        setLearnMaterials(parsed.filter((m) => !m.isArchived));
      } catch { /* empty */ }
    }
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
    const current = getCoachModes();
    const mode = current.find((m) => m.id === modeId);
    if (mode && !mode.active && current.filter((m) => m.active).length >= 2) {
      setModeToast(true);
      setTimeout(() => setModeToast(false), 2000);
      return;
    }
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

  // Library handlers
  const saveLearnMaterials = (newMaterials: LearnMaterial[]) => {
    setLearnMaterials(newMaterials.filter((m) => !m.isArchived));
    localStorage.setItem(LEARN_STORAGE_KEY, JSON.stringify(newMaterials));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > LEARN_MAX_FILE_SIZE) {
      setLearnError('File size exceeds 10MB limit. Please choose a smaller file.');
      return;
    }
    if (!LEARN_SUPPORTED_TYPES[file.type]) {
      setLearnError('Unsupported file type. Please upload PDF, image, audio, or text files.');
      return;
    }
    setSelectedFile(file);
    setUploadForm({ fileName: file.name, whyUploaded: '', whatYouWant: '', layerServed: 2, modesTagged: [] });
    setLearnError(null);
    setShowUploadModal(true);
  };

  const handleUpload = async () => {
    if (!selectedFile || !uploadForm.fileName || !uploadForm.whyUploaded || !uploadForm.whatYouWant) return;
    setUploadProgress(true);
    setLearnError(null);
    try {
      const storagePath = `user/${Date.now()}_${selectedFile.name}`;
      const { error: uploadError } = await supabase.storage.from(LEARN_BUCKET).upload(storagePath, selectedFile);
      if (uploadError) throw new Error(uploadError.message);
      const newMaterial: LearnMaterial = {
        id: crypto.randomUUID(),
        fileName: uploadForm.fileName,
        fileType: selectedFile.type,
        fileSize: selectedFile.size,
        storagePath,
        whyUploaded: uploadForm.whyUploaded,
        whatYouWant: uploadForm.whatYouWant,
        layerServed: uploadForm.layerServed,
        modesTagged: uploadForm.modesTagged,
        uploadedAt: new Date().toISOString(),
        isArchived: false,
      };
      const stored = localStorage.getItem(LEARN_STORAGE_KEY);
      const existing = stored ? JSON.parse(stored) : [];
      saveLearnMaterials([...existing, newMaterial]);
      setShowUploadModal(false);
      setSelectedFile(null);
      setUploadProgress(false);
    } catch (err) {
      setLearnError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
      setUploadProgress(false);
    }
  };

  const handleLearnEdit = () => {
    if (!editingMaterial || !uploadForm.fileName || !uploadForm.whyUploaded || !uploadForm.whatYouWant) return;
    const stored = localStorage.getItem(LEARN_STORAGE_KEY);
    const existing = stored ? JSON.parse(stored) : [];
    const updated = existing.map((m: LearnMaterial) =>
      m.id === editingMaterial.id
        ? { ...m, fileName: uploadForm.fileName, whyUploaded: uploadForm.whyUploaded, whatYouWant: uploadForm.whatYouWant, layerServed: uploadForm.layerServed, modesTagged: uploadForm.modesTagged }
        : m
    );
    saveLearnMaterials(updated);
    setShowUploadModal(false);
    setEditingMaterial(null);
  };

  const handleLearnDelete = async (id: string) => {
    const material = learnMaterials.find((m) => m.id === id);
    if (!material) return;
    try {
      await supabase.storage.from(LEARN_BUCKET).remove([material.storagePath]);
      const stored = localStorage.getItem(LEARN_STORAGE_KEY);
      const existing = stored ? JSON.parse(stored) : [];
      saveLearnMaterials(existing.filter((m: LearnMaterial) => m.id !== id));
      setDeleteConfirm(null);
      setShowDetailModal(false);
    } catch {
      setLearnError('Failed to delete file. Please try again.');
    }
  };

  const openLearnEditModal = (material: LearnMaterial) => {
    setEditingMaterial(material);
    setUploadForm({ fileName: material.fileName, whyUploaded: material.whyUploaded, whatYouWant: material.whatYouWant, layerServed: material.layerServed, modesTagged: material.modesTagged });
    setShowUploadModal(true);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatLearnDate = (isoString: string) =>
    new Date(isoString).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });

  const uploadFormValid = uploadForm.fileName && uploadForm.whyUploaded && uploadForm.whatYouWant;

  return (
    <div className="flex flex-1 flex-col pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-lg font-bold tracking-wide text-primary">COACH</div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowLibrary(true)}
            className="rounded-brand border border-[#d4af37] px-3 py-1 text-sm text-[#d4af37]"
          >
            📚 Library
          </button>
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

      {/* Library Modal */}
      {showLibrary && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50">
          <div className="flex max-h-[80vh] w-full flex-col rounded-t-brand bg-card">
            <div className="sticky top-0 flex items-center justify-between bg-card px-4 py-4">
              <h3 className="text-lg font-bold text-text-primary">📚 Material Library</h3>
              <button type="button" onClick={() => setShowLibrary(false)} className="min-h-[44px] px-2 text-text-secondary">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <div className="space-y-3 px-4 pb-4">
                {learnMaterials.length === 0 ? (
                  <LearnCard>
                    <div className="py-8 text-center">
                      <div className="text-lg font-semibold text-text-primary">Nothing here yet. Upload your first piece of material.</div>
                      <div className="mt-2 text-base text-text-secondary">PDFs, screenshots, voice notes — anything that helps Coach understand your world better.</div>
                      <label className="mt-4 inline-block min-h-[44px] cursor-pointer rounded-brand border border-primary px-6 py-2 text-primary">
                        + Upload
                        <input type="file" onChange={handleFileSelect} className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp,.m4a,.mp3,.wav,.txt" />
                      </label>
                    </div>
                  </LearnCard>
                ) : (
                  learnMaterials.map((material) => (
                    <LearnCard key={material.id}>
                      <button type="button" onClick={() => { setSelectedMaterial(material); setShowDetailModal(true); }} className="w-full text-left">
                        <div className="flex gap-3">
                          <FileTypeIcon type={material.fileType} />
                          <div className="flex-1">
                            <div className="font-semibold text-text-primary">{material.fileName}</div>
                            <div className="mt-1 truncate text-base text-text-secondary">{material.whyUploaded}</div>
                            <div className="mt-2"><LayerBadge layer={material.layerServed} /></div>
                            {material.modesTagged.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {material.modesTagged.slice(0, 3).map((mode, i) => (
                                  <span key={i} className="rounded-brand bg-primary/10 px-2 py-1 text-sm text-primary">{mode}</span>
                                ))}
                                {material.modesTagged.length > 3 && (
                                  <span className="rounded-brand bg-primary/10 px-2 py-1 text-sm text-primary">+{material.modesTagged.length - 3} more</span>
                                )}
                              </div>
                            )}
                            <div className="mt-2 text-sm text-text-secondary">{formatFileSize(material.fileSize)} · {formatLearnDate(material.uploadedAt)}</div>
                          </div>
                        </div>
                      </button>
                    </LearnCard>
                  ))
                )}
              </div>
            </div>
            <div className="sticky bottom-0 bg-card px-4 py-4">
              <label className="flex min-h-[44px] cursor-pointer items-center justify-center rounded-brand bg-primary text-white">
                + Upload Material
                <input type="file" onChange={handleFileSelect} className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp,.m4a,.mp3,.wav,.txt" />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Upload / Edit Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-[60] flex items-end bg-black/50">
          <div className="max-h-[80vh] w-full overflow-y-auto rounded-t-brand bg-card">
            <div className="sticky top-0 bg-card px-4 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-text-primary">{editingMaterial ? 'Edit Material' : 'Upload Material'}</h3>
                <button type="button" onClick={() => { setShowUploadModal(false); setEditingMaterial(null); setSelectedFile(null); setLearnError(null); }} className="min-h-[44px] px-2 text-text-secondary">✕</button>
              </div>
            </div>
            {learnError && <div className="mx-4 mb-4 rounded-brand bg-red-500/10 px-3 py-2 text-base text-red-500">{learnError}</div>}
            <div className="space-y-4 px-4 pb-4">
              <div>
                <label className="block text-base font-semibold text-text-primary">File Name</label>
                <input type="text" value={uploadForm.fileName} onChange={(e) => setUploadForm({ ...uploadForm, fileName: e.target.value })} className="mt-1 w-full rounded-brand border border-text-secondary bg-background px-3 py-2 text-text-primary" />
              </div>
              <div>
                <label className="block text-base font-semibold text-text-primary">Why Did You Upload This?</label>
                <textarea value={uploadForm.whyUploaded} onChange={(e) => setUploadForm({ ...uploadForm, whyUploaded: e.target.value })} className="mt-1 w-full rounded-brand border border-text-secondary bg-background px-3 py-2 text-text-primary" rows={3} placeholder="e.g., Reference experience from a difficult conversation" />
              </div>
              <div>
                <label className="block text-base font-semibold text-text-primary">What Do You Want Coach to Know?</label>
                <textarea value={uploadForm.whatYouWant} onChange={(e) => setUploadForm({ ...uploadForm, whatYouWant: e.target.value })} className="mt-1 w-full rounded-brand border border-text-secondary bg-background px-3 py-2 text-text-primary" rows={3} placeholder="e.g., This shows my old pattern of avoiding conflict" />
              </div>
              <div>
                <label className="block text-base font-semibold text-text-primary">Layer Served</label>
                <div className="mt-2 space-y-2">
                  {([2, 3, 4, 5, 6, 7] as const).map((layer) => (
                    <button key={layer} type="button" onClick={() => setUploadForm({ ...uploadForm, layerServed: layer })} className={`w-full rounded-brand border px-3 py-2 text-left ${uploadForm.layerServed === layer ? 'border-primary bg-primary/10' : 'border-text-secondary'}`}>
                      <LayerBadge layer={layer} />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-base font-semibold text-text-primary">Mode Tags (Optional)</label>
                <input type="text" value={uploadForm.modesTagged.join(', ')} onChange={(e) => setUploadForm({ ...uploadForm, modesTagged: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })} className="mt-1 w-full rounded-brand border border-text-secondary bg-background px-3 py-2 text-text-primary" placeholder="e.g., Phase Mode, Confidence Building" />
                <div className="mt-1 text-sm text-text-secondary">Separate multiple tags with commas</div>
              </div>
            </div>
            <div className="sticky bottom-0 flex gap-3 bg-card px-4 py-4">
              {editingMaterial && (
                <button type="button" onClick={() => setDeleteConfirm(editingMaterial.id)} className="min-h-[44px] flex-1 rounded-brand border border-red-500 text-red-500">Delete</button>
              )}
              <button type="button" onClick={editingMaterial ? handleLearnEdit : handleUpload} disabled={!uploadFormValid || uploadProgress} className="min-h-[44px] flex-1 rounded-brand bg-primary text-white disabled:opacity-50">
                {uploadProgress ? 'Uploading...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedMaterial && (
        <div className="fixed inset-0 z-[60] flex items-end bg-black/50">
          <div className="max-h-[80vh] w-full overflow-y-auto rounded-t-brand bg-card">
            <div className="sticky top-0 bg-card px-4 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-text-primary">Material Details</h3>
                <button type="button" onClick={() => { setShowDetailModal(false); setSelectedMaterial(null); }} className="min-h-[44px] px-2 text-text-secondary">✕</button>
              </div>
            </div>
            <div className="space-y-4 px-4 pb-4">
              <div className="flex gap-3">
                <FileTypeIcon type={selectedMaterial.fileType} />
                <div className="flex-1">
                  <div className="font-semibold text-text-primary">{selectedMaterial.fileName}</div>
                  <div className="mt-1 text-sm text-text-secondary">{formatFileSize(selectedMaterial.fileSize)} · {formatLearnDate(selectedMaterial.uploadedAt)}</div>
                </div>
              </div>
              <div>
                <div className="text-base font-semibold text-text-primary">Why Uploaded</div>
                <div className="mt-1 text-base text-text-secondary">{selectedMaterial.whyUploaded}</div>
              </div>
              <div>
                <div className="text-base font-semibold text-text-primary">What Coach Should Know</div>
                <div className="mt-1 text-base text-text-secondary">{selectedMaterial.whatYouWant}</div>
              </div>
              <div>
                <div className="text-base font-semibold text-text-primary">Layer</div>
                <div className="mt-1"><LayerBadge layer={selectedMaterial.layerServed} /></div>
              </div>
              {selectedMaterial.modesTagged.length > 0 && (
                <div>
                  <div className="text-base font-semibold text-text-primary">Modes</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {selectedMaterial.modesTagged.map((mode, i) => (
                      <span key={i} className="rounded-brand bg-primary/10 px-2 py-1 text-sm text-primary">{mode}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="sticky bottom-0 flex gap-3 bg-card px-4 py-4">
              <button type="button" onClick={() => { setShowDetailModal(false); openLearnEditModal(selectedMaterial); }} className="min-h-[44px] flex-1 rounded-brand border border-primary text-primary">Edit</button>
              <button type="button" onClick={() => setDeleteConfirm(selectedMaterial.id)} className="min-h-[44px] flex-1 rounded-brand border border-red-500 text-red-500">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-brand bg-card p-4">
            <div className="text-lg font-semibold text-text-primary">Delete Material?</div>
            <div className="mt-2 text-base text-text-secondary">This will permanently delete the file from storage. This cannot be undone.</div>
            <div className="mt-4 flex gap-3">
              <button type="button" onClick={() => setDeleteConfirm(null)} className="min-h-[44px] flex-1 rounded-brand border border-text-secondary text-text-secondary">Cancel</button>
              <button type="button" onClick={() => handleLearnDelete(deleteConfirm)} className="min-h-[44px] flex-1 rounded-brand bg-red-500 text-white">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Mode limit toast */}
      {modeToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 rounded-brand border border-[#d4af37] bg-[#141414] px-4 py-3 text-sm text-[#d4af37] shadow-lg transition-opacity">
          Max 2 modes active at once. Tap an active mode to deactivate it first.
        </div>
      )}
    </div>
  );
}
