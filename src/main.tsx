import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'
import { registerSW } from 'virtual:pwa-register'

// ─── localStorage usage check ───────────────────────────────────────────────
function checkStorageUsage(): void {
  let bytes = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i) ?? '';
    const value = localStorage.getItem(key) ?? '';
    bytes += (key.length + value.length) * 2; // UTF-16: 2 bytes per char
  }
  const kb = bytes / 1024;
  if (kb > 3000) {
    console.warn(`[GRND] localStorage usage is ${kb.toFixed(1)} KB — approaching browser limits.`);
  }
}

// ─── Old-data cleanup (>90 days) ────────────────────────────────────────────
const DATED_PREFIXES = [
  'grnd_food_log_',
  'grnd_checklist_',
  'grnd_sleep_log_',
  'grnd_mood_log_',
  'grnd_macro_log_',
];
const DATE_SUFFIX_RE = /^\d{4}-\d{2}-\d{2}$/;

function cleanOldStorageKeys(): void {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  cutoff.setHours(0, 0, 0, 0);

  const toDelete: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i) ?? '';
    for (const prefix of DATED_PREFIXES) {
      if (key.startsWith(prefix)) {
        const suffix = key.slice(prefix.length);
        if (DATE_SUFFIX_RE.test(suffix)) {
          const keyDate = new Date(suffix + 'T00:00:00');
          if (keyDate < cutoff) {
            toDelete.push(key);
          }
        }
        break;
      }
    }
  }

  for (const key of toDelete) {
    localStorage.removeItem(key);
  }
}

checkStorageUsage();
cleanOldStorageKeys();

registerSW({
  onNeedRefresh() {
    if (confirm('GRND has been updated. Reload now?')) {
      window.location.reload()
    }
  }
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
