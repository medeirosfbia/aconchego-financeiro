-- ==============================================================================
-- Aconchego Finanças — Migration Inicial
-- PostgreSQL + Supabase Auth + RLS + Storage Privado
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------------------------
-- Funções auxiliares de integridade e auditoria
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_user_id_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Alteração de proprietário (user_id) não é permitida.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_profile_id_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Alteração de identificador do perfil não é permitida.';
  END IF;
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------------------------
-- 1. profiles
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL DEFAULT '',
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_profiles_immutable_id
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_id_change();

-- ------------------------------------------------------------------------------
-- 2. categories
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) >= 1),
  kind text NOT NULL CHECK (kind IN ('expense', 'income')),
  icon text NOT NULL DEFAULT 'MoreHorizontal',
  color text NOT NULL DEFAULT '#3F6253',
  bg_color text NOT NULL DEFAULT '#EEF3F0',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_categories_user_name UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_categories_user_id ON public.categories(user_id);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categories_select_own"
  ON public.categories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "categories_insert_own"
  ON public.categories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "categories_update_own"
  ON public.categories FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "categories_delete_own"
  ON public.categories FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_categories_immutable_user
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.prevent_user_id_change();

-- ------------------------------------------------------------------------------
-- 3. receipts
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_hash text NOT NULL,
  mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  document_type text,
  extracted_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_receipts_user_hash UNIQUE (user_id, file_hash)
);

CREATE INDEX IF NOT EXISTS idx_receipts_user_id ON public.receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_receipts_hash ON public.receipts(user_id, file_hash);

ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "receipts_select_own"
  ON public.receipts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "receipts_insert_own"
  ON public.receipts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "receipts_update_own"
  ON public.receipts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "receipts_delete_own"
  ON public.receipts FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_receipts_immutable_user
  BEFORE UPDATE ON public.receipts
  FOR EACH ROW EXECUTE FUNCTION public.prevent_user_id_change();

-- ------------------------------------------------------------------------------
-- 4. transactions
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description text NOT NULL CHECK (char_length(trim(description)) >= 1),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  category text NOT NULL,
  date date NOT NULL,
  payment_method text NOT NULL CHECK (
    payment_method IN ('Cartão de Crédito', 'Conta Corrente', 'Pix', 'Dinheiro', 'Boleto')
  ),
  status text NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'pending')),
  notes text,
  receipt_id uuid REFERENCES public.receipts(id) ON DELETE SET NULL,
  external_image_url text,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_transactions_user_idempotency UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_category ON public.transactions(user_id, category);
CREATE INDEX IF NOT EXISTS idx_transactions_user_status ON public.transactions(user_id, status);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transactions_select_own"
  ON public.transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "transactions_insert_own"
  ON public.transactions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      receipt_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.receipts r
        WHERE r.id = receipt_id AND r.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "transactions_update_own"
  ON public.transactions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (
      receipt_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.receipts r
        WHERE r.id = receipt_id AND r.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "transactions_delete_own"
  ON public.transactions FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_transactions_immutable_user
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_user_id_change();

-- ------------------------------------------------------------------------------
-- 5. budgets
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (char_length(trim(category)) >= 1),
  period text NOT NULL DEFAULT 'monthly' CHECK (
    period = 'monthly' OR period ~ '^\d{4}-\d{2}$'
  ),
  limit_amount numeric(14,2) NOT NULL CHECK (limit_amount > 0),
  icon text NOT NULL DEFAULT 'Receipt',
  color text NOT NULL DEFAULT '#3F6253',
  bg_color text NOT NULL DEFAULT '#EEF3F0',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_budgets_user_cat_period UNIQUE (user_id, category, period)
);

CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON public.budgets(user_id);

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "budgets_select_own"
  ON public.budgets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "budgets_insert_own"
  ON public.budgets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "budgets_update_own"
  ON public.budgets FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "budgets_delete_own"
  ON public.budgets FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_budgets_updated_at
  BEFORE UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_budgets_immutable_user
  BEFORE UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.prevent_user_id_change();

-- ------------------------------------------------------------------------------
-- 6. financial_goals (Cofrinhos)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.financial_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(trim(title)) >= 1),
  target_amount numeric(14,2) NOT NULL CHECK (target_amount > 0),
  current_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
  target_date date,
  image_path text,
  external_image_url text,
  notes text,
  color text NOT NULL DEFAULT '#3F6253',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_goals_user_id ON public.financial_goals(user_id);

ALTER TABLE public.financial_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financial_goals_select_own"
  ON public.financial_goals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "financial_goals_insert_own"
  ON public.financial_goals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "financial_goals_update_own"
  ON public.financial_goals FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "financial_goals_delete_own"
  ON public.financial_goals FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_financial_goals_updated_at
  BEFORE UPDATE ON public.financial_goals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_financial_goals_immutable_user
  BEFORE UPDATE ON public.financial_goals
  FOR EACH ROW EXECUTE FUNCTION public.prevent_user_id_change();

-- ------------------------------------------------------------------------------
-- 7. goal_contributions (Movimentações dos Cofrinhos)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.goal_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id uuid NOT NULL REFERENCES public.financial_goals(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('deposit', 'withdraw')),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  notes text,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_goal_contributions_idempotency UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_goal_contributions_goal ON public.goal_contributions(goal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_goal_contributions_user ON public.goal_contributions(user_id);

ALTER TABLE public.goal_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goal_contributions_select_own"
  ON public.goal_contributions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "goal_contributions_insert_own"
  ON public.goal_contributions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.financial_goals g
      WHERE g.id = goal_id AND g.user_id = auth.uid()
    )
  );

CREATE POLICY "goal_contributions_delete_own"
  ON public.goal_contributions FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_goal_contributions_immutable_user
  BEFORE UPDATE ON public.goal_contributions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_user_id_change();

