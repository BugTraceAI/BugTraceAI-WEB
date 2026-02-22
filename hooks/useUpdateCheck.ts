import { useState, useEffect } from 'react';

interface UpdateState {
  updateAvailable: boolean;
  latestVersion: string;
  releaseUrl: string;
  dismissed: boolean;
  dismiss: () => void;
}

const DISMISS_KEY = 'btai-update-dismissed';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export function useUpdateCheck(): UpdateState | null {
  const [update, setUpdate] = useState<UpdateState | null>(null);

  useEffect(() => {
    // Already dismissed this session
    try { if (sessionStorage.getItem(DISMISS_KEY)) return; } catch { /* private mode */ }

    const check = async () => {
      try {
        const res = await fetch(`${API_URL}/version`);
        if (!res.ok) return;

        const json = await res.json();
        const data = json.data ?? json;

        if (data.updateAvailable) {
          setUpdate({
            updateAvailable: true,
            latestVersion: data.latestVersion,
            releaseUrl: data.releaseUrl || '',
            dismissed: false,
            dismiss: () => {
              try { sessionStorage.setItem(DISMISS_KEY, 'true'); } catch { /* private mode */ }
              setUpdate(prev => prev ? { ...prev, dismissed: true } : null);
            },
          });
        }
      } catch {
        // Silent fail
      }
    };

    check();
  }, []);

  if (!update || update.dismissed) return null;
  return update;
}
