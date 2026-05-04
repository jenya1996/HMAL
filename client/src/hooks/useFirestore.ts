import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../lib/api';

function safeLocalSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    console.error('[useFirestore] localStorage write failed (quota exceeded?):', err);
    window.dispatchEvent(new CustomEvent('hmal-storage-full'));
  }
}

export function useFirestore<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  // Tracks the last JSON we set so we don't echo our own writes back
  const lastSeen = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    function sync() {
      apiFetch<{ value: T | null }>(`/api/data/${key}`)
        .then(({ value }) => {
          if (cancelled || value === null) return;
          const serialized = JSON.stringify(value);
          if (serialized !== lastSeen.current) {
            lastSeen.current = serialized;
            setStoredValue(value);
            safeLocalSet(key, serialized);
          }
        })
        .catch((err) => console.error(`[useFirestore:${key}] sync failed:`, err));
    }

    sync(); // immediate on mount
    const interval = setInterval(sync, 3000); // poll every 3 s
    return () => { cancelled = true; clearInterval(interval); };
  }, [key]);

  const setValue = (value: T) => {
    const serialized = JSON.stringify(value);
    lastSeen.current = serialized; // suppress echo on next poll
    setStoredValue(value);
    safeLocalSet(key, serialized);
    apiFetch(`/api/data/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    }).catch((err) => {
      console.error(`[useFirestore:${key}] PUT failed:`, err);
      window.dispatchEvent(new CustomEvent('hmal-sync-error', {
        detail: `Failed to save data. Check your connection and try again.`,
      }));
    });
  };

  return [storedValue, setValue] as const;
}
