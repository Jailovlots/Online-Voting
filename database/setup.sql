-- ============================================================
-- onlineVoting_db  —  Campus E-Vote Setup Script
-- Run this in psql or pgAdmin against your local PostgreSQL:
--   psql -U postgres -d onlineVoting_db -f database/setup.sql
-- ============================================================

-- ============ ENUMS ============
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'student', 'officer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.election_status AS ENUM ('upcoming', 'active', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ USERS (replaces auth.users) ============
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ PROFILES ============
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  student_id TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  photo_url TEXT,
  course TEXT,
  year_level INT,
  section TEXT,
  is_registered BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ USER ROLES ============
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- ============ HAS ROLE HELPER ============
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- ============ POSITIONS ============
CREATE TABLE IF NOT EXISTS public.positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  max_winners INT NOT NULL DEFAULT 1,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ CANDIDATES ============
CREATE TABLE IF NOT EXISTS public.candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id UUID NOT NULL REFERENCES public.positions(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  photo_url TEXT,
  party TEXT,
  bio TEXT,
  platform TEXT,
  approved BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ ELECTIONS ============
CREATE TABLE IF NOT EXISTS public.elections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status election_status NOT NULL DEFAULT 'upcoming',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ VOTES ============
CREATE TABLE IF NOT EXISTS public.votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id UUID NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
  position_id UUID NOT NULL REFERENCES public.positions(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  voter_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (election_id, candidate_id, voter_hash)
);

-- ============ ANNOUNCEMENTS ============
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ AUDIT LOGS ============
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- ============ PERFORMANCE INDEXES ============
-- Critical for fast vote counting and participation lookups at scale (1,000+ students)
CREATE INDEX IF NOT EXISTS idx_votes_election_id     ON public.votes(election_id);
CREATE INDEX IF NOT EXISTS idx_votes_candidate_id    ON public.votes(candidate_id);
CREATE INDEX IF NOT EXISTS idx_votes_voter_hash      ON public.votes(voter_hash);
CREATE INDEX IF NOT EXISTS idx_votes_election_voter  ON public.votes(election_id, voter_hash);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_role  ON public.user_roles(user_id, role);
CREATE INDEX IF NOT EXISTS idx_profiles_registered   ON public.profiles(id) WHERE is_registered = true;

-- ============ ELIGIBLE VOTERS ============
CREATE TABLE IF NOT EXISTS public.eligible_voters (
  student_id  TEXT PRIMARY KEY,
  last_name   TEXT NOT NULL,
  first_name  TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_eligible_voters_student_id ON public.eligible_voters(student_id);


INSERT INTO public.positions (title, description, max_winners, order_index)
SELECT * FROM (VALUES
  ('President', 'Leads the Student Government and represents the entire student body.', 1, 1),
  ('Vice President', 'Supports the President and oversees committees.', 1, 2),
  ('Secretary', 'Keeps records, minutes, and official communications.', 1, 3),
  ('Treasurer', 'Manages student government finances and budgets.', 1, 4),
  ('Auditor', 'Audits and reviews financial records and expenditures.', 1, 5),
  ('P.I.O', 'Public Information Officer. Handles public relations and communications.', 2, 6),
  ('Business Manager', 'Manages entrepreneurial activities and fundraising.', 1, 7),
  ('Senator', 'Represents the general student body in legislative matters.', 10, 8),
  ('BSIS Governor', 'Represents the BSIS department.', 1, 9),
  ('BPED Governor', 'Represents the BPED department.', 1, 10),
  ('1st Year Representative', 'Represents the 1st Year student body.', 1, 11),
  ('2nd Year Representative', 'Represents the 2nd Year student body.', 1, 12),
  ('3rd Year Representative', 'Represents the 3rd Year student body.', 1, 13),
  ('4th Year Representative', 'Represents the 4th Year student body.', 1, 14)
) AS v(title, description, max_winners, order_index)
WHERE NOT EXISTS (SELECT 1 FROM public.positions LIMIT 1);

INSERT INTO public.candidates (position_id, full_name, party, bio, platform, photo_url, approved)
SELECT p.id, c.name, c.party, c.bio, c.platform, c.photo, true
FROM public.positions p
JOIN (VALUES
  ('President','Alex Rivera','United Students','Senior, Political Science. Former class rep.','Mental health resources, transparent budgeting, sustainable campus.','https://i.pravatar.cc/300?img=12'),
  ('President','Jordan Park','Progress Coalition','Junior, Economics. Debate champion.','Affordable textbooks, expanded library hours, modernized clubs.','https://i.pravatar.cc/300?img=15'),
  ('President','Sam Cruz','Independent','Senior, Engineering.','Hackathons every semester, dorm wifi upgrade, fair grading.','https://i.pravatar.cc/300?img=33'),
  ('Vice President','Maya Chen','United Students','Junior, Biology.','Wellness week, peer tutoring network.','https://i.pravatar.cc/300?img=47'),
  ('Vice President','Devon Hughes','Progress Coalition','Sophomore, History.','Inclusive events, accessibility audit.','https://i.pravatar.cc/300?img=18'),
  ('Vice President','Priya Nair','Independent','Junior, Math.','STEM mentorship, scholarship transparency.','https://i.pravatar.cc/300?img=49'),
  ('Secretary','Liam O''Brien','United Students','Sophomore, English.','Public meeting minutes within 48 hours.','https://i.pravatar.cc/300?img=11'),
  ('Secretary','Aria Thompson','Progress Coalition','Junior, Journalism.','Weekly student government newsletter.','https://i.pravatar.cc/300?img=45'),
  ('Secretary','Noah Patel','Independent','Senior, Communication.','Open records portal for all SG decisions.','https://i.pravatar.cc/300?img=14'),
  ('Treasurer','Sophia Martinez','United Students','Junior, Accounting.','Quarterly budget reports, anti-waste policy.','https://i.pravatar.cc/300?img=44'),
  ('Treasurer','Ethan Kim','Progress Coalition','Senior, Finance.','Grants for small student orgs, fee freeze.','https://i.pravatar.cc/300?img=13'),
  ('Treasurer','Zara Ahmed','Independent','Junior, Business.','Audit committee, line-item budget online.','https://i.pravatar.cc/300?img=48')
) AS c(pos, name, party, bio, platform, photo) ON c.pos = p.title
WHERE NOT EXISTS (SELECT 1 FROM public.candidates LIMIT 1);

INSERT INTO public.elections (title, description, starts_at, ends_at, status)
SELECT 'Student Government General Election 2026', 'Annual general election for all SG positions.',
  now() - interval '1 day', now() + interval '6 days', 'active'
WHERE NOT EXISTS (SELECT 1 FROM public.elections LIMIT 1);

INSERT INTO public.announcements (title, body, pinned)
SELECT * FROM (VALUES
  ('Voting is now OPEN', 'Cast your ballot before the deadline this Friday at 5pm. One vote per student per position.', true),
  ('Meet the Candidates Forum', 'Watch the recorded forum on the Candidates page before you vote.', false),
  ('Need help voting?', 'Visit the registrar''s office or email sg@university.edu for assistance.', false)
) AS v(title, body, pinned)
WHERE NOT EXISTS (SELECT 1 FROM public.announcements LIMIT 1);

-- ============ DEFAULT ADMIN USER SEED ============
-- Email: admin@school.edu
-- Password: Password123
DO $$
DECLARE
  _admin_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE email = 'admin@school.edu') THEN
    INSERT INTO public.users (id, email, password_hash)
    VALUES (_admin_id, 'admin@school.edu', '$2a$10$3Ya31TutZjPUxrHAeOUGDOiVkHAWrkuYNCCCG1tzQqBIVY7fUYiFC');

    INSERT INTO public.profiles (id, student_id, full_name, email, course, year_level, section, is_registered)
    VALUES (_admin_id, 'ADMIN-001', 'Administrator', 'admin@school.edu', 'BSIS', 4, 'A', true);

    INSERT INTO public.user_roles (user_id, role)
    VALUES (_admin_id, 'admin'), (_admin_id, 'student');
  END IF;
END $$;

