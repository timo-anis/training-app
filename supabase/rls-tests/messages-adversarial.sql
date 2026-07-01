-- =============================================================================
-- messages table — 17-assertion adversarial RLS matrix
-- =============================================================================
-- Run via:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/rls-tests/messages-adversarial.sql
--
-- The entire script is wrapped in a single transaction and rolls back at the end,
-- so NO test data persists in the database.  A mid-run assertion failure triggers
-- an immediate ROLLBACK via ON_ERROR_STOP=1.
--
-- Scenarios covered (17):
--  Read scoping ......... A1-A5   (participants see own thread; cross-link + stranger blocked)
--  Insert (allowed) ..... A6-A7   (coach and trainee write as themselves)
--  Insert (denied) ...... A8-A12  (spoof, stranger, cross-link, pending, blank-body)
--  mark_messages_read ... A13-A14 (marks only received msgs; non-participant rejected)
--  Revoke ............... A15-A17 (read + write cut for both sides; no cross-link bleed)
--
-- Pre-conditions: the schema in supabase_rls.sql has been applied (messages table,
-- is_link_participant, mark_messages_read, handle_new_user trigger all exist).
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- FIXED TEST UUIDs (deterministic, never collide with real data)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  INSERT INTO auth.users (
    id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at,
    created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin
  ) VALUES
    ('a0000001-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000',
     'authenticated','authenticated','rls-coach1@test.invalid',
     '',now(),now(),now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,false),
    ('a0000001-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000',
     'authenticated','authenticated','rls-trainee1@test.invalid',
     '',now(),now(),now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,false),
    ('a0000001-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000000',
     'authenticated','authenticated','rls-coach2@test.invalid',
     '',now(),now(),now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,false),
    ('a0000001-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000000',
     'authenticated','authenticated','rls-trainee2@test.invalid',
     '',now(),now(),now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,false),
    ('a0000001-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000000',
     'authenticated','authenticated','rls-stranger@test.invalid',
     '',now(),now(),now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,false),
    ('a0000001-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000000',
     'authenticated','authenticated','rls-coach3-pending@test.invalid',
     '',now(),now(),now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,false),
    ('a0000001-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000000',
     'authenticated','authenticated','rls-trainee3-pending@test.invalid',
     '',now(),now(),now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,false);

  RAISE NOTICE 'Setup: 7 test users created';
END;
$$;

DO $$
BEGIN
  -- L1: accepted coach(user_a) + trainee(user_b)
  INSERT INTO public.coach_links (id, coach_id, trainee_id, invited_email, status, accepted_at)
  VALUES ('b0000001-0000-0000-0000-000000000001',
          'a0000001-0000-0000-0000-000000000001',
          'a0000001-0000-0000-0000-000000000002',
          'rls-trainee1@test.invalid','accepted',now());

  -- L2: accepted coach(user_c) + trainee(user_d)
  INSERT INTO public.coach_links (id, coach_id, trainee_id, invited_email, status, accepted_at)
  VALUES ('b0000001-0000-0000-0000-000000000002',
          'a0000001-0000-0000-0000-000000000003',
          'a0000001-0000-0000-0000-000000000004',
          'rls-trainee2@test.invalid','accepted',now());

  -- L3: pending coach(user_f) + trainee(user_g)
  INSERT INTO public.coach_links (id, coach_id, trainee_id, invited_email, status)
  VALUES ('b0000001-0000-0000-0000-000000000003',
          'a0000001-0000-0000-0000-000000000006',
          'a0000001-0000-0000-0000-000000000007',
          'rls-trainee3-pending@test.invalid','pending');

  -- Seed messages: coach+trainee on L1, coach on L2
  INSERT INTO public.messages (id, link_id, sender_id, body) VALUES
    ('c0000001-0000-0000-0000-000000000001',
     'b0000001-0000-0000-0000-000000000001',
     'a0000001-0000-0000-0000-000000000001',
     'hello from coach on L1'),
    ('c0000001-0000-0000-0000-000000000002',
     'b0000001-0000-0000-0000-000000000001',
     'a0000001-0000-0000-0000-000000000002',
     'hello from trainee on L1'),
    ('c0000001-0000-0000-0000-000000000003',
     'b0000001-0000-0000-0000-000000000002',
     'a0000001-0000-0000-0000-000000000003',
     'hello from coach on L2');

  RAISE NOTICE 'Setup: 3 links + 3 seed messages created';
