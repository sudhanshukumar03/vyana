import { create } from 'zustand';
import { useHealthStore } from './useHealthStore';

interface AdminAccessState {
  devToolsEnabled: boolean;
  setDevToolsEnabled: (enabled: boolean) => void;
  toggleDevTools: () => void;
}

const STORAGE_KEY = 'vyana_dev_tools';

export const useAdminAccessStore = create<AdminAccessState>((set) => ({
  devToolsEnabled: typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) === 'true' : false,
  setDevToolsEnabled: (enabled: boolean) => {
    if (typeof window !== 'undefined') {
      if (enabled) {
        localStorage.setItem(STORAGE_KEY, 'true');
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    set({ devToolsEnabled: enabled });
  },
  toggleDevTools: () => {
    set((state) => {
      const next = !state.devToolsEnabled;
      if (typeof window !== 'undefined') {
        if (next) {
          localStorage.setItem(STORAGE_KEY, 'true');
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
      return { devToolsEnabled: next };
    });
  },
}));

/**
 * Pure helper to verify if an email or developer override qualifies as admin/developer.
 */
export function isUserAdminOrDev(userEmail?: string | null, devToolsEnabled?: boolean): boolean {
  if (devToolsEnabled) return true;
  if (!userEmail) return false;
  const email = userEmail.toLowerCase();
  return (
    email.includes('admin') ||
    email.startsWith('dev@') ||
    email.includes('technician') ||
    email.includes('simulation')
  );
}

/**
 * Hook that checks whether the current session has admin privileges or developer mode enabled.
 * Regular patient accounts will return false by default, hiding back-office tools.
 */
export function useIsAdminOrDev(): boolean {
  const user = useHealthStore((s) => s.user);
  const devToolsEnabled = useAdminAccessStore((s) => s.devToolsEnabled);
  return isUserAdminOrDev(user?.email, devToolsEnabled);
}
