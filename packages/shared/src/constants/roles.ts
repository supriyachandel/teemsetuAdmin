export const ROLES = {
  SYSTEM_ADMIN: 'SYSTEM_ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
  HR: 'HR',
  MANAGER: 'MANAGER',
  EMPLOYEE: 'EMPLOYEE',
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<RoleName, string> = {
  SYSTEM_ADMIN: 'Platform Admin',
  SUPER_ADMIN: 'Company Admin',
  HR: 'HR',
  MANAGER: 'Manager',
  EMPLOYEE: 'Employee',
};
