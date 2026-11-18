-- ==============================================================================
-- Aconchego Finanças — Migration Incremental 002
-- Hardening para Supabase Security & Performance Advisors (PostgreSQL 17)
-- - Fixa search_path = public em todas as funções trigger
-- - Otimiza políticas RLS com (select auth.uid()) (auth_rls_initplan)
-- - Indexa chaves estrangeiras restantes para performance
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Fixar search_path em funções (mantendo SECURITY INVOKER onde aplicável)
-- ------------------------------------------------------------------------------

ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.prevent_user_id_change() SET search_path = public;
ALTER FUNCTION public.prevent_profile_id_change() SET search_path = public;
ALTER FUNCTION public.apply_goal_contribution_trigger() SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------------------
-- 2. Índices de chaves estrangeiras (Performance Advisor: unindexed_foreign_keys)
-- ------------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_transactions_receipt_id
  ON public.transactions(receipt_id)
  WHERE receipt_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agent_operations_conversation_id
  ON public.agent_operations(conversation_id)
  WHERE conversation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agent_messages_operation_id
  ON public.agent_messages(operation_id)
  WHERE operation_id IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 3. Otimização RLS: (select auth.uid()) para evitar reavaliação por linha
-- ------------------------------------------------------------------------------

-- profiles
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

-- categories
DROP POLICY IF EXISTS "categories_select_own" ON public.categories;
CREATE POLICY "categories_select_own"
  ON public.categories FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "categories_insert_own" ON public.categories;
CREATE POLICY "categories_insert_own"
  ON public.categories FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "categories_update_own" ON public.categories;
CREATE POLICY "categories_update_own"
  ON public.categories FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "categories_delete_own" ON public.categories;
CREATE POLICY "categories_delete_own"
  ON public.categories FOR DELETE
  USING ((select auth.uid()) = user_id);

-- receipts
DROP POLICY IF EXISTS "receipts_select_own" ON public.receipts;
CREATE POLICY "receipts_select_own"
  ON public.receipts FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "receipts_insert_own" ON public.receipts;
CREATE POLICY "receipts_insert_own"
  ON public.receipts FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "receipts_update_own" ON public.receipts;
CREATE POLICY "receipts_update_own"
  ON public.receipts FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "receipts_delete_own" ON public.receipts;
CREATE POLICY "receipts_delete_own"
  ON public.receipts FOR DELETE
  USING ((select auth.uid()) = user_id);

-- transactions
DROP POLICY IF EXISTS "transactions_select_own" ON public.transactions;
CREATE POLICY "transactions_select_own"
  ON public.transactions FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "transactions_insert_own" ON public.transactions;