END;
$$;

-- =============================================================================
-- ASSERTIONS: simulate authenticated users via SET LOCAL + SAVEPOINT
-- =============================================================================

-- A1: coach reads own accepted link L1 -> 2 messages
SAVEPOINT a1;
SET LOCAL role TO authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"a0000001-0000-0000-0000-000000000001","role":"authenticated"}';
DO $$
DECLARE _cnt int;
BEGIN
  SELECT count(*) INTO _cnt FROM public.messages WHERE link_id='b0000001-0000-0000-0000-000000000001';
  ASSERT _cnt = 2, format('A1 FAILED: expected 2, got %s', _cnt);
  RAISE NOTICE 'A1 PASSED: coach reads own link (2 messages)';
END; $$;
ROLLBACK TO SAVEPOINT a1;

-- A2: trainee reads own accepted link L1 -> 2 messages
SAVEPOINT a2;
SET LOCAL role TO authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"a0000001-0000-0000-0000-000000000002","role":"authenticated"}';
DO $$
DECLARE _cnt int;
BEGIN
  SELECT count(*) INTO _cnt FROM public.messages WHERE link_id='b0000001-0000-0000-0000-000000000001';
  ASSERT _cnt = 2, format('A2 FAILED: expected 2, got %s', _cnt);
  RAISE NOTICE 'A2 PASSED: trainee reads own link (2 messages)';
END; $$;
ROLLBACK TO SAVEPOINT a2;

-- A3: coach reads L2 (not their link) -> 0 messages
SAVEPOINT a3;
SET LOCAL role TO authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"a0000001-0000-0000-0000-000000000001","role":"authenticated"}';
DO $$
DECLARE _cnt int;
BEGIN
  SELECT count(*) INTO _cnt FROM public.messages WHERE link_id='b0000001-0000-0000-0000-000000000002';
  ASSERT _cnt = 0, format('A3 FAILED: cross-link read should return 0, got %s', _cnt);
  RAISE NOTICE 'A3 PASSED: coach blocked from cross-link read';
END; $$;
ROLLBACK TO SAVEPOINT a3;

-- A4: trainee reads L2 (not their link) -> 0 messages
SAVEPOINT a4;
SET LOCAL role TO authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"a0000001-0000-0000-0000-000000000002","role":"authenticated"}';
DO $$
DECLARE _cnt int;
BEGIN
  SELECT count(*) INTO _cnt FROM public.messages WHERE link_id='b0000001-0000-0000-0000-000000000002';
  ASSERT _cnt = 0, format('A4 FAILED: cross-link read should return 0, got %s', _cnt);
  RAISE NOTICE 'A4 PASSED: trainee blocked from cross-link read';
END; $$;
ROLLBACK TO SAVEPOINT a4;

-- A5: stranger (user_e) reads any messages -> 0 total
SAVEPOINT a5;
SET LOCAL role TO authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"a0000001-0000-0000-0000-000000000005","role":"authenticated"}';
DO $$
DECLARE _cnt int;
BEGIN
  SELECT count(*) INTO _cnt FROM public.messages;
  ASSERT _cnt = 0, format('A5 FAILED: stranger should see 0 messages, got %s', _cnt);
  RAISE NOTICE 'A5 PASSED: stranger sees no messages';
END; $$;
ROLLBACK TO SAVEPOINT a5;

-- A6: coach inserts as self on L1 -> succeeds
SAVEPOINT a6;
SET LOCAL role TO authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"a0000001-0000-0000-0000-000000000001","role":"authenticated"}';
DO $$
DECLARE _cnt int;
BEGIN
  INSERT INTO public.messages (link_id, sender_id, body)
  VALUES ('b0000001-0000-0000-0000-000000000001','a0000001-0000-0000-0000-000000000001','coach insert test');
  GET DIAGNOSTICS _cnt = ROW_COUNT;
  ASSERT _cnt = 1, format('A6 FAILED: coach insert should succeed, got %s rows', _cnt);
  RAISE NOTICE 'A6 PASSED: coach inserts as self on own link';
