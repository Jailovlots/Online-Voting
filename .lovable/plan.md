
# Student Government Online Voting System

A complete full-stack voting platform with separate Student and Admin experiences, secure authentication, role-based access, and a polished navy/gold design system.

## Tech Stack
- TanStack Start (React 19) + Tailwind v4 + shadcn
- Lovable Cloud (Postgres, Auth, server functions) — replaces the Node/Express + MySQL request; gives us encrypted auth, RLS for vote integrity, and server-side APIs without external setup
- Recharts for analytics, Framer Motion for transitions, Sonner for toasts

## Design Direction
- Palette: Deep navy primary, gold secondary, white surfaces, green/orange/red states (all as oklch tokens in `src/styles.css`)
- Typography: Display serif (Fraunces) + clean sans (Inter) for an institutional, student-government feel
- Layout: Sidebar shell, card-based panels, animated stat tiles, hero with seal/illustration

## Database Schema (Cloud / Postgres)
```
profiles(id, student_id, full_name, email, photo_url, course, year_level, has_voted, created_at)
user_roles(id, user_id, role)  -- enum: student | admin
positions(id, title, description, max_votes, order_index)
candidates(id, position_id, full_name, photo_url, party, bio, platform, approved, created_at)
elections(id, title, description, starts_at, ends_at, status)
votes(id, election_id, position_id, candidate_id, voter_hash, created_at)  -- anonymized
announcements(id, title, body, author_id, pinned, created_at)
audit_logs(id, actor_id, action, target, metadata, created_at)
```
- RLS: students read approved candidates/positions/announcements, insert own vote once; admins full access via `has_role(auth.uid(),'admin')` security-definer function
- Voter anonymity: votes table stores a salted hash of (user_id, election_id) instead of user_id; uniqueness prevents double-vote
- Seed migration with realistic mock students, 4 positions, ~12 candidates, 1 active election, announcements

## Routes
Public:
- `/` landing with election info + countdown
- `/auth` login / register / forgot password
- `/reset-password`

Student (`/_authenticated/student/*`):
- `dashboard` — profile, countdown, voting status, participation chart
- `candidates` — searchable/filterable grid with detail modal
- `vote` — ballot per position, confirmation modal, receipt
- `announcements`, `history`, `profile`

Admin (`/_authenticated/admin/*`, gated by `has_role`):
- `dashboard` — KPIs, live vote tracking, charts
- `students`, `candidates` (approve/CRUD), `positions`, `elections` (open/close), `announcements`, `results` (export CSV), `audit-logs`

## Server Functions
- `castVote` — auth required, validates active election, position, single vote, inserts anonymized row, writes audit log
- `getResults` — live tallies
- `approveCandidate`, `openElection`, `closeElection` — admin-only, role-checked
- `exportResults` — CSV download

## Security
- `requireSupabaseAuth` middleware on every protected server fn
- `_authenticated` layout (integration-managed) + nested `_admin` layout gating via `has_role`
- Client never trusts role — server re-checks on every mutation
- Audit log entry on vote, approve, open/close, CRUD

## Deliverables this turn
1. Enable Lovable Cloud
2. Migration: schema + RLS + grants + has_role + seed mock data
3. Design system in `src/styles.css` (navy/gold tokens, fonts via root `<link>`)
4. Auth pages + role-aware redirect
5. Student dashboard, candidates, ballot/vote flow, announcements, profile
6. Admin dashboard, candidate approval, election control, results, audit log
7. Landing page + sitemap/robots

Approve and I'll start building.
