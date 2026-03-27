interface SyncQueueItem {
  id: string;
  key: string;
  data: unknown;
  timestamp: number;
  retries: number;
}

const STORAGE_KEY = 'grnd_sync_queue';
const MAX_RETRIES = 5;

function getQueue(): SyncQueueItem[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

function saveQueue(queue: SyncQueueItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

export function addToQueue(key: string, data: unknown): void {
  const queue = getQueue();
  const item: SyncQueueItem = {
    id: crypto.randomUUID(),
    key,
    data,
    timestamp: Date.now(),
    retries: 0,
  };
  queue.push(item);
  saveQueue(queue);
}

export async function processQueue(): Promise<void> {
  const queue = getQueue();
  if (queue.length === 0) return;

  console.warn('Sync endpoint not yet implemented - queue processing skipped');
  
  const remainingQueue: SyncQueueItem[] = [];

  for (const item of queue) {
    if (item.retries >= MAX_RETRIES) {
      console.error(`Sync failed after ${MAX_RETRIES} retries for key: ${item.key}`, item);
      continue;
    }

    remainingQueue.push(item);
  }

  saveQueue(remainingQueue);
}

export function getQueueLength(): number {
  return getQueue().length;
}

export function clearQueue(): void {
  localStorage.removeItem(STORAGE_KEY);
}
