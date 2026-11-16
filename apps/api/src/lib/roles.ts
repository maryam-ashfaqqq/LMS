export const roles = ['admin', 'instructor', 'student'] as const;
export type Role = (typeof roles)[number];

export function isRole(value: string): value is Role {
  return roles.includes(value as Role);
}
