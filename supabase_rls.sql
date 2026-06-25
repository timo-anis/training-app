-- Timo Training App — Supabase schema: RLS policies, triggers, functions
-- Exported: 2026-06-04
-- Updated: 2026-06-24 (audit fixes: RLS TO public→authenticated, (SELECT auth.uid()) perf pattern, missing FK indexes)
-- Project: krpbqzhttgelrbhkohct (eu-west-1)
--
-- Use this file to recreate the security layer if the Supabase project is ever rebuilt.
-- Run against a fresh project AFTER creating the tables (app_state, app_state_history, profiles).

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- app_state: authenticated users can only access their own row
ALTER TABLE public.app_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_manage_own_app_state"
  ON public.app_state
  FOR ALL
  TO authenticated
  USING      ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- app_state_history: users can read their own history (written only by trigger)
ALTER TABLE public.app_state_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own history read"
  ON public.app_state_history
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- profiles: users can select/insert/update only their own row
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = id);

CREATE POLICY "profiles_insert_own"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING      ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- app_errors: users can only insert their own errors (no client-side read needed)
CREATE TABLE IF NOT EXISTS public.app_errors (
  id          bigserial PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  message     text,
  stack       text,
  url         text,
  app_version text
);

ALTER TABLE public.app_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_insert_own_errors"
  ON public.app_errors
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Auto-create profile + empty app_state row on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;

  insert into public.app_state (user_id, state_json)
  values (new.id, '{}'::jsonb)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- Auto-update updated_at timestamp on row change
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Snapshot previous app_state into history before update/delete
-- Enables point-in-time restore of training data
CREATE OR REPLACE FUNCTION public.snapshot_app_state()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
begin
  if (tg_op = 'DELETE') then
    insert into public.app_state_history (user_id, state_json, reason)
    values (old.user_id, old.state_json, 'delete');
    return old;
  else
    -- only snapshot when the stored state actually changes
    if (new.state_json is distinct from old.state_json) then
      insert into public.app_state_history (user_id, state_json, reason)
      values (old.user_id, old.state_json, 'update');
    end if;
    return new;
  end if;
end;
$$;

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-set updated_at on app_state changes
CREATE TRIGGER set_app_state_updated_at
  BEFORE UPDATE ON public.app_state
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Snapshot app_state before update or delete (version history)
CREATE TRIGGER trg_snapshot_app_state
  BEFORE UPDATE OR DELETE ON public.app_state
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_app_state();

-- Create profile + app_state row when a new auth user is created
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- TRAINER MODE — Track 1 (foundation + read-only visibility)
-- Added 2026-06-22. Purely additive. Proven with an adversarial RLS matrix
-- before any client code (no-link/pending/revoked deny; accepted = SELECT only;
-- revoke cuts within one request; coach can never UPDATE/DELETE a trainee blob;
-- no cross-trainee leakage via a shared coach).
-- Core invariant preserved: ONLY the trainee's client writes the trainee blob.
-- ============================================================

-- coach <-> trainee links. accept binds trainee_id; revoke is instant.
create table if not exists public.coach_links (
  id            uuid primary key default gen_random_uuid(),
  coach_id      uuid not null references auth.users(id) on delete cascade,
  trainee_id    uuid references auth.users(id) on delete cascade,
  invited_email text not null,
  coach_email   text,                          -- display-only (not a security field)
  status        text not null default 'pending'
                  check (status in ('pending','accepted','revoked')),
  created_at    timestamptz not null default now(),
  accepted_at   timestamptz,
  revoked_at    timestamptz
);
create unique index if not exists coach_links_one_accepted_per_trainee
  on public.coach_links (trainee_id) where status = 'accepted';   -- ONE coach per trainee (v1)
create unique index if not exists coach_links_unique_pending_invite
  on public.coach_links (coach_id, lower(invited_email)) where status = 'pending';
create index if not exists coach_links_coach_idx   on public.coach_links (coach_id);
create index if not exists coach_links_trainee_idx on public.coach_links (trainee_id);
create index if not exists coach_links_email_idx   on public.coach_links (lower(invited_email));
alter table public.coach_links enable row level security;

