import { useState, useEffect } from 'react';
import { apiFetch, apiStream } from '../lib/api';

export function useFirestore<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    // Load initial value from server
    apiFetch<{ value: T | null }>(`/api/data/${key}`)
      .then(({ value }) => {
        if (value !== null) {
          setStoredValue(value);
          localStorage.setItem(key, JSON.stringify(value));
        }
      })
      .catch(console.error);

    // Subscribe to real-time updates via SSE
    const es = apiStream(`/api/data/${key}/stream`);
    es.onmessage = (e: MessageEvent) => {
      const { value } = JSON.parse(e.data) as { value: T | null };
      if (value !== null) {
        setStoredValue(value);
        localStorage.setItem(key, JSON.stringify(value));
      }
    };
    es.onerror = () => es.close();

    return () => es.close();
  }, [key]);

  const setValue = (value: T) => {
    setStoredValue(value);
    localStorage.setItem(key, JSON.stringify(value));
    apiFetch(`/api/data/${key}`, {
      method: 'PUT',
      body:   JSON.stringify({ value }),
    }).catch(console.error);
  };

  return [storedValue, setValue] as const;
}
