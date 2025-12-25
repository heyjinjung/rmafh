import { useEffect, useState } from 'react';

const listeners = new Set();

function makeId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `toast-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

export function pushToast(toast) {
  const payload = { id: makeId(), createdAt: Date.now(), ...toast };
  listeners.forEach((fn) => fn(payload));
  return payload;
}

export function useToastSubscription(limit = 4) {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handler = (toast) => setToasts((prev) => [toast, ...prev].slice(0, limit));
    listeners.add(handler);
    return () => listeners.delete(handler);
  }, [limit]);

  const clear = () => setToasts([]);

  return { toasts, clear };
}