-- Cheap dashboard projection (derived read-model; NEVER a source of truth).
create table if not exists public.activity_summary (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  last_trained_at  timestamptz,
  current_week     int,
  this_week_active boolean not null default false,
  updated_at       timestamptz not null default now()
);
alter table public.activity_summary enable row level security;

-- Helper: is current user the ACCEPTED coach of _trainee? (used in RLS)
create or replace function public.is_accepted_coach(_trainee uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.coach_links l
    where l.coach_id = auth.uid() and l.trainee_id = _trainee and l.status = 'accepted');
$$;
revoke execute on function public.is_accepted_coach(uuid) from public, anon;
grant  execute on function public.is_accepted_coach(uuid) to authenticated;

-- app_state: ADD coach SELECT-only. Owner ALL policy (above) is untouched;
-- permissive policies are OR'd so the owner keeps full access and an accepted
-- coach additionally gains READ. No write path for the coach.
create policy "coach_reads_linked_trainee_state" on public.app_state
  for select to authenticated using (public.is_accepted_coach(user_id));

create policy "activity_owner_all"  on public.activity_summary
  for all to authenticated using ((SELECT auth.uid()) = user_id) with check ((SELECT auth.uid()) = user_id);
create policy "activity_coach_read" on public.activity_summary
  for select to authenticated using (public.is_accepted_coach(user_id));

create policy "links_coach_select" on public.coach_links
  for select to authenticated using (coach_id = (SELECT auth.uid()));
create policy "links_coach_insert" on public.coach_links
  for insert to authenticated with check (coach_id = (SELECT auth.uid()));
create policy "links_coach_delete" on public.coach_links
  for delete to authenticated using (coach_id = (SELECT auth.uid()) and status <> 'accepted');
create policy "links_invitee_select" on public.coach_links
  for select to authenticated using (
    trainee_id = (SELECT auth.uid())
    or (status = 'pending'
        and lower(invited_email) = lower(coalesce((SELECT auth.jwt()) ->> 'email', ''))));

-- accept/revoke go through SECURITY DEFINER RPCs (narrow write surface; no
-- broad UPDATE policy on coach_links). accept binds auth.uid() + JWT email.
create or replace function public.accept_coach_invite(_link_id uuid)
returns public.coach_links language plpgsql security definer set search_path = public as $$
declare _email text; _row public.coach_links; _coach uuid;
begin
  _email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if _email = '' then raise exception 'no email claim for current user'; end if;
  -- You cannot be your own coach (block self-coaching: coach_id == trainee_id).
  select coach_id into _coach from public.coach_links where id = _link_id;
  if _coach = auth.uid() then raise exception 'you cannot be your own coach'; end if;
  begin
    update public.coach_links
       set status='accepted', trainee_id=auth.uid(), accepted_at=now(), revoked_at=null
     where id=_link_id and status='pending'
       and lower(invited_email)=_email
       and coach_id <> auth.uid()
    returning * into _row;
  exception when unique_violation then
    raise exception 'you already have an active coach -- revoke it first';
  end;
  if _row.id is null then raise exception 'invite not found, already used, or not addressed to you'; end if;
  return _row;
end; $$;
revoke execute on function public.accept_coach_invite(uuid) from public, anon;
grant  execute on function public.accept_coach_invite(uuid) to authenticated;

create or replace function public.revoke_coach_link(_link_id uuid)
returns public.coach_links language plpgsql security definer set search_path = public as $$
declare _row public.coach_links;
begin
  update public.coach_links set status='revoked', revoked_at=now()
   where id=_link_id and status in ('pending','accepted')
     and (coach_id = auth.uid() or trainee_id = auth.uid())
  returning * into _row;
  if _row.id is null then raise exception 'link not found or not yours'; end if;
  return _row;
end; $$;
revoke execute on function public.revoke_coach_link(uuid) from public, anon;
grant  execute on function public.revoke_coach_link(uuid) to authenticated;

