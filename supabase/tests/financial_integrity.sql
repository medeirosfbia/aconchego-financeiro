-- Executar APENAS em um banco local descartável com as migrations aplicadas.
-- Os testes assumem o papel authenticated para exercitar RLS; tudo sofre ROLLBACK.
BEGIN;
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('10000000-0000-0000-0000-000000000001', 'audit-a@example.invalid', '{}'),
  ('10000000-0000-0000-0000-000000000002', 'audit-b@example.invalid', '{}');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

DO $$
DECLARE
  op_id uuid;
  v_goal_id uuid;
  result jsonb;
  tx_id uuid;
  tx_args jsonb := '{"description":"Auditoria local","amount":85.50,"type":"expense","category":"Alimentação","date":"2026-11-18","account":"Pix","status":"paid"}';
BEGIN
  INSERT INTO public.agent_operations (user_id, operation_type, title, summary, arguments, idempotency_key)
  VALUES (auth.uid(), 'create_transaction', 'Teste', 'Teste', tx_args, 'audit-create') RETURNING id INTO op_id;
  IF EXISTS (SELECT 1 FROM public.transactions WHERE user_id=auth.uid()) THEN
    RAISE EXCEPTION 'Proposta gravou transação antes de confirmar';
  END IF;
  result := public.confirm_agent_operation(op_id, 'confirm');
  tx_id := (result->'mutatedData'->'transaction'->>'id')::uuid;
  IF result->'operation'->>'status' <> 'executed' OR tx_id IS NULL THEN
    RAISE EXCEPTION 'Confirmação não gravou transação';
  END IF;
  result := public.confirm_agent_operation(op_id, 'confirm');
  IF result->>'conflict' IS NULL OR (SELECT count(*) FROM public.transactions) <> 1 THEN
    RAISE EXCEPTION 'Confirmação repetida duplicou transação';
  END IF;

  INSERT INTO public.agent_operations (user_id, operation_type, title, summary, arguments, idempotency_key)
  VALUES (auth.uid(), 'create_transaction', 'Inválida', 'Teste', tx_args || '{"amount":-1}', 'audit-invalid') RETURNING id INTO op_id;
  BEGIN
    PERFORM public.confirm_agent_operation(op_id, 'confirm');
    RAISE EXCEPTION 'Valor negativo foi aceito';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  IF (SELECT status FROM public.agent_operations WHERE id=op_id) <> 'pending_confirmation'
     OR (SELECT count(*) FROM public.transactions) <> 1 THEN
    RAISE EXCEPTION 'Falha financeira não fez rollback atômico';
  END IF;
  result := public.confirm_agent_operation(op_id, 'cancel');
  IF result->'operation'->>'status' <> 'cancelled' THEN RAISE EXCEPTION 'Cancelamento falhou'; END IF;

  INSERT INTO public.agent_operations (user_id, operation_type, title, summary, arguments, idempotency_key)
  VALUES (auth.uid(), 'update_transaction', 'Editar', 'Teste', jsonb_build_object('transactionId',tx_id,'amount',90), 'audit-update') RETURNING id INTO op_id;
  PERFORM public.confirm_agent_operation(op_id, 'confirm');
  IF (SELECT amount FROM public.transactions WHERE id=tx_id) <> 90 THEN RAISE EXCEPTION 'Atualização falhou'; END IF;

  INSERT INTO public.agent_operations (user_id, operation_type, title, summary, arguments, idempotency_key)
  VALUES (auth.uid(), 'update_budget', 'Limite', 'Teste', '{"category":"Alimentação","limit":300}', 'audit-budget') RETURNING id INTO op_id;
  PERFORM public.confirm_agent_operation(op_id, 'confirm');
  IF (SELECT limit_amount FROM public.budgets WHERE category='Alimentação') <> 300 THEN RAISE EXCEPTION 'Orçamento falhou'; END IF;

  INSERT INTO public.financial_goals(user_id,title,target_amount) VALUES (auth.uid(),'Teste',1000) RETURNING id INTO v_goal_id;
  INSERT INTO public.agent_operations (user_id, operation_type, title, summary, arguments, idempotency_key)
  VALUES (auth.uid(), 'goal_contribution', 'Depositar', 'Teste', jsonb_build_object('goalId',v_goal_id,'type','deposit','amount',200), 'audit-deposit') RETURNING id INTO op_id;
  PERFORM public.confirm_agent_operation(op_id, 'confirm');
  INSERT INTO public.goal_contributions(user_id,goal_id,type,amount) VALUES (auth.uid(),v_goal_id,'withdraw',50);
  IF (SELECT current_amount FROM public.financial_goals WHERE id=v_goal_id) <> 150 THEN RAISE EXCEPTION 'Saldo incorreto'; END IF;
  BEGIN
    INSERT INTO public.goal_contributions(user_id,goal_id,type,amount) VALUES (auth.uid(),v_goal_id,'withdraw',999);
    RAISE EXCEPTION 'Saque acima do saldo foi aceito';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Saldo insuficiente no cofrinho para resgate.' THEN RAISE; END IF;
  END;
  DELETE FROM public.goal_contributions WHERE goal_id=v_goal_id;
  IF (SELECT count(*) FROM public.goal_contributions) <> 2 THEN RAISE EXCEPTION 'Histórico foi apagado isoladamente'; END IF;

  INSERT INTO public.agent_operations (user_id, operation_type, title, summary, arguments, idempotency_key)
  VALUES (auth.uid(), 'delete_transaction', 'Excluir', 'Teste', jsonb_build_object('transactionId',tx_id), 'audit-delete') RETURNING id INTO op_id;
  PERFORM public.confirm_agent_operation(op_id, 'confirm');
  IF EXISTS (SELECT 1 FROM public.transactions) THEN RAISE EXCEPTION 'Exclusão falhou'; END IF;
END;
$$;

SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.agent_operations) OR EXISTS (SELECT 1 FROM public.financial_goals) THEN
    RAISE EXCEPTION 'RLS vazou dados da outra conta';
  END IF;
  BEGIN
    INSERT INTO public.receipts(user_id,storage_path,file_hash,mime_type)
    VALUES (auth.uid(),'10000000-0000-0000-0000-000000000001/test.jpg','test','image/jpeg');
    RAISE EXCEPTION 'Caminho de outra conta foi aceito';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$$;
RESET ROLE;
ROLLBACK;