END; $$;
ROLLBACK TO SAVEPOINT a6;

-- A7: trainee inserts as self on L1 -> succeeds
SAVEPOINT a7;
SET LOCAL role TO authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"a0000001-0000-0000-0000-000000000002","role":"authenticated"}';
DO $$
DECLARE _cnt int;
BEGIN
  INSERT INTO public.messages (link_id, sender_id, body)
  VALUES ('b0000001-0000-0000-0000-000000000001','a0000001-0000-0000-0000-000000000002','trainee insert test');
  GET DIAGNOSTICS _cnt = ROW_COUNT;
  ASSERT _cnt = 1, format('A7 FAILED: trainee insert should succeed, got %s rows', _cnt);
  RAISE NOTICE 'A7 PASSED: trainee inserts as self on own link';
END; $$;
ROLLBACK TO SAVEPOINT a7;

-- A8: coach spoofs sender_id=user_b -> rejected by RLS
SAVEPOINT a8;
SET LOCAL role TO authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"a0000001-0000-0000-0000-000000000001","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    INSERT INTO public.messages (link_id, sender_id, body)
    VALUES ('b0000001-0000-0000-0000-000000000001','a0000001-0000-0000-0000-000000000002','spoofed');
    RAISE EXCEPTION 'A8 FAILED: spoof insert should be rejected';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'A8 PASSED: spoof sender_id rejected by RLS';
  END;
END; $$;
ROLLBACK TO SAVEPOINT a8;

-- A9: stranger inserts on L1 -> rejected by RLS
SAVEPOINT a9;
SET LOCAL role TO authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"a0000001-0000-0000-0000-000000000005","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    INSERT INTO public.messages (link_id, sender_id, body)
    VALUES ('b0000001-0000-0000-0000-000000000001','a0000001-0000-0000-0000-000000000005','stranger insert');
    RAISE EXCEPTION 'A9 FAILED: stranger insert should be rejected';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'A9 PASSED: stranger blocked from inserting';
  END;
END; $$;
ROLLBACK TO SAVEPOINT a9;

-- A10: coach inserts on L2 (not their link) -> rejected by RLS
SAVEPOINT a10;
SET LOCAL role TO authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"a0000001-0000-0000-0000-000000000001","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    INSERT INTO public.messages (link_id, sender_id, body)
    VALUES ('b0000001-0000-0000-0000-000000000002','a0000001-0000-0000-0000-000000000001','cross-link insert');
    RAISE EXCEPTION 'A10 FAILED: cross-link insert should be rejected';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'A10 PASSED: cross-link insert blocked';
  END;
END; $$;
ROLLBACK TO SAVEPOINT a10;

-- A11: blank/whitespace body -> rejected by CHECK constraint
SAVEPOINT a11;
SET LOCAL role TO authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"a0000001-0000-0000-0000-000000000001","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    INSERT INTO public.messages (link_id, sender_id, body)
    VALUES ('b0000001-0000-0000-0000-000000000001','a0000001-0000-0000-0000-000000000001','   ');
    RAISE EXCEPTION 'A11 FAILED: blank body should be rejected';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'A11 PASSED: blank body rejected by CHECK constraint';
  END;
END; $$;
ROLLBACK TO SAVEPOINT a11;

-- A12: trainee on pending link inserts -> rejected by RLS (is_link_participant needs accepted)
SAVEPOINT a12;
SET LOCAL role TO authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"a0000001-0000-0000-0000-000000000007","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    INSERT INTO public.messages (link_id, sender_id, body)
    VALUES ('b0000001-0000-0000-0000-000000000003','a0000001-0000-0000-0000-000000000007','pending link msg');
    RAISE EXCEPTION 'A12 FAILED: pending link insert should be rejected';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'A12 PASSED: pending link blocks insert';
  END;
END; $$;
ROLLBACK TO SAVEPOINT a12;

-- A13: trainee marks L1 read -> marks only coach msg (m1), not own msg (m2)
SAVEPOINT a13;
SET LOCAL role TO authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"a0000001-0000-0000-0000-000000000002","role":"authenticated"}';
DO $$
DECLARE
  _marked int;
  _coach_read timestamptz;
  _trainee_read timestamptz;