-- activity_summary maintainer. TRIGGER-ONLY (no EXECUTE grants). Fully guarded:
-- swallows every error so a malformed blob can NEVER break a trainee's save.
create or replace function public.refresh_activity_summary()
returns trigger language plpgsql security definer set search_path = public as $$
declare _cur int; _last timestamptz; _active boolean;
begin
  begin
    select max((e->>'week')::int),
           max((e->>'date')::date) filter (where (e->>'completed') = 'true'),
           coalesce(bool_or((e->>'completed')='true'
             and (e->>'date')::date >= date_trunc('week', now())::date), false)
      into _cur, _last, _active
      from jsonb_array_elements(coalesce(new.state_json->'weeks','[]'::jsonb)) e
      where jsonb_typeof(new.state_json->'weeks') = 'array';
    insert into public.activity_summary(user_id,last_trained_at,current_week,this_week_active,updated_at)
      values (new.user_id, _last, _cur, coalesce(_active,false), now())
    on conflict (user_id) do update
      set last_trained_at=excluded.last_trained_at, current_week=excluded.current_week,
          this_week_active=excluded.this_week_active, updated_at=now();
  exception when others then null; -- never break the trainee's save
  end;
  return new;
end; $$;
revoke execute on function public.refresh_activity_summary() from public, anon, authenticated;
drop trigger if exists trg_refresh_activity_summary on public.app_state;
create trigger trg_refresh_activity_summary
  after insert or update of state_json on public.app_state
  for each row execute function public.refresh_activity_summary();

-- ============================================================
-- TRAINER MODE — Track 2 (coach annotations / async feedback)
-- Added 2026-06-23. Purely additive. ONE primitive (coach_notes) covers BOTH
-- day-level (exercise_id IS NULL) and exercise-level (exercise_id = stable
-- Exercise.id) comments. One-way coach -> trainee. Set-level deferred (spec 9.1).
-- Proven with a 16-assertion adversarial RLS matrix BEFORE any client code.
-- Invariants: single-writer (ONLY the coach writes coach_notes; the trainee can
-- NEVER write a coach row); coach writes only OWN rows AND only while the link is
-- accepted; revoke instantly hides the whole annotation layer from BOTH sides.
-- ============================================================

