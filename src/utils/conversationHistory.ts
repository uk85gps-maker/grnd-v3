export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const STORAGE_KEY = 'grnd_conversation_history';
const MAX_AGE_DAYS = 14;

export function getConversationHistory(): Message[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];

  try {
    const messages = JSON.parse(stored) as Message[];
    // Prune messages older than 14 days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - MAX_AGE_DAYS);
    
    const pruned = messages.filter((msg) => {
      const msgDate = new Date(msg.timestamp);
      return msgDate >= cutoffDate;
    });

    // Save pruned history if any were removed
    if (pruned.length !== messages.length) {
      saveConversationHistory(pruned);
    }

    return pruned;
  } catch {
    return [];
  }
}

export function saveConversationHistory(messages: Message[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
}

export function addMessage(role: 'user' | 'assistant', content: string): void {
  const history = getConversationHistory();
  history.push({
    role,
    content,
    timestamp: new Date().toISOString(),
  });
  saveConversationHistory(history);
}

export function clearConversationHistory(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function formatMessagesForAPI(): Array<{ role: 'user' | 'assistant'; content: string }> {
  const history = getConversationHistory();
  return history.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));
}
