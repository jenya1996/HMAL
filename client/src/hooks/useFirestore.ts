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
  // Counts in-flight PUTs — poll is skipped while any write is pending to
  // prevent the server returning a prior version and overwriting local state
  const pendingWrites = useRef(0);

  useEffect(() => {
    let cancelled = false;

    function sync() {
      if (pendingWrites.current > 0) return;
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
    const interval = setInterval(sync, 10000); // poll every 10 s
    return () => { cancelled = true; clearInterval(interval); };
  }, [key]);

  const setValue = (value: T) => {
    const serialized = JSON.stringify(value);
    lastSeen.current = serialized; // suppress echo on next poll
    setStoredValue(value);
    safeLocalSet(key, serialized);
    pendingWrites.current++;
    apiFetch(`/api/data/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    }).catch((err) => {
      console.error(`[useFirestore:${key}] PUT failed:`, err);
      window.dispatchEvent(new CustomEvent('hmal-sync-error', {
        detail: `Failed to save data. Check your connection and try again.`,
      }));
    }).finally(() => {
      pendingWrites.current--;
    });
  };

  return [storedValue, setValue] as const;
}
