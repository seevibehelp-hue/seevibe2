
-- 1. Track one-time demo grant server-side
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS demo_grant_claimed boolean NOT NULL DEFAULT false;

-- 2. Server-tracked ad reward claims (rate limiting)
CREATE TABLE IF NOT EXISTS public.ad_reward_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount_tk numeric NOT NULL DEFAULT 0.1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ad_reward_claims_user_time_idx
  ON public.ad_reward_claims (user_id, created_at DESC);

GRANT SELECT ON public.ad_reward_claims TO authenticated;
GRANT ALL ON public.ad_reward_claims TO service_role;
ALTER TABLE public.ad_reward_claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own ad reward claims" ON public.ad_reward_claims;
CREATE POLICY "Users view own ad reward claims"
  ON public.ad_reward_claims FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 3. RPC: claim one-time demo grant (server-enforced anti-replay)
CREATE OR REPLACE FUNCTION public.claim_demo_grant()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_rows int;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.profiles SET demo_grant_claimed = true
    WHERE id = v_user AND demo_grant_claimed = false;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_claimed');
  END IF;
  PERFORM 1 FROM public.wallets WHERE user_id = v_user FOR UPDATE;
  UPDATE public.wallets
    SET balance_naira = balance_naira + 1000,
        balance_usd  = balance_usd + 0.60,
        updated_at   = now()
    WHERE user_id = v_user;
  INSERT INTO public.wallet_transactions (user_id, type, amount_naira, amount_usd, status, meta)
    VALUES (v_user, 'revenue', 1000, 0.60, 'success',
      jsonb_build_object('description', 'Once-in-a-lifetime Demo Grant'));
  RETURN jsonb_build_object('success', true, 'amount_naira', 1000, 'amount_usd', 0.60);
END; $$;

-- 4. RPC: award rewarded-ad TK (server-tracked 3/hour cap)
CREATE OR REPLACE FUNCTION public.award_ad_reward()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_count int; v_amount numeric := 0.1;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT count(*) INTO v_count FROM public.ad_reward_claims
    WHERE user_id = v_user AND created_at > now() - interval '1 hour';
  IF v_count >= 3 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'rate_limited');
  END IF;
  INSERT INTO public.ad_reward_claims (user_id, amount_tk) VALUES (v_user, v_amount);
  PERFORM 1 FROM public.wallets WHERE user_id = v_user FOR UPDATE;
  UPDATE public.wallets SET tk_balance = tk_balance + v_amount, updated_at = now()
    WHERE user_id = v_user;
  INSERT INTO public.wallet_transactions (user_id, type, amount_naira, amount_usd, status, meta)
    VALUES (v_user, 'revenue', 0, 0, 'success',
      jsonb_build_object('description', 'Rewarded Ad (+0.10 TK)', 'tk_awarded', v_amount));
  RETURN jsonb_build_object('success', true, 'tk_awarded', v_amount);
END; $$;

-- 5. RPC: atomic Naira spend
CREATE OR REPLACE FUNCTION public.spend_wallet_naira(
  p_amount numeric, p_reason text,
  p_description text DEFAULT NULL, p_meta jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_wallet wallets%ROWTYPE; v_rate numeric; v_usd numeric;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  IF p_reason IS NULL OR length(p_reason) = 0 THEN RAISE EXCEPTION 'Reason required'; END IF;
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Wallet not found'; END IF;
  IF v_wallet.balance_naira < p_amount THEN
    RETURN jsonb_build_object('success', false, 'reason', 'insufficient_funds',
      'balance_naira', v_wallet.balance_naira, 'required_naira', p_amount);
  END IF;
  SELECT rate INTO v_rate FROM public.exchange_rates WHERE currency_pair = 'NGN_USD' LIMIT 1;
  v_rate := COALESCE(v_rate, 1600);
  v_usd := ROUND(p_amount / v_rate, 2);
  UPDATE public.wallets
    SET balance_naira = balance_naira - p_amount,
        balance_usd   = GREATEST(0, balance_usd - v_usd),
        updated_at    = now()
    WHERE user_id = v_user;
  INSERT INTO public.wallet_transactions (user_id, type, amount_naira, amount_usd, status, meta)
    VALUES (v_user, p_reason, p_amount, v_usd, 'success',
      COALESCE(p_meta, '{}'::jsonb) || jsonb_build_object('description', p_description));
  RETURN jsonb_build_object('success', true, 'amount_naira', p_amount, 'amount_usd', v_usd);
END; $$;

-- 6. Block client-side wallet balance writes (all changes via RPCs above)
DROP POLICY IF EXISTS "Users can update own wallet" ON public.wallets;

-- 7. Fix studio_project_collaborators self-join privilege escalation
DROP POLICY IF EXISTS "Owners add collaborators" ON public.studio_project_collaborators;
CREATE POLICY "Owners add collaborators"
  ON public.studio_project_collaborators FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.studio_projects sp
      WHERE sp.id = studio_project_collaborators.project_id
        AND sp.user_id = auth.uid()
    )
  );

