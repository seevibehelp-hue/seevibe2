
-- 1. wallets: drop permissive update policy
DROP POLICY IF EXISTS "Users can update own wallet" ON public.wallets;
CREATE POLICY "Users can update own wallet" ON public.wallets
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. wallet_transactions: drop the broken "Users view own tx" / "Users insert own tx"
DROP POLICY IF EXISTS "Users view own tx" ON public.wallet_transactions;
DROP POLICY IF EXISTS "Users insert own tx" ON public.wallet_transactions;
-- "Users can view their own transactions" + "Admins can view all transactions" + "Service role can insert" already cover legitimate access.

-- 3. project_messages: fix broken self-referential join
DROP POLICY IF EXISTS "Members can view messages" ON public.project_messages;
DROP POLICY IF EXISTS "Members can send messages" ON public.project_messages;

CREATE POLICY "Members can view messages" ON public.project_messages
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_messages.project_id AND p.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.project_collaborators pc WHERE pc.project_id = project_messages.project_id AND pc.user_id = auth.uid())
  );

CREATE POLICY "Members can send messages" ON public.project_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_messages.project_id AND p.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.project_collaborators pc WHERE pc.project_id = project_messages.project_id AND pc.user_id = auth.uid())
    )
  );

-- 4. project_collaborators: restrict SELECT
DROP POLICY IF EXISTS "Users can view collaborators of accessed projects" ON public.project_collaborators;
CREATE POLICY "Members and owners view collaborators" ON public.project_collaborators
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_collaborators.project_id AND p.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.project_collaborators pc2 WHERE pc2.project_id = project_collaborators.project_id AND pc2.user_id = auth.uid())
  );

-- 5. profiles: hide sensitive columns from other authenticated users via column GRANTs
-- Keep broad SELECT policy (rows) but revoke privileges on sensitive columns from `authenticated`.
REVOKE SELECT (email, contact_info, fcm_token, suspension_reason, suspended_at, is_banned)
  ON public.profiles FROM authenticated, anon;

-- Provide a function so users can fetch their own complete profile (including sensitive cols).
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS SETOF public.profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.profiles WHERE id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.get_my_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;

-- 6. Storage: fix collab_files SELECT
DROP POLICY IF EXISTS "Collab members can view files" ON storage.objects;
CREATE POLICY "Collab members can view files" ON storage.objects
  FOR SELECT TO authenticated
  USING (
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

-- 7. Storage: fix dispute_files SELECT (restrict to dispute parties + admins)
DROP POLICY IF EXISTS "Dispute files are public readable" ON storage.objects;
CREATE POLICY "Dispute parties and admins view files" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'dispute_files'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR owner = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.order_disputes d
        JOIN public.marketplace_orders o ON o.id = d.order_id
        WHERE d.id::text = (storage.foldername(name))[1]
          AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid() OR d.reporter_id = auth.uid())
      )
    )
  );

-- 8. realtime.messages: add restrictive baseline policy
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname='realtime' AND c.relname='messages') THEN
    EXECUTE 'ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated can subscribe to own user topic" ON realtime.messages';
    EXECUTE $p$CREATE POLICY "Authenticated can subscribe to own user topic" ON realtime.messages
      FOR SELECT TO authenticated
      USING (
        (realtime.topic() = ('user:' || auth.uid()::text))
        OR (realtime.topic() LIKE (auth.uid()::text || ':%'))
      )$p$;
  END IF;
END $$;
