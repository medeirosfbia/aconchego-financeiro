-- Confirmação e mutação na mesma transação, sob o JWT do usuário e RLS.
-- Não altera registros existentes nem usa SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.confirm_agent_operation(p_operation_id uuid, p_action text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  op public.agent_operations%ROWTYPE;
  args jsonb;
  row_data jsonb;
  mutation jsonb := '{}'::jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária.' USING ERRCODE = '42501';
  END IF;
  IF p_action IS NULL OR p_action NOT IN ('confirm', 'cancel') THEN
    RAISE EXCEPTION 'Ação de confirmação inválida.';
  END IF;

  SELECT * INTO op FROM public.agent_operations
  WHERE id = p_operation_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operação não encontrada ou sem permissão de acesso.';
  END IF;
  IF op.status <> 'pending_confirmation' THEN
    RETURN jsonb_build_object('operation', to_jsonb(op), 'conflict',
      'Operação duplicada bloqueada: esta ação já foi encerrada.');
  END IF;
  IF p_action = 'cancel' THEN
    UPDATE public.agent_operations SET status = 'cancelled'
    WHERE id = op.id RETURNING * INTO op;
    RETURN jsonb_build_object('operation', to_jsonb(op));
  END IF;

  args := op.arguments;
  CASE op.operation_type
    WHEN 'create_transaction' THEN
      INSERT INTO public.transactions (user_id, description, amount, type, category,
        date, payment_method, status, notes, idempotency_key)
      VALUES (auth.uid(), args->>'description', (args->>'amount')::numeric,
        args->>'type', args->>'category', (args->>'date')::date, args->>'account',
        coalesce(args->>'status', 'paid'), args->>'notes', op.idempotency_key)
      RETURNING to_jsonb(transactions.*) INTO row_data;
      mutation := jsonb_build_object('transaction', row_data);
    WHEN 'update_transaction' THEN
      UPDATE public.transactions SET
        description = coalesce(args->>'description', description),
        amount = coalesce((args->>'amount')::numeric, amount),
        type = coalesce(args->>'type', type),
        category = coalesce(args->>'category', category),
        date = coalesce((args->>'date')::date, date),
        payment_method = coalesce(args->>'account', payment_method),
        status = coalesce(args->>'status', status),
        notes = CASE WHEN args ? 'notes' THEN args->>'notes' ELSE notes END
      WHERE id = (args->>'transactionId')::uuid AND user_id = auth.uid()
      RETURNING to_jsonb(transactions.*) INTO row_data;
      IF NOT FOUND THEN RAISE EXCEPTION 'Lançamento não encontrado ou sem permissão.'; END IF;
      mutation := jsonb_build_object('transaction', row_data);
    WHEN 'delete_transaction' THEN
      DELETE FROM public.transactions
      WHERE id = (args->>'transactionId')::uuid AND user_id = auth.uid();
      IF NOT FOUND THEN RAISE EXCEPTION 'Lançamento não encontrado ou sem permissão.'; END IF;
      mutation := jsonb_build_object('deletedTransactionId', args->>'transactionId');
    WHEN 'update_budget' THEN
      INSERT INTO public.budgets (user_id, category, period, limit_amount)
      VALUES (auth.uid(), args->>'category', coalesce(args->>'period', 'monthly'),
        (args->>'limit')::numeric)
      ON CONFLICT (user_id, category, period)
      DO UPDATE SET limit_amount = EXCLUDED.limit_amount
      RETURNING to_jsonb(budgets.*) INTO row_data;
      mutation := jsonb_build_object('budget', row_data);
    WHEN 'goal_contribution' THEN
      INSERT INTO public.goal_contributions (user_id, goal_id, type, amount, notes, idempotency_key)
      VALUES (auth.uid(), (args->>'goalId')::uuid, args->>'type',
        (args->>'amount')::numeric, args->>'notes', op.idempotency_key)
      RETURNING to_jsonb(goal_contributions.*) INTO row_data;
      mutation := jsonb_build_object('contribution', row_data);
    ELSE
      RAISE EXCEPTION 'Tipo de operação não suportado.';
  END CASE;

  -- Se qualquer gravação falhar, o PostgreSQL desfaz também a mudança de status.
  UPDATE public.agent_operations
  SET status = 'executed', executed_at = now(), result = mutation, error_message = NULL
  WHERE id = op.id RETURNING * INTO op;
  RETURN jsonb_build_object('operation', to_jsonb(op), 'mutatedData', mutation);
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_agent_operation(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_agent_operation(uuid, text) TO authenticated;

-- Uma referência válida por UUID também precisa pertencer à mesma conta.
CREATE POLICY agent_operations_owned_conversation
  ON public.agent_operations AS RESTRICTIVE FOR ALL TO authenticated
  USING (true)
  WITH CHECK (conversation_id IS NULL OR EXISTS (
    SELECT 1 FROM public.agent_conversations c
    WHERE c.id = conversation_id AND c.user_id = (select auth.uid())
  ));

CREATE POLICY agent_messages_owned_operation
  ON public.agent_messages AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (operation_id IS NULL OR EXISTS (
    SELECT 1 FROM public.agent_operations o
    WHERE o.id = operation_id AND o.user_id = (select auth.uid())
      AND o.conversation_id = agent_messages.conversation_id
  ));

-- Excluir isoladamente uma contribuição deixava o saldo sem seu histórico.
-- A exclusão de um cofrinho continua usando a cascata da FK.
CREATE POLICY goal_contributions_preserve_ledger
  ON public.goal_contributions AS RESTRICTIVE FOR DELETE TO authenticated
  USING (false);

-- Evita metadados que apontem para o diretório privado de outra conta.
CREATE POLICY receipts_owned_path
  ON public.receipts AS RESTRICTIVE FOR ALL TO authenticated
  USING (true)
  WITH CHECK (split_part(storage_path, '/', 1) = (select auth.uid())::text);
