import { useState, useEffect } from 'react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

const COLLECTION = 'hmal-data';

/**
 * Drop-in replacement for useLocalStorage that syncs with Firestore.
 * localStorage is used as a local cache so the UI is immediately populated
 * while the Firestore snapshot loads.
 */
export function useFirestore<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    const docRef = doc(db, COLLECTION, key);
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          // Firestore has data — use it as source of truth
          const data = snapshot.data().value as T;
          setStoredValue(data);
          try {
            window.localStorage.setItem(key, JSON.stringify(data));
          } catch { /* ignore */ }
        } else {
          // Firestore is empty for this key — migrate from localStorage
          const cached = window.localStorage.getItem(key);
          if (cached) {
            try {
              const parsed = JSON.parse(cached) as T;
              console.log(`[Firebase] Migrating "${key}" from localStorage to Firestore...`);
              setDoc(docRef, { value: parsed })
                .then(() => console.log(`[Firebase] ✓ Migration complete for "${key}"`))
                .catch((err) => console.error(`[Firebase] ✗ Migration failed for "${key}":`, err));
            } catch (err) {
              console.error(`[Firebase] ✗ Parse error for "${key}":`, err);
            }
          }
        }
      },
      (error) => {
        console.error(`[Firebase] ✗ Snapshot error for "${key}":`, error);
      }
    );
    return unsubscribe;
  }, [key]);

  const setValue = (value: T) => {
    setStoredValue(value);
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch { /* ignore */ }
    const docRef = doc(db, COLLECTION, key);
    setDoc(docRef, { value }).catch(console.error);
  };

  return [storedValue, setValue] as const;
}