create table if not exists public.coach_notes (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references auth.users(id) on delete cascade,
  trainee_id  uuid not null references auth.users(id) on delete cascade,
  week        int  not null,
  day         text not null,
  exercise_id text,                                   -- NULL => day-level note
  body        text not null check (length(btrim(body)) > 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- exactly one note per anchor; NULLS NOT DISTINCT makes the day-level anchor
  -- unique too (PG15+; project runs PG17). Doubles as the upsert conflict target.
  constraint coach_notes_anchor_uniq
    unique nulls not distinct (coach_id, trainee_id, week, day, exercise_id)
);
create index if not exists coach_notes_lookup_idx
  on public.coach_notes (trainee_id, week, day);
alter table public.coach_notes enable row level security;

-- Bump updated_at on edit (fires on ON CONFLICT DO UPDATE upserts too).
create or replace function public.touch_coach_notes_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists trg_touch_coach_notes on public.coach_notes;
create trigger trg_touch_coach_notes before update on public.coach_notes
  for each row execute function public.touch_coach_notes_updated_at();

-- Helper: does the CURRENT user (a trainee) have _coach as their accepted coach?
-- Mirror of is_accepted_coach. Leaks nothing: only inspects the caller's own links.
create or replace function public.has_accepted_coach(_coach uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.coach_links l
    where l.coach_id = _coach and l.trainee_id = auth.uid() and l.status = 'accepted');
$$;
revoke execute on function public.has_accepted_coach(uuid) from public, anon;
grant  execute on function public.has_accepted_coach(uuid) to authenticated;

-- Coach: full CRUD, but ONLY own rows AND only while the link is accepted.
create policy "notes_coach_select" on public.coach_notes
  for select to authenticated
  using (coach_id = (SELECT auth.uid()) and public.is_accepted_coach(trainee_id));
create policy "notes_coach_insert" on public.coach_notes
  for insert to authenticated
  with check (coach_id = (SELECT auth.uid()) and public.is_accepted_coach(trainee_id));
create policy "notes_coach_update" on public.coach_notes
  for update to authenticated
  using      (coach_id = (SELECT auth.uid()) and public.is_accepted_coach(trainee_id))
  with check (coach_id = (SELECT auth.uid()) and public.is_accepted_coach(trainee_id));
create policy "notes_coach_delete" on public.coach_notes
  for delete to authenticated
  using (coach_id = (SELECT auth.uid()) and public.is_accepted_coach(trainee_id));

-- Trainee: READ-ONLY, own notes only, only via an accepted link. NO write policy
-- => the trainee can never write a coach row; revoke flips this to invisible.
create policy "notes_trainee_select" on public.coach_notes
  for select to authenticated
  using (trainee_id = (SELECT auth.uid()) and public.has_accepted_coach(coach_id));

-- ============================================================
-- TRAINER MODE — Track 3 (program authoring / coach_assignments)
-- Added 2026-06-23. Purely additive. The coach authors FUTURE days (same
-- exercises[] shape as a workout day). The trainee reads them via an accepted
-- link and MATERIALIZES a day into their OWN blob on first touch (client-side;
-- only the trainee's client writes app_state -> single-writer preserved).
-- One-way coach -> trainee. Reuses is_accepted_coach / has_accepted_coach.
-- Proven with a 15-assertion adversarial RLS matrix BEFORE any client code
-- (coach CRUD own only + only while accepted; assign-to-non-accepted blocked;
-- spoofed coach_id blocked; trainee read-only via accepted link; trainee
-- INSERT/UPDATE/DELETE all denied; no cross-trainee leak via a shared coach;
-- post-revoke BOTH sides see 0 + coach write blocked; single-writer intact —
-- coach can never write a trainee app_state blob).
-- ============================================================

create table if not exists public.coach_assignments (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references auth.users(id) on delete cascade,
  trainee_id  uuid not null references auth.users(id) on delete cascade,
  week        int  not null,
  day         text not null,                       -- DayOfWeek
  payload     jsonb not null,                      -- { exercises: Exercise[] }
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- exactly one prescribed day per anchor; doubles as the upsert conflict target.
  constraint coach_assignments_anchor_uniq unique (coach_id, trainee_id, week, day),
  -- integrity guard: a prescribed day always carries an exercises array.
  constraint coach_assignments_payload_shape
    check (jsonb_typeof(payload->'exercises') = 'array')
);
create index if not exists coach_assignments_lookup_idx
  on public.coach_assignments (trainee_id, week);
alter table public.coach_assignments enable row level security;

-- Bump updated_at on edit (fires on ON CONFLICT DO UPDATE upserts too).
drop trigger if exists trg_touch_coach_assignments on public.coach_assignments;
create trigger trg_touch_coach_assignments before update on public.coach_assignments
  for each row execute function public.set_updated_at();

-- Coach: full CRUD, but ONLY own rows AND only while the link is accepted.
create policy "assign_coach_select" on public.coach_assignments
  for select to authenticated
  using (coach_id = (SELECT auth.uid()) and public.is_accepted_coach(trainee_id));
create policy "assign_coach_insert" on public.coach_assignments
  for insert to authenticated
  with check (coach_id = (SELECT auth.uid()) and public.is_accepted_coach(trainee_id));
create policy "assign_coach_update" on public.coach_assignments
  for update to authenticated
  using      (coach_id = (SELECT auth.uid()) and public.is_accepted_coach(trainee_id))
  with check (coach_id = (SELECT auth.uid()) and public.is_accepted_coach(trainee_id));
create policy "assign_coach_delete" on public.coach_assignments
  for delete to authenticated
  using (coach_id = (SELECT auth.uid()) and public.is_accepted_coach(trainee_id));

-- Trainee: READ-ONLY, own assignments only, only via an accepted link.
-- NO write policy => the trainee can never write a coach row; revoke flips this
-- to invisible (the plan layer vanishes).
create policy "assign_trainee_select" on public.coach_assignments
  for select to authenticated
  using (trainee_id = (SELECT auth.uid()) and public.has_accepted_coach(coach_id));

-- ============================================================
-- TRAINER MODE — Track 4 (chat / relationship layer)
-- Added 2026-06-23. Purely additive. The ONLY two-way layer (notes/assignments
-- stay one-way). One message thread per accepted coach_links row, link-scoped.
-- Both parties read AND write ONLY their own link's messages; sender_id is bound
-- to auth.uid() in the INSERT policy (no spoofing). Messages are immutable from
-- the client (NO update/delete policy) — read receipts go through a narrow
-- SECURITY DEFINER RPC that only marks messages the caller RECEIVED. Revoke
-- instantly cuts chat for BOTH sides (is_link_participant requires
-- status='accepted'). Single-writer preserved: messages is its own table and
-- NEVER touches app_state. Proven BEFORE any client code with a 17-assertion
-- adversarial RLS matrix (read scoping + no cross-link leak; send-as-self only,
-- spoof/stranger/cross-link/pending/blank-body all denied; read receipts mark
-- only received msgs and reject non-participants; revoke kills read+write+
-- mark-read for both sides without leaking into the other link).
-- ============================================================

create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  link_id    uuid not null references public.coach_links(id) on delete cascade,
  sender_id  uuid not null references auth.users(id) on delete cascade,
  body       text not null check (length(btrim(body)) > 0 and length(body) <= 4000),
  created_at timestamptz not null default now(),
  read_at    timestamptz
);
create index if not exists messages_link_created_idx
  on public.messages (link_id, created_at);
create index if not exists messages_unread_idx
  on public.messages (link_id, read_at) where read_at is null;
alter table public.messages enable row level security;

-- Helper: is the CURRENT user a participant (coach OR trainee) of an ACCEPTED
-- link? Mirrors is_accepted_coach / has_accepted_coach. status='accepted' is
-- what makes revoke instant for both sides.
create or replace function public.is_link_participant(_link_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.coach_links l
    where l.id = _link_id
      and l.status = 'accepted'
      and (l.coach_id = auth.uid() or l.trainee_id = auth.uid()));
$$;
revoke execute on function public.is_link_participant(uuid) from public, anon;
grant  execute on function public.is_link_participant(uuid) to authenticated;

-- Both participants may READ the whole thread on their accepted link.
create policy "messages_participant_select" on public.messages
  for select to authenticated
  using (public.is_link_participant(link_id));

-- Both participants may WRITE, but ONLY as themselves (sender bound to
-- auth.uid()) AND only while the link is accepted.
create policy "messages_participant_insert" on public.messages
  for insert to authenticated
  with check (sender_id = (SELECT auth.uid()) and public.is_link_participant(link_id));

-- Read receipts: caller may only mark messages they RECEIVED on a link they
-- currently participate in. Revoke blocks it (is_link_participant = false).
create or replace function public.mark_messages_read(_link_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare _n integer;
begin
  if not public.is_link_participant(_link_id) then
    raise exception 'not a participant of this link';
  end if;
  update public.messages
     set read_at = now()
   where link_id = _link_id
     and sender_id <> auth.uid()
     and read_at is null;
  get diagnostics _n = row_count;
  return _n;
end; $$;
revoke execute on function public.mark_messages_read(uuid) from public, anon;
grant  execute on function public.mark_messages_read(uuid) to authenticated;

-- Realtime: chat is the one layer that genuinely wants live delivery.
-- RLS still applies to realtime for the authenticated role.
alter publication supabase_realtime add table public.messages;

-- ============================================================
-- TRAINER MODE — Track 4 (push enhancement — OFF until validated on device)
-- Added 2026-06-23. Per spec §9.4 push is an ENHANCEMENT, never a dependency:
-- the in-app unread badge is complete without any of this. This table is only a
-- device registry. Strictly own-rows RLS (no coach access), identical to the
-- profiles pattern; the delivery edge function runs as the service role and
-- bypasses RLS to read subscriptions and send. Nothing here touches messages or
-- app_state. Proven with a 4-assertion own-rows adversarial matrix.
-- ============================================================
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
create policy "push_owner_all" on public.push_subscriptions
  for all to authenticated
  using      (user_id = (SELECT auth.uid()))
  with check (user_id = (SELECT auth.uid()));

-- 2026-06-24: add display_name to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT;

-- 2026-06-24: missing FK indexes (P1-5 from holistic audit)
CREATE INDEX IF NOT EXISTS app_errors_user_id_idx ON public.app_errors (user_id);
CREATE INDEX IF NOT EXISTS messages_sender_id_idx ON public.messages (sender_id);

-- ============================================================
-- 2026-06-25: History pruning (migration: prune_app_state_history)
-- ============================================================

-- Index to make the pruning trigger sub-ms on large history tables.
CREATE INDEX IF NOT EXISTS app_state_history_user_captured_idx
  ON public.app_state_history (user_id, captured_at DESC, id DESC);

-- One-time backfill: cap all existing users to 30 rows.
-- (Already applied to live DB on 2026-06-25; idempotent if re-run.)
DELETE FROM public.app_state_history
WHERE id NOT IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY captured_at DESC, id DESC) AS rn
    FROM public.app_state_history
  ) ranked WHERE rn <= 30
);

