import { createContext, useContext } from 'react';

export type AdminCtxType = {
  email: string;
  getAuthHeaders: () => Promise<Record<string, string>>;
  signOut: () => Promise<void>;
  notify: (type: 'success' | 'error', text: string) => void;
};

export const AdminCtx = createContext<AdminCtxType | null>(null);

export function useAdmin(): AdminCtxType {
  const ctx = useContext(AdminCtx);
  if (!ctx) throw new Error('AdminCtx sağlayıcısı yok.');
  return ctx;
}
