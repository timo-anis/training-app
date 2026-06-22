-- Timo Training App — Supabase schema: RLS policies, triggers, functions
-- Exported: 2026-06-04
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
  TO public
  USING (auth.uid() = user_id);

-- profiles: users can select/insert/update only their own row
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING      (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

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
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "activity_coach_read" on public.activity_summary
  for select to authenticated using (public.is_accepted_coach(user_id));

create policy "links_coach_select" on public.coach_links
  for select to authenticated using (coach_id = auth.uid());
create policy "links_coach_insert" on public.coach_links
  for insert to authenticated with check (coach_id = auth.uid());
create policy "links_coach_delete" on public.coach_links
  for delete to authenticated using (coach_id = auth.uid() and status <> 'accepted');
create policy "links_invitee_select" on public.coach_links
  for select to authenticated using (
    trainee_id = auth.uid()
    or (status = 'pending'
        and lower(invited_email) = lower(coalesce(auth.jwt() ->> 'email', ''))));

-- accept/revoke go through SECURITY DEFINER RPCs (narrow write surface; no
-- broad UPDATE policy on coach_links). accept binds auth.uid() + JWT email.
create or replace function public.accept_coach_invite(_link_id uuid)
returns public.coach_links language plpgsql security definer set search_path = public as $$
declare _email text; _row public.coach_links;
begin
  _email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if _email = '' then raise exception 'no email claim for current user'; end if;
  begin
    update public.coach_links
       set status='accepted', trainee_id=auth.uid(), accepted_at=now(), revoked_at=null
     where id=_link_id and status='pending' and lower(invited_email)=_email
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
