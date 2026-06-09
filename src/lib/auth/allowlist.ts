import { query } from '@/app/utils/db';
import { getEnvAdminEmails, getEnvAllowedEmails } from './config';

export type AuthRole = 'admin' | 'user';

export async function resolveRoleForEmail(email: string): Promise<AuthRole | null> {
  const normalized = email.trim().toLowerCase();
  const envAdmins = getEnvAdminEmails();
  if (envAdmins.includes(normalized)) return 'admin';

  const envAllowed = getEnvAllowedEmails();
  if (envAllowed.includes(normalized)) return 'user';

  try {
    const result = await query(
      `SELECT role FROM auth_allowed_email WHERE LOWER(email) = $1 LIMIT 1`,
      [normalized]
    );
    if (result.rows.length > 0) {
      const role = result.rows[0].role as string;
      if (role === 'admin' || role === 'user') return role;
    }
  } catch (err) {
    console.error('auth_allowed_email lookup failed:', err);
    throw err;
  }

  return null;
}

export async function isEmailAllowed(email: string): Promise<boolean> {
  return (await resolveRoleForEmail(email)) !== null;
}

export async function isEmailAdmin(email: string): Promise<boolean> {
  return (await resolveRoleForEmail(email)) === 'admin';
}
