export type UserRole = 'DOC' | 'INF' | 'AMM';

export interface RoleOption {
  code: UserRole;
  label: string;
}

export const ROLE_OPTIONS: RoleOption[] = [
  { code: 'DOC', label: 'Medico' },
  { code: 'INF', label: 'Infermiere' },
  { code: 'AMM', label: 'Amministrativo' },
];

export interface Staff {
  id: number;
  username: string;
  role: UserRole;
  isActive: boolean;
}

export interface NewStaff {
  username: string;
  password: string;
  role: UserRole;
}

export interface UsernameAvailability {
  available: boolean;
}
