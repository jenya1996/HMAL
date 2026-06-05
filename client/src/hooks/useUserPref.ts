import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../lib/api';

function safeLocalSet(cacheKey: string, value: string) {
  try {
    localStorage.setItem(cacheKey, value);
  } catch (err) {
    console.error('[useUserPref] localStorage write failed:', err);
    window.dispatchEvent(new CustomEvent('hmal-storage-full'));
  }
}

export function useUserPref<T>(key: string, initialValue: T) {
  const cacheKey = `hmal-pref-${key}`;

  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(cacheKey);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const lastSeen = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    function sync() {
      apiFetch<{ value: T | null }>(`/api/prefs/${key}`)
        .then(({ value }) => {
          if (cancelled || value === null) return;
          const serialized = JSON.stringify(value);
          if (serialized !== lastSeen.current) {
            lastSeen.current = serialized;
            setStoredValue(value);
            safeLocalSet(cacheKey, serialized);
          }
        })
        .catch((err) => console.error(`[useUserPref:${key}] sync failed:`, err));
    }

    sync();
    const interval = setInterval(sync, 10_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [key, cacheKey]);

  const setValue = (value: T) => {
    const serialized = JSON.stringify(value);
    lastSeen.current = serialized;
    setStoredValue(value);
    safeLocalSet(cacheKey, serialized);
    apiFetch(`/api/prefs/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    }).catch((err) => {
      console.error(`[useUserPref:${key}] PUT failed:`, err);
      window.dispatchEvent(new CustomEvent('hmal-sync-error', {
        detail: 'Failed to save preferences. Check your connection and try again.',
      }));
    });
  };

  return [storedValue, setValue] as const;
}