-- Trigger function: after each INSERT, prune so user never has >30 rows.
CREATE OR REPLACE FUNCTION public.prune_app_state_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.app_state_history
  WHERE user_id = NEW.user_id
    AND id NOT IN (
      SELECT id FROM public.app_state_history
      WHERE user_id = NEW.user_id
      ORDER BY captured_at DESC, id DESC LIMIT 30
    );
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.prune_app_state_history() FROM public, anon, authenticated;

CREATE TRIGGER trg_prune_app_state_history
  AFTER INSERT ON public.app_state_history
  FOR EACH ROW EXECUTE FUNCTION public.prune_app_state_history();

-- ============================================================
-- 2026-06-25: is_coach flag + server-side coach RLS hardening
--             (migration: is_coach_rls_hardening + fix_timo_is_coach_by_uuid)
-- ============================================================

-- Flag on profiles — server-side source of truth for coach identity.
-- Client-side COACH_EMAILS list (src/data/config.ts) must stay in sync.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_coach boolean NOT NULL DEFAULT false;

-- Set existing coaches (identified by UUID to handle null-email profiles).
UPDATE public.profiles SET is_coach = true
  WHERE id = '3547b537-a6bf-4fa2-996a-ef8542e6b714';  -- timo.anis@gmail.com
UPDATE public.profiles SET is_coach = true
  WHERE email IN ('kreete.suvi@gmail.com');

