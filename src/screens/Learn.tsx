import { useEffect, useState } from 'react';
import { LearnMaterial } from '@/utils/learnTypes';
import { supabase } from '@/integrations/supabase/client';

const STORAGE_KEY = 'grnd_learn_materials';
const BUCKET_NAME = 'grnd-learn-materials';
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const SUPPORTED_TYPES = {
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

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-[#2a2a2a] bg-[#141414] p-4">{children}</div>;
}

function LayerBadge({ layer }: { layer: 2 | 3 | 4 | 5 | 6 | 7 }) {
  const config = {
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
  const displayType = SUPPORTED_TYPES[type as keyof typeof SUPPORTED_TYPES] || 'File';
  
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

export default function Learn() {
  const [materials, setMaterials] = useState<LearnMaterial[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<LearnMaterial | null>(null);
  const [editingMaterial, setEditingMaterial] = useState<LearnMaterial | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [uploadForm, setUploadForm] = useState({
    fileName: '',
    whyUploaded: '',
    whatYouWant: '',
    layerServed: 2 as 2 | 3 | 4 | 5 | 6 | 7,
    modesTagged: [] as string[],
  });

  useEffect(() => {
    loadMaterials();
  }, []);

  const loadMaterials = async () => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      setMaterials([]);
      return;
    }

    try {
      const parsed = JSON.parse(stored) as LearnMaterial[];
      setMaterials(parsed.filter((m) => !m.isArchived));
    } catch {
      setMaterials([]);
    }
  };

  const saveMaterials = (newMaterials: LearnMaterial[]) => {
    setMaterials(newMaterials.filter((m) => !m.isArchived));
    const allMaterials = [...newMaterials];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allMaterials));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      setError('File size exceeds 10MB limit. Please choose a smaller file.');
      return;
    }

    if (!SUPPORTED_TYPES[file.type as keyof typeof SUPPORTED_TYPES]) {
      setError('Unsupported file type. Please upload PDF, image, audio, or text files.');
      return;
    }

    setSelectedFile(file);
    setUploadForm({
      fileName: file.name,
      whyUploaded: '',
      whatYouWant: '',
      layerServed: 2,
      modesTagged: [],
    });
    setError(null);
    setShowUploadModal(true);
  };

  const handleUpload = async () => {
    if (!selectedFile || !uploadForm.fileName || !uploadForm.whyUploaded || !uploadForm.whatYouWant) return;

    setUploadProgress(true);
    setError(null);

    try {
      const timestamp = Date.now();
      const storagePath = `user/${timestamp}_${selectedFile.name}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(storagePath, selectedFile);

      if (uploadError) {
        throw new Error(uploadError.message);
      }

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

      const stored = localStorage.getItem(STORAGE_KEY);
      const existing = stored ? JSON.parse(stored) : [];
      saveMaterials([...existing, newMaterial]);

      setShowUploadModal(false);
      setSelectedFile(null);
      setUploadProgress(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
      setUploadProgress(false);
    }
  };

  const handleEdit = () => {
    if (!editingMaterial || !uploadForm.fileName || !uploadForm.whyUploaded || !uploadForm.whatYouWant) return;

    const stored = localStorage.getItem(STORAGE_KEY);
    const existing = stored ? JSON.parse(stored) : [];
    const updated = existing.map((m: LearnMaterial) =>
      m.id === editingMaterial.id
        ? {
            ...m,
            fileName: uploadForm.fileName,
            whyUploaded: uploadForm.whyUploaded,
            whatYouWant: uploadForm.whatYouWant,
            layerServed: uploadForm.layerServed,
            modesTagged: uploadForm.modesTagged,
          }
        : m
    );
    saveMaterials(updated);
    setShowUploadModal(false);
    setEditingMaterial(null);
  };

  const handleDelete = async (id: string) => {
    const material = materials.find((m) => m.id === id);
    if (!material) return;

    try {
      await supabase.storage.from(BUCKET_NAME).remove([material.storagePath]);

      const stored = localStorage.getItem(STORAGE_KEY);
      const existing = stored ? JSON.parse(stored) : [];
      saveMaterials(existing.filter((m: LearnMaterial) => m.id !== id));
      setDeleteConfirm(null);
    } catch (err) {
      setError('Failed to delete file. Please try again.');
    }
  };

  const openEditModal = (material: LearnMaterial) => {
    setEditingMaterial(material);
    setUploadForm({
      fileName: material.fileName,
      whyUploaded: material.whyUploaded,
      whatYouWant: material.whatYouWant,
      layerServed: material.layerServed,
      modesTagged: material.modesTagged,
    });
    setShowUploadModal(true);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const uploadFormValid = uploadForm.fileName && uploadForm.whyUploaded && uploadForm.whatYouWant;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-10 bg-background px-4 py-4">
        <h1 className="text-2xl font-bold text-text-primary">Learn</h1>
        <p className="text-base text-zinc-400">📚 Material Library</p>
      </div>

      <div className="space-y-3 px-4">
        {materials.length === 0 ? (
          <Card>
            <div className="py-8 text-center">
              <div className="text-lg font-semibold text-text-primary">Nothing here yet. Upload your first piece of material.</div>
              <div className="mt-2 text-base text-text-secondary">
                PDFs, screenshots, voice notes — anything that helps Coach understand your world better.
              </div>
              <label className="mt-4 inline-block min-h-[44px] cursor-pointer rounded-brand border border-primary px-6 py-2 text-primary">
                + Upload
                <input type="file" onChange={handleFileSelect} className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp,.m4a,.mp3,.wav,.txt" />
              </label>
            </div>
          </Card>
        ) : (
          materials.map((material) => (
            <Card key={material.id}>
              <button
                type="button"
                onClick={() => {
                  setSelectedMaterial(material);
                  setShowDetailModal(true);
                }}
                className="w-full text-left"
              >
                <div className="flex gap-3">
                  <FileTypeIcon type={material.fileType} />
                  <div className="flex-1">
                    <div className="font-semibold text-text-primary">{material.fileName}</div>
                    <div className="mt-1 truncate text-base text-text-secondary">{material.whyUploaded}</div>
                    <div className="mt-2">
                      <LayerBadge layer={material.layerServed} />
                    </div>
                    {material.modesTagged.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {material.modesTagged.slice(0, 3).map((mode, i) => (
                          <span key={i} className="rounded-brand bg-primary/10 px-2 py-1 text-sm text-primary">
                            {mode}
                          </span>
                        ))}
                        {material.modesTagged.length > 3 && (
                          <span className="rounded-brand bg-primary/10 px-2 py-1 text-sm text-primary">
                            +{material.modesTagged.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                    <div className="mt-2 text-sm text-text-secondary">
                      {formatFileSize(material.fileSize)} · {formatDate(material.uploadedAt)}
                    </div>
                  </div>
                </div>
              </button>
            </Card>
          ))
        )}
      </div>

      <label className="fixed bottom-24 right-4 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-primary text-white shadow-lg">
        +
        <input type="file" onChange={handleFileSelect} className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp,.m4a,.mp3,.wav,.txt" />
      </label>

      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50">
          <div className="max-h-[80vh] w-full overflow-y-auto rounded-t-brand bg-card">
            <div className="sticky top-0 bg-card px-4 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-text-primary">{editingMaterial ? 'Edit Material' : 'Upload Material'}</h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadModal(false);
                    setEditingMaterial(null);
                    setSelectedFile(null);
                    setError(null);
                  }}
                  className="min-h-[44px] px-2 text-text-secondary"
                >
                  ✕
                </button>
              </div>
            </div>

            {error && (
              <div className="mx-4 mb-4 rounded-brand bg-red-500/10 px-3 py-2 text-base text-red-500">
                {error}
              </div>
            )}

            <div className="space-y-4 px-4 pb-4">
              <div>
                <label className="block text-base font-semibold text-text-primary">File Name</label>
                <input
                  type="text"
                  value={uploadForm.fileName}
                  onChange={(e) => setUploadForm({ ...uploadForm, fileName: e.target.value })}
                  className="mt-1 w-full rounded-brand border border-text-secondary bg-background px-3 py-2 text-text-primary"
                />
              </div>

              <div>
                <label className="block text-base font-semibold text-text-primary">Why Did You Upload This?</label>
                <textarea
                  value={uploadForm.whyUploaded}
                  onChange={(e) => setUploadForm({ ...uploadForm, whyUploaded: e.target.value })}
                  className="mt-1 w-full rounded-brand border border-text-secondary bg-background px-3 py-2 text-text-primary"
                  rows={3}
                  placeholder="e.g., Reference experience from a difficult conversation"
                />
              </div>

              <div>
                <label className="block text-base font-semibold text-text-primary">What Do You Want Coach to Know?</label>
                <textarea
                  value={uploadForm.whatYouWant}
                  onChange={(e) => setUploadForm({ ...uploadForm, whatYouWant: e.target.value })}
                  className="mt-1 w-full rounded-brand border border-text-secondary bg-background px-3 py-2 text-text-primary"
                  rows={3}
                  placeholder="e.g., This shows my old pattern of avoiding conflict"
                />
              </div>

              <div>
                <label className="block text-base font-semibold text-text-primary">Layer Served</label>
                <div className="mt-2 space-y-2">
                  {([2, 3, 4, 5, 6, 7] as const).map((layer) => (
                    <button
                      key={layer}
                      type="button"
                      onClick={() => setUploadForm({ ...uploadForm, layerServed: layer })}
                      className={`w-full rounded-brand border px-3 py-2 text-left ${
                        uploadForm.layerServed === layer ? 'border-primary bg-primary/10' : 'border-text-secondary'
                      }`}
                    >
                      <LayerBadge layer={layer} />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-base font-semibold text-text-primary">Mode Tags (Optional)</label>
                <input
                  type="text"
                  value={uploadForm.modesTagged.join(', ')}
                  onChange={(e) =>
                    setUploadForm({
                      ...uploadForm,
                      modesTagged: e.target.value.split(',').map((t) => t.trim()).filter(Boolean),
                    })
                  }
                  className="mt-1 w-full rounded-brand border border-text-secondary bg-background px-3 py-2 text-text-primary"
                  placeholder="e.g., Phase Mode, Confidence Building"
                />
                <div className="mt-1 text-sm text-text-secondary">Separate multiple tags with commas</div>
              </div>
            </div>

            <div className="sticky bottom-0 flex gap-3 bg-card px-4 py-4">
              {editingMaterial && (
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(editingMaterial.id)}
                  className="min-h-[44px] flex-1 rounded-brand border border-red-500 text-red-500"
                >
                  Delete
                </button>
              )}
              <button
                type="button"
                onClick={editingMaterial ? handleEdit : handleUpload}
                disabled={!uploadFormValid || uploadProgress}
                className="min-h-[44px] flex-1 rounded-brand bg-primary text-white disabled:opacity-50"
              >
                {uploadProgress ? 'Uploading...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDetailModal && selectedMaterial && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50">
          <div className="max-h-[80vh] w-full overflow-y-auto rounded-t-brand bg-card">
            <div className="sticky top-0 bg-card px-4 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-text-primary">Material Details</h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowDetailModal(false);
                    setSelectedMaterial(null);
                  }}
                  className="min-h-[44px] px-2 text-text-secondary"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="space-y-4 px-4 pb-4">
              <div className="flex gap-3">
                <FileTypeIcon type={selectedMaterial.fileType} />
                <div className="flex-1">
                  <div className="font-semibold text-text-primary">{selectedMaterial.fileName}</div>
                  <div className="mt-1 text-sm text-text-secondary">
                    {formatFileSize(selectedMaterial.fileSize)} · {formatDate(selectedMaterial.uploadedAt)}
                  </div>
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
                <div className="mt-1">
                  <LayerBadge layer={selectedMaterial.layerServed} />
                </div>
              </div>

              {selectedMaterial.modesTagged.length > 0 && (
                <div>
                  <div className="text-base font-semibold text-text-primary">Modes</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {selectedMaterial.modesTagged.map((mode, i) => (
                      <span key={i} className="rounded-brand bg-primary/10 px-2 py-1 text-sm text-primary">
                        {mode}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 flex gap-3 bg-card px-4 py-4">
              <button
                type="button"
                onClick={() => {
                  setShowDetailModal(false);
                  openEditModal(selectedMaterial);
                }}
                className="min-h-[44px] flex-1 rounded-brand border border-primary text-primary"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirm(selectedMaterial.id)}
                className="min-h-[44px] flex-1 rounded-brand border border-red-500 text-red-500"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-brand bg-card p-4">
            <div className="text-lg font-semibold text-text-primary">Delete Material?</div>
            <div className="mt-2 text-base text-text-secondary">
              This will permanently delete the file from storage. This cannot be undone.
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
                onClick={() => handleDelete(deleteConfirm)}
                className="min-h-[44px] flex-1 rounded-brand bg-red-500 text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