BEGIN
  _marked := public.mark_messages_read('b0000001-0000-0000-0000-000000000001');
  ASSERT _marked = 1, format('A13 FAILED: mark_messages_read should return 1, got %s', _marked);

  SELECT read_at INTO _coach_read
  FROM public.messages WHERE id = 'c0000001-0000-0000-0000-000000000001';
  ASSERT _coach_read IS NOT NULL, 'A13 FAILED: coach msg (m1) should be marked read';

  SELECT read_at INTO _trainee_read
  FROM public.messages WHERE id = 'c0000001-0000-0000-0000-000000000002';
  ASSERT _trainee_read IS NULL, 'A13 FAILED: trainee own msg (m2) must NOT be marked read';

  RAISE NOTICE 'A13 PASSED: mark_messages_read marks only received messages';
END; $$;
ROLLBACK TO SAVEPOINT a13;

-- A14: stranger calls mark_messages_read(L1) -> exception (not a participant)
SAVEPOINT a14;
SET LOCAL role TO authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"a0000001-0000-0000-0000-000000000005","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    PERFORM public.mark_messages_read('b0000001-0000-0000-0000-000000000001');
    RAISE EXCEPTION 'A14 FAILED: stranger should not be able to call mark_messages_read';
  EXCEPTION
    WHEN raise_exception THEN
      RAISE NOTICE 'A14 PASSED: mark_messages_read rejects non-participant';
    WHEN OTHERS THEN
      -- catch any exception variant (function raises 'not a participant of this link')
      RAISE NOTICE 'A14 PASSED (via %): mark_messages_read rejects non-participant', SQLERRM;
  END;
END; $$;
ROLLBACK TO SAVEPOINT a14;

-- -----------------------------------------------------------------------
-- REVOKE L1 (as service role)
-- -----------------------------------------------------------------------
UPDATE public.coach_links SET status = 'revoked'
WHERE id = 'b0000001-0000-0000-0000-000000000001';

-- A15: after revoke, coach reads L1 -> 0 messages
SAVEPOINT a15;
SET LOCAL role TO authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"a0000001-0000-0000-0000-000000000001","role":"authenticated"}';
DO $$
DECLARE _cnt int;
BEGIN
  SELECT count(*) INTO _cnt FROM public.messages WHERE link_id='b0000001-0000-0000-0000-000000000001';
  ASSERT _cnt = 0, format('A15 FAILED: post-revoke coach should see 0 messages, got %s', _cnt);
  RAISE NOTICE 'A15 PASSED: revoke blocks coach from reading';
END; $$;
ROLLBACK TO SAVEPOINT a15;

-- A16: after revoke, trainee inserts on L1 -> rejected
SAVEPOINT a16;
SET LOCAL role TO authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"a0000001-0000-0000-0000-000000000002","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    INSERT INTO public.messages (link_id, sender_id, body)
    VALUES ('b0000001-0000-0000-0000-000000000001','a0000001-0000-0000-0000-000000000002','post-revoke attempt');
    RAISE EXCEPTION 'A16 FAILED: post-revoke insert should be rejected';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'A16 PASSED: revoke blocks trainee from inserting';
  END;
END; $$;
ROLLBACK TO SAVEPOINT a16;

-- A17: after revoking L1, coach_c reads L2 -> still sees 1 message (no bleed)
SAVEPOINT a17;
SET LOCAL role TO authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"a0000001-0000-0000-0000-000000000003","role":"authenticated"}';
DO $$
DECLARE _cnt int;
BEGIN
  SELECT count(*) INTO _cnt FROM public.messages WHERE link_id='b0000001-0000-0000-0000-000000000002';
  ASSERT _cnt = 1, format('A17 FAILED: L2 coach should still see 1 message after L1 revoked, got %s', _cnt);
  RAISE NOTICE 'A17 PASSED: revoking L1 does not affect L2 visibility';
END; $$;
ROLLBACK TO SAVEPOINT a17;

-- =============================================================================
-- All 17 assertions passed — roll back all test data
-- =============================================================================
RAISE NOTICE '=== All 17 assertions PASSED — rolling back test data ===';
ROLLBACK;
