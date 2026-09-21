import { createContext, useContext } from 'react';

export type Role = 'viewer' | 'analyst' | 'admin';
export interface Me { user_id: string; name: string; role: Role; grants: string[]; restricted_sources: number; visible_restricted?: string[] }

export interface Session {
  me: Me | null;
  can: (role: Role) => boolean;      // at least this role
  isRestricted: (sourceId?: string | null) => boolean;   // a restricted source this user may read: badge it
  signOut: () => void;
}

const RANK: Record<Role, number> = { viewer: 0, analyst: 1, admin: 2 };

export const SessionContext = createContext<Session>({ me: null, can: () => false, isRestricted: () => false, signOut: () => {} });
export const useSession = () => useContext(SessionContext);
export const atLeast = (me: Me | null, role: Role) => !!me && RANK[me.role] >= RANK[role];