-- Helper callable by authenticated users (used in RLS policies below).
CREATE OR REPLACE FUNCTION public.caller_is_coach()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT is_coach FROM public.profiles WHERE id = auth.uid()), false);
$$;
REVOKE EXECUTE ON FUNCTION public.caller_is_coach() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.caller_is_coach() TO authenticated;

-- coach_links: only is_coach=true users may insert as coach
DROP POLICY IF EXISTS "links_coach_insert" ON public.coach_links;
CREATE POLICY "links_coach_insert" ON public.coach_links
  FOR INSERT TO authenticated
  WITH CHECK (coach_id = (SELECT auth.uid()) AND public.caller_is_coach());

-- coach_notes: only is_coach=true users may write
DROP POLICY IF EXISTS "notes_coach_insert" ON public.coach_notes;
CREATE POLICY "notes_coach_insert" ON public.coach_notes
  FOR INSERT TO authenticated
  WITH CHECK (coach_id = (SELECT auth.uid()) AND public.caller_is_coach());

DROP POLICY IF EXISTS "notes_coach_update" ON public.coach_notes;
CREATE POLICY "notes_coach_update" ON public.coach_notes
  FOR UPDATE TO authenticated
  USING  (coach_id = (SELECT auth.uid()) AND public.caller_is_coach())
  WITH CHECK (coach_id = (SELECT auth.uid()) AND public.caller_is_coach());

DROP POLICY IF EXISTS "notes_coach_delete" ON public.coach_notes;
CREATE POLICY "notes_coach_delete" ON public.coach_notes
  FOR DELETE TO authenticated
  USING (coach_id = (SELECT auth.uid()) AND public.caller_is_coach());

-- coach_assignments: only is_coach=true users may write
DROP POLICY IF EXISTS "assign_coach_insert" ON public.coach_assignments;
CREATE POLICY "assign_coach_insert" ON public.coach_assignments
  FOR INSERT TO authenticated
  WITH CHECK (coach_id = (SELECT auth.uid()) AND public.caller_is_coach());

DROP POLICY IF EXISTS "assign_coach_update" ON public.coach_assignments;
CREATE POLICY "assign_coach_update" ON public.coach_assignments
  FOR UPDATE TO authenticated
  USING  (coach_id = (SELECT auth.uid()) AND public.caller_is_coach())
  WITH CHECK (coach_id = (SELECT auth.uid()) AND public.caller_is_coach());

DROP POLICY IF EXISTS "assign_coach_delete" ON public.coach_assignments;
CREATE POLICY "assign_coach_delete" ON public.coach_assignments
  FOR DELETE TO authenticated
  USING (coach_id = (SELECT auth.uid()) AND public.caller_is_coach());