CREATE POLICY "transactions_insert_own"
  ON public.transactions FOR INSERT
  WITH CHECK (
    (select auth.uid()) = user_id
    AND (
      receipt_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.receipts r
        WHERE r.id = receipt_id AND r.user_id = (select auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "transactions_update_own" ON public.transactions;
CREATE POLICY "transactions_update_own"
  ON public.transactions FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK (
    (select auth.uid()) = user_id
    AND (
      receipt_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.receipts r
        WHERE r.id = receipt_id AND r.user_id = (select auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "transactions_delete_own" ON public.transactions;
CREATE POLICY "transactions_delete_own"
  ON public.transactions FOR DELETE
  USING ((select auth.uid()) = user_id);

-- budgets
DROP POLICY IF EXISTS "budgets_select_own" ON public.budgets;
CREATE POLICY "budgets_select_own"
  ON public.budgets FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "budgets_insert_own" ON public.budgets;
CREATE POLICY "budgets_insert_own"
  ON public.budgets FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "budgets_update_own" ON public.budgets;
CREATE POLICY "budgets_update_own"
  ON public.budgets FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "budgets_delete_own" ON public.budgets;
CREATE POLICY "budgets_delete_own"
  ON public.budgets FOR DELETE
  USING ((select auth.uid()) = user_id);

-- financial_goals
DROP POLICY IF EXISTS "financial_goals_select_own" ON public.financial_goals;
CREATE POLICY "financial_goals_select_own"
  ON public.financial_goals FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "financial_goals_insert_own" ON public.financial_goals;
CREATE POLICY "financial_goals_insert_own"
  ON public.financial_goals FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "financial_goals_update_own" ON public.financial_goals;
CREATE POLICY "financial_goals_update_own"
  ON public.financial_goals FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "financial_goals_delete_own" ON public.financial_goals;
CREATE POLICY "financial_goals_delete_own"
  ON public.financial_goals FOR DELETE
  USING ((select auth.uid()) = user_id);

-- goal_contributions
DROP POLICY IF EXISTS "goal_contributions_select_own" ON public.goal_contributions;
CREATE POLICY "goal_contributions_select_own"
  ON public.goal_contributions FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "goal_contributions_insert_own" ON public.goal_contributions;
CREATE POLICY "goal_contributions_insert_own"
  ON public.goal_contributions FOR INSERT
  WITH CHECK (
    (select auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.financial_goals g
      WHERE g.id = goal_id AND g.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "goal_contributions_delete_own" ON public.goal_contributions;
CREATE POLICY "goal_contributions_delete_own"
  ON public.goal_contributions FOR DELETE
  USING ((select auth.uid()) = user_id);

-- agent_conversations
DROP POLICY IF EXISTS "agent_conversations_select_own" ON public.agent_conversations;
CREATE POLICY "agent_conversations_select_own"
  ON public.agent_conversations FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "agent_conversations_insert_own" ON public.agent_conversations;
CREATE POLICY "agent_conversations_insert_own"
  ON public.agent_conversations FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "agent_conversations_update_own" ON public.agent_conversations;
CREATE POLICY "agent_conversations_update_own"
  ON public.agent_conversations FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "agent_conversations_delete_own" ON public.agent_conversations;
CREATE POLICY "agent_conversations_delete_own"
  ON public.agent_conversations FOR DELETE
  USING ((select auth.uid()) = user_id);

-- agent_operations
DROP POLICY IF EXISTS "agent_operations_select_own" ON public.agent_operations;
CREATE POLICY "agent_operations_select_own"
  ON public.agent_operations FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "agent_operations_insert_own" ON public.agent_operations;
CREATE POLICY "agent_operations_insert_own"
  ON public.agent_operations FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "agent_operations_update_own" ON public.agent_operations;
CREATE POLICY "agent_operations_update_own"
  ON public.agent_operations FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- agent_messages
DROP POLICY IF EXISTS "agent_messages_select_own" ON public.agent_messages;
CREATE POLICY "agent_messages_select_own"
  ON public.agent_messages FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "agent_messages_insert_own" ON public.agent_messages;
CREATE POLICY "agent_messages_insert_own"
  ON public.agent_messages FOR INSERT
  WITH CHECK (
    (select auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.agent_conversations c
      WHERE c.id = conversation_id AND c.user_id = (select auth.uid())
    )
  );

-- storage.objects (buckets privados receipts e goal-images)
DROP POLICY IF EXISTS "storage_private_select_own" ON storage.objects;
CREATE POLICY "storage_private_select_own"
  ON storage.objects FOR SELECT
  USING (
    bucket_id IN ('receipts', 'goal-images')
    AND (select auth.uid())::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "storage_private_insert_own" ON storage.objects;
CREATE POLICY "storage_private_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id IN ('receipts', 'goal-images')
    AND (select auth.uid())::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "storage_private_update_own" ON storage.objects;
CREATE POLICY "storage_private_update_own"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id IN ('receipts', 'goal-images')
    AND (select auth.uid())::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id IN ('receipts', 'goal-images')
    AND (select auth.uid())::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "storage_private_delete_own" ON storage.objects;
CREATE POLICY "storage_private_delete_own"
  ON storage.objects FOR DELETE
  USING (
    bucket_id IN ('receipts', 'goal-images')
    AND (select auth.uid())::text = (storage.foldername(name))[1]
  );