-- Sincronização atômica do saldo do cofrinho ao inserir depósito/retirada
CREATE OR REPLACE FUNCTION public.apply_goal_contribution_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_current numeric(14,2);
BEGIN
  SELECT current_amount INTO v_current
  FROM public.financial_goals
  WHERE id = NEW.goal_id AND user_id = NEW.user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cofrinho não encontrado ou sem permissão.';
  END IF;

  IF NEW.type = 'withdraw' THEN
    IF NEW.amount > v_current THEN
      RAISE EXCEPTION 'Saldo insuficiente no cofrinho para resgate.';
    END IF;
    UPDATE public.financial_goals
    SET current_amount = current_amount - NEW.amount
    WHERE id = NEW.goal_id AND user_id = NEW.user_id;
  ELSE
    UPDATE public.financial_goals
    SET current_amount = current_amount + NEW.amount
    WHERE id = NEW.goal_id AND user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_apply_goal_contribution
  BEFORE INSERT ON public.goal_contributions
  FOR EACH ROW EXECUTE FUNCTION public.apply_goal_contribution_trigger();

-- ------------------------------------------------------------------------------
-- 8, 9, 10. Agente Financeiro (conversas, mensagens e operações)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.agent_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Conversa com o Assistente',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_conversations_user ON public.agent_conversations(user_id, updated_at DESC);

ALTER TABLE public.agent_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_conversations_select_own"
  ON public.agent_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "agent_conversations_insert_own"
  ON public.agent_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "agent_conversations_update_own"
  ON public.agent_conversations FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "agent_conversations_delete_own"
  ON public.agent_conversations FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_agent_conversations_updated_at
  BEFORE UPDATE ON public.agent_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_agent_conversations_immutable_user
  BEFORE UPDATE ON public.agent_conversations
  FOR EACH ROW EXECUTE FUNCTION public.prevent_user_id_change();

CREATE TABLE IF NOT EXISTS public.agent_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.agent_conversations(id) ON DELETE SET NULL,
  operation_type text NOT NULL CHECK (
    operation_type IN (
      'create_transaction',
      'update_transaction',
      'delete_transaction',
      'update_budget',
      'goal_contribution'
    )
  ),
  status text NOT NULL DEFAULT 'pending_confirmation' CHECK (
    status IN ('pending_confirmation', 'executed', 'cancelled', 'failed')
  ),
  title text NOT NULL,
  summary text NOT NULL,
  arguments jsonb NOT NULL,
  idempotency_key text NOT NULL,
  result jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  executed_at timestamptz,
  CONSTRAINT uq_agent_operations_user_idempotency UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_agent_operations_user_status ON public.agent_operations(user_id, status);

ALTER TABLE public.agent_operations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_operations_select_own"
  ON public.agent_operations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "agent_operations_insert_own"
  ON public.agent_operations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "agent_operations_update_own"
  ON public.agent_operations FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_agent_operations_immutable_user
  BEFORE UPDATE ON public.agent_operations
  FOR EACH ROW EXECUTE FUNCTION public.prevent_user_id_change();

CREATE TABLE IF NOT EXISTS public.agent_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.agent_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  tool_traces jsonb NOT NULL DEFAULT '[]'::jsonb,
  operation_id uuid REFERENCES public.agent_operations(id) ON DELETE SET NULL,
  disclaimer text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_messages_conversation ON public.agent_messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_agent_messages_user ON public.agent_messages(user_id);

ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_messages_select_own"
  ON public.agent_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "agent_messages_insert_own"
  ON public.agent_messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.agent_conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
  );

CREATE TRIGGER trg_agent_messages_immutable_user
  BEFORE UPDATE ON public.agent_messages
  FOR EACH ROW EXECUTE FUNCTION public.prevent_user_id_change();

-- ------------------------------------------------------------------------------
-- Provisionamento inicial seguro de novo usuário (sem dados fictícios)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.categories (user_id, name, kind, icon, color, bg_color, is_default)
  VALUES
    (NEW.id, 'Alimentação', 'expense', 'Utensils', '#E0835D', '#FDF2EB', true),
    (NEW.id, 'Moradia', 'expense', 'Home', '#3F6253', '#EEF3F0', true),
    (NEW.id, 'Transporte', 'expense', 'Car', '#4B739B', '#EEF4F8', true),
    (NEW.id, 'Lazer & Cultura', 'expense', 'Sparkles', '#C27393', '#FDF0F5', true),
    (NEW.id, 'Saúde & Cuidados', 'expense', 'HeartPulse', '#528F75', '#EFF6F2', true),
    (NEW.id, 'Educação', 'expense', 'GraduationCap', '#88629E', '#F5EFF9', true),
    (NEW.id, 'Salário & Renda', 'income', 'Wallet', '#437A5B', '#EDF5F0', true),
    (NEW.id, 'Serviços & Contas', 'expense', 'Receipt', '#C96846', '#FCF1ED', true),
    (NEW.id, 'Outros', 'expense', 'MoreHorizontal', '#717974', '#F4F3F0', true)
  ON CONFLICT (user_id, name) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- Storage Privado para comprovantes e imagens de cofrinhos
-- ------------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('receipts', 'receipts', false, 8388608, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('goal-images', 'goal-images', false, 8388608, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "storage_private_select_own"
  ON storage.objects FOR SELECT
  USING (
    bucket_id IN ('receipts', 'goal-images')
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "storage_private_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id IN ('receipts', 'goal-images')
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "storage_private_update_own"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id IN ('receipts', 'goal-images')
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id IN ('receipts', 'goal-images')
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "storage_private_delete_own"
  ON storage.objects FOR DELETE
  USING (
    bucket_id IN ('receipts', 'goal-images')
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
