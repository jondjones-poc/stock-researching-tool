'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/apiBase';

interface AllowedEmail {
  id: number;
  email: string;
  role: 'admin' | 'user';
  created_at: string;
  updated_at: string;
}

export default function AllowedEmailsAdmin() {
  const [rows, setRows] = useState<AllowedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'user'>('user');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/auth/admin/allowed-emails');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setRows(data.data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load allowed users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleAdd = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!email) return;
    setSaving(true);
    try {
      const res = await apiFetch('/api/auth/admin/allowed-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add');
      setNewEmail('');
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to add user');
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (id: number, role: 'admin' | 'user') => {
    setSaving(true);
    try {
      const res = await apiFetch(`/api/auth/admin/allowed-emails/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update');
      }
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to update role');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, email: string) => {
    if (!confirm(`Remove ${email} from the allowlist?`)) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/api/auth/admin/allowed-emails/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete');
      }
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-10 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">Allowed users</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Only these Google accounts can sign in. Env vars <code className="text-xs">AUTH_ADMIN_EMAILS</code> and{' '}
        <code className="text-xs">ALLOWED_AUTH_EMAILS</code> also grant access.
      </p>

      {error && (
        <div className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          placeholder="email@gmail.com"
          className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
        <select
          value={newRole}
          onChange={(e) => setNewRole(e.target.value as 'admin' | 'user')}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
        <button
          type="button"
          onClick={() => void handleAdd()}
          disabled={saving || !newEmail.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          Add
        </button>
      </div>

      {loading ? (
        <p className="text-gray-500 dark:text-gray-400">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400">No database allowlist entries yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-600">
              <th className="pb-2">Email</th>
              <th className="pb-2">Role</th>
              <th className="pb-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-gray-100 dark:border-gray-700">
                <td className="py-2 text-gray-900 dark:text-white">{row.email}</td>
                <td className="py-2">
                  <select
                    value={row.role}
                    onChange={(e) => void handleRoleChange(row.id, e.target.value as 'admin' | 'user')}
                    disabled={saving}
                    className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td className="py-2 text-right">
                  <button
                    type="button"
                    onClick={() => void handleDelete(row.id, row.email)}
                    disabled={saving}
                    className="text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
