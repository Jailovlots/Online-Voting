// Shared API client for calling the Render Express backend.
// All server function calls in components should use this instead of useServerFn().

import { getToken } from '@/lib/session-store';

// In production (Vercel), this env var should be set to the Render URL.
// In dev, it falls back to localhost:3001.
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Core fetch helper — attaches the JWT token and handles errors.
 */
async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers ?? {}),
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const body = await res.json();
      message = body.error ?? message;
    } catch {
      // ignore parse errors
    }
    throw new ApiError(res.status, message);
  }

  // Handle 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

// ── Auth ──────────────────────────────────────────────────────────────────
export const api = {
  auth: {
    signIn: (email: string, password: string) =>
      apiFetch<{ token: string; isAdmin: boolean }>('/api/auth/signin', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),

    signUp: (data: {
      email: string;
      password: string;
      full_name: string;
      student_id: string;
      course?: string;
      year_level?: number;
      section?: string | null;
    }) =>
      apiFetch<{ ok: boolean }>('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    me: () => apiFetch<Record<string, unknown>>('/api/auth/me'),

    updatePassword: (password: string) =>
      apiFetch<{ ok: boolean }>('/api/auth/password', {
        method: 'PATCH',
        body: JSON.stringify({ password }),
      }),
  },

  // ── Queries ─────────────────────────────────────────────────────────────
  queries: {
    positions: () => apiFetch<unknown[]>('/api/queries/positions'),
    candidates: () => apiFetch<unknown[]>('/api/queries/candidates'),
    candidatesApproved: () => apiFetch<unknown[]>('/api/queries/candidates/approved'),
    elections: () => apiFetch<unknown[]>('/api/queries/elections'),
    activeElection: () => apiFetch<unknown | null>('/api/queries/elections/active'),
    announcements: () => apiFetch<unknown[]>('/api/queries/announcements'),
    announcementsPreview: () => apiFetch<unknown[]>('/api/queries/announcements/preview'),
    auditLogs: () => apiFetch<unknown[]>('/api/queries/audit-logs'),
    profile: () => apiFetch<Record<string, unknown> | null>('/api/queries/profile'),
    registrationStatus: () =>
      apiFetch<{ isApproved: boolean }>('/api/queries/profile/registration-status'),
    roles: () =>
      apiFetch<{ roles: string[]; isAdmin: boolean; isStudent: boolean; userId: string }>(
        '/api/queries/roles',
      ),
    dashboardStudent: () => apiFetch<Record<string, unknown>>('/api/queries/dashboard/student'),
    dashboardAdmin: () => apiFetch<Record<string, unknown>>('/api/queries/dashboard/admin'),
    votes: () => apiFetch<unknown[]>('/api/queries/votes'),
  },

  // ── Voting ───────────────────────────────────────────────────────────────
  voting: {
    cast: (electionId: string, selections: Record<string, string | string[]>) =>
      apiFetch<{ ok: boolean; receipt: string; positions: number }>('/api/voting/cast', {
        method: 'POST',
        body: JSON.stringify({ electionId, selections }),
      }),

    hasVoted: (electionId: string) =>
      apiFetch<{ voted: boolean }>('/api/voting/has-voted', {
        method: 'POST',
        body: JSON.stringify({ electionId }),
      }),
  },

  // ── Admin ─────────────────────────────────────────────────────────────────
  admin: {
    // Elections
    setElectionStatus: (id: string, status: 'upcoming' | 'active' | 'closed') =>
      apiFetch<{ ok: boolean }>(`/api/admin/elections/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),

    upsertElection: (data: {
      id?: string;
      title: string;
      description?: string | null;
      starts_at: string;
      ends_at: string;
      status?: 'upcoming' | 'active' | 'closed';
    }) =>
      apiFetch<{ ok: boolean }>('/api/admin/elections', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    // Candidates
    upsertCandidate: (data: {
      id?: string;
      position_id: string;
      full_name: string;
      party?: string | null;
      bio?: string | null;
      platform?: string | null;
      photo_url?: string | null;
      approved?: boolean;
    }) =>
      apiFetch<{ ok: boolean }>('/api/admin/candidates', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    deleteCandidate: (id: string) =>
      apiFetch<{ ok: boolean }>(`/api/admin/candidates/${id}`, { method: 'DELETE' }),

    // Announcements
    upsertAnnouncement: (data: {
      id?: string;
      title: string;
      body: string;
      pinned?: boolean;
    }) =>
      apiFetch<{ ok: boolean }>('/api/admin/announcements', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    deleteAnnouncement: (id: string) =>
      apiFetch<{ ok: boolean }>(`/api/admin/announcements/${id}`, { method: 'DELETE' }),

    // Positions
    upsertPosition: (data: {
      id?: string;
      title: string;
      description?: string | null;
      max_winners: number;
      order_index?: number;
      allowed_year_levels?: number[] | null;
      allowed_courses?: string[] | null;
    }) =>
      apiFetch<{ ok: boolean }>('/api/admin/positions', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    deletePosition: (id: string) =>
      apiFetch<{ ok: boolean }>(`/api/admin/positions/${id}`, { method: 'DELETE' }),

    // Students
    getStudents: () => apiFetch<unknown[]>('/api/admin/students'),

    updateStudentRegistration: (id: string, is_registered: boolean) =>
      apiFetch<{ ok: boolean }>(`/api/admin/students/${id}/registration`, {
        method: 'PATCH',
        body: JSON.stringify({ is_registered }),
      }),

    deleteStudent: (id: string) =>
      apiFetch<{ ok: boolean }>(`/api/admin/students/${id}`, { method: 'DELETE' }),

    grantAdmin: (user_id: string) =>
      apiFetch<{ ok: boolean }>(`/api/admin/students/${user_id}/grant-admin`, { method: 'POST' }),

    toggleOfficer: (user_id: string, grant: boolean) =>
      apiFetch<{ ok: boolean }>(`/api/admin/students/${user_id}/officer`, {
        method: 'POST',
        body: JSON.stringify({ grant }),
      }),

    // Profile
    updateMyProfile: (data: {
      full_name?: string;
      course?: string | null;
      year_level?: number | null;
      photo_url?: string | null;
      section?: string | null;
    }) =>
      apiFetch<{ ok: boolean }>('/api/admin/profile', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    // Eligible Voters
    getEligibleVoters: () => apiFetch<unknown[]>('/api/admin/eligible-voters'),

    uploadEligibleVoters: (rows: { student_id: string; last_name: string; first_name: string }[]) =>
      apiFetch<{ ok: boolean; total: number }>('/api/admin/eligible-voters', {
        method: 'POST',
        body: JSON.stringify({ rows }),
      }),

    deleteEligibleVoter: (studentId: string) =>
      apiFetch<{ ok: boolean }>(`/api/admin/eligible-voters/${studentId}`, { method: 'DELETE' }),

    // Voter Participation Report
    getVoterReport: (electionId: string) =>
      apiFetch<unknown[]>(`/api/admin/elections/${electionId}/voter-report`, { method: 'POST' }),

    // Image Upload
    uploadImage: (base64Data: string) =>
      apiFetch<{ url: string }>('/api/admin/upload-image', {
        method: 'POST',
        body: JSON.stringify({ base64Data }),
      }),
  },
};