-- 8. Fix collab_files INSERT: require project membership
DROP POLICY IF EXISTS "Auth users can upload collab files" ON storage.objects;
CREATE POLICY "Members can upload collab files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'collab_files'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.collaboration_members cm
        WHERE cm.user_id = auth.uid()
          AND cm.project_id::text = (storage.foldername(name))[1]
      )
      OR EXISTS (
        SELECT 1 FROM public.collaboration_projects cp
        WHERE cp.owner_id = auth.uid()
          AND cp.id::text = (storage.foldername(name))[1]
      )
    )
  );

-- 9. Gate voice_messages reads (bucket set private via storage tool)
DROP POLICY IF EXISTS "Voice messages publicly readable" ON storage.objects;
CREATE POLICY "Voice message parties can read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'voice_messages'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR (auth.uid())::text = (storage.foldername(name))[1]
    )
  );

-- 10. Restrict profiles: hide sensitive columns from other users
DROP POLICY IF EXISTS "Authenticated can view basic profile info" ON public.profiles;

CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = true) AS
  SELECT id, username, full_name, bio, profile_picture, website_link,
         followers_count, following_count, is_verified, is_premium, created_at
  FROM public.profiles;

GRANT SELECT ON public.public_profiles TO anon, authenticated;
GRANT SELECT (id, username, full_name, bio, profile_picture, website_link,
              followers_count, following_count, is_verified, is_premium, created_at)
  ON public.profiles TO authenticated, anon;

CREATE POLICY "Public safe profile columns readable"
  ON public.profiles FOR SELECT TO authenticated, anon
  USING (true);

-- 11. Revoke EXECUTE from anon on SECURITY DEFINER helpers; re-grant to
--     authenticated for the user-facing RPCs only.
DO $$
DECLARE fn record;
BEGIN
  FOR fn IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon, PUBLIC',
                   fn.proname, fn.args);
  END LOOP;
END $$;

DO $$
DECLARE fn text;
DECLARE user_fns text[] := ARRAY[
  'charge_ai_prompt','pay_tip_with_wallet','purchase_marketplace_with_wallet',
  'purchase_ads_free','purchase_subscription_with_wallet','create_marketplace_order',
  'seller_approve_order','seller_reject_order','buyer_confirm_received',
  'open_dispute','get_seller_trust_stats','get_my_profile',
  'record_tk_earning','join_project_by_token','is_collab_member',
  'is_studio_collaborator','has_role','convert_naira_to_usd',
  'claim_demo_grant','award_ad_reward','spend_wallet_naira'
];
DECLARE r record;
BEGIN
  FOREACH fn IN ARRAY user_fns LOOP
    FOR r IN
      SELECT pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fn
    LOOP
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated', fn, r.args);
    END LOOP;
  END LOOP;
END $$;

-- 12. Remove broad "list all files" SELECT policies on public asset buckets
--     (files remain accessible via CDN URL; API listing is blocked).
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND cmd='SELECT'
      AND (qual ILIKE '%videos%' OR qual ILIKE '%music%'
        OR qual ILIKE '%thumbnails%' OR qual ILIKE '%profile_images%'
        OR qual ILIKE '%marketplace_images%' OR qual ILIKE '%platform-samples%')
      AND qual NOT ILIKE '%auth.uid()%'
      AND qual NOT ILIKE '%has_role%'
      AND qual NOT ILIKE '%EXISTS%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', p.policyname);
  END LOOP;
END $$;
