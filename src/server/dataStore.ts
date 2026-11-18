import crypto from 'crypto';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  AgentMessage,
  AgentOperationProposal,
  AgentOperationType,
  AgentToolCallTrace,
  CategoryBudget,
  PaymentMethod,
  PiggyBankGoal,
  Transaction,
} from '../types/finance.js';
import { DEFAULT_CATEGORIES } from '../data/categories.js';
import { applyGoalContribution, fromCents, toCents } from '../utils/financeMath.js';

export interface ServerFinanceStore {
  readonly userId: string;
  getReceiptHashes(): Promise<string[]>;
  listTransactions(): Promise<Transaction[]>;
  getTransactionById(id: string): Promise<Transaction | null>;
  listBudgets(): Promise<CategoryBudget[]>;
  listGoals(): Promise<PiggyBankGoal[]>;
  getGoalById(id: string): Promise<PiggyBankGoal | null>;
  ensureConversation(conversationId?: string, titleHint?: string): Promise<string>;
  getConversationMessages(conversationId: string): Promise<AgentMessage[]>;
  saveMessage(input: {
    conversationId: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    toolTraces?: AgentToolCallTrace[];
    operationId?: string;
    disclaimer?: string;
  }): Promise<AgentMessage>;
  createPendingOperation(input: {
    conversationId?: string;
    operationType: AgentOperationType;
    title: string;
    summary: string;
    arguments: Record<string, unknown>;
    idempotencyKey: string;
  }): Promise<AgentOperationProposal>;
  getOperationById(operationId: string): Promise<AgentOperationProposal | null>;
  executeOrCancelOperation(
    operationId: string,
    action: 'confirm' | 'cancel'
  ): Promise<{
    operation: AgentOperationProposal;
    conflict?: string;
    mutatedData?: Record<string, unknown>;
  }>;
}

function makeUuid(): string {
  return crypto.randomUUID();
}

export class SupabaseServerFinanceStore implements ServerFinanceStore {
  readonly userId: string;
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient, userId: string) {
    this.supabase = supabase;
    this.userId = userId;
  }

  async getReceiptHashes(): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('receipts')
      .select('file_hash')
      .eq('user_id', this.userId);
    if (error || !data) return [];
    return data.map((r: { file_hash: string }) => r.file_hash);
  }

  async listTransactions(): Promise<Transaction[]> {
    const { data, error } = await this.supabase
      .from('transactions')
      .select('*')
      .eq('user_id', this.userId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Erro ao consultar transações: ${error.message}`);

    return (data || []).map((row: Record<string, unknown>) => ({
      id: String(row.id),
      description: String(row.description),
      amount: Number(row.amount),
      type: row.type as 'income' | 'expense',
      category: String(row.category),
      date: String(row.date),
      account: row.payment_method as PaymentMethod,
      status: row.status as 'paid' | 'pending',
      notes: row.notes ? String(row.notes) : undefined,
      receiptId: row.receipt_id ? String(row.receipt_id) : undefined,
      createdAt: row.created_at ? new Date(String(row.created_at)).getTime() : Date.now(),
    }));
  }

  async getTransactionById(id: string): Promise<Transaction | null> {
    const { data, error } = await this.supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .eq('user_id', this.userId)
      .maybeSingle();
    if (error || !data) return null;

    return {
      id: String(data.id),
      description: String(data.description),
      amount: Number(data.amount),
      type: data.type as 'income' | 'expense',
      category: String(data.category),
      date: String(data.date),
      account: data.payment_method as PaymentMethod,
      status: data.status as 'paid' | 'pending',
      notes: data.notes ? String(data.notes) : undefined,
      receiptId: data.receipt_id ? String(data.receipt_id) : undefined,
      createdAt: data.created_at ? new Date(String(data.created_at)).getTime() : Date.now(),
    };
  }

  async listBudgets(): Promise<CategoryBudget[]> {
    const { data, error } = await this.supabase
      .from('budgets')
      .select('*')
      .eq('user_id', this.userId)
      .order('category', { ascending: true });
    if (error) throw new Error(`Erro ao consultar orçamentos: ${error.message}`);

    return (data || []).map((row: Record<string, unknown>) => ({
      id: String(row.id),
      category: String(row.category),
      limit: Number(row.limit_amount),
      period: String(row.period || 'monthly'),
      icon: String(row.icon || 'Receipt'),
      color: String(row.color || '#3F6253'),
      bgColor: String(row.bg_color || '#EEF3F0'),
    }));
  }

  async listGoals(): Promise<PiggyBankGoal[]> {
    const { data, error } = await this.supabase
      .from('financial_goals')
      .select('*')
      .eq('user_id', this.userId)
      .order('created_at', { ascending: true });
    if (error) throw new Error(`Erro ao consultar cofrinhos: ${error.message}`);

    return (data || []).map((row: Record<string, unknown>) => ({
      id: String(row.id),
      title: String(row.title),
      targetAmount: Number(row.target_amount),
      currentAmount: Number(row.current_amount),
      targetDate: row.target_date ? String(row.target_date) : undefined,
      notes: row.notes ? String(row.notes) : undefined,
      color: String(row.color || '#3F6253'),
    }));
  }

  async getGoalById(id: string): Promise<PiggyBankGoal | null> {
    const { data, error } = await this.supabase
      .from('financial_goals')
      .select('*')
      .eq('id', id)
      .eq('user_id', this.userId)
      .maybeSingle();
    if (error || !data) return null;

    return {
      id: String(data.id),
      title: String(data.title),
      targetAmount: Number(data.target_amount),
      currentAmount: Number(data.current_amount),
      targetDate: data.target_date ? String(data.target_date) : undefined,
      notes: data.notes ? String(data.notes) : undefined,
      color: String(data.color || '#3F6253'),
    };
  }

  async ensureConversation(conversationId?: string, titleHint?: string): Promise<string> {
    if (conversationId) {
      const { data } = await this.supabase
        .from('agent_conversations')
        .select('id')
        .eq('id', conversationId)
        .eq('user_id', this.userId)
        .maybeSingle();
      if (data?.id) {
        return String(data.id);
      }
    }

    const title = (titleHint || 'Nova conversa').slice(0, 80);
    const { data, error } = await this.supabase
      .from('agent_conversations')
      .insert({
        user_id: this.userId,
        title,
      })
      .select('id')
      .single();

    if (error) throw new Error(`Erro ao criar conversa: ${error.message}`);
    return String(data.id);
  }

  async getConversationMessages(conversationId: string): Promise<AgentMessage[]> {
    const { data, error } = await this.supabase
      .from('agent_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('user_id', this.userId)
      .order('created_at', { ascending: true })
      .limit(24);
    if (error || !data) return [];

    return data.map((m: Record<string, unknown>) => ({
      id: String(m.id),
      conversationId: String(m.conversation_id),
      role: m.role as AgentMessage['role'],
      content: String(m.content),
      toolTraces: Array.isArray(m.tool_traces) ? m.tool_traces : [],
      disclaimer: m.disclaimer ? String(m.disclaimer) : undefined,
      createdAt: String(m.created_at),
    }));
  }

  async saveMessage(input: {
    conversationId: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    toolTraces?: AgentToolCallTrace[];
    operationId?: string;
    disclaimer?: string;
  }): Promise<AgentMessage> {
    const { data, error } = await this.supabase
      .from('agent_messages')
      .insert({
        conversation_id: input.conversationId,
        user_id: this.userId,
        role: input.role,
        content: input.content,
        tool_traces: input.toolTraces || [],
        operation_id: input.operationId || null,
        disclaimer: input.disclaimer || null,
      })
      .select('*')
      .single();

    if (error) throw new Error(`Erro ao salvar mensagem: ${error.message}`);

    await this.supabase
      .from('agent_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', input.conversationId)
      .eq('user_id', this.userId);

    return {
      id: String(data.id),
      conversationId: String(data.conversation_id),
      role: data.role as AgentMessage['role'],
      content: String(data.content),
      toolTraces: Array.isArray(data.tool_traces) ? data.tool_traces : [],
      disclaimer: data.disclaimer ? String(data.disclaimer) : undefined,
      createdAt: String(data.created_at),
    };
  }

  async createPendingOperation(input: {
    conversationId?: string;
    operationType: AgentOperationType;
    title: string;
    summary: string;
    arguments: Record<string, unknown>;
    idempotencyKey: string;
  }): Promise<AgentOperationProposal> {
    const { data, error } = await this.supabase
      .from('agent_operations')
      .insert({
        user_id: this.userId,
        conversation_id: input.conversationId || null,
        operation_type: input.operationType,
        status: 'pending_confirmation',
        title: input.title,
        summary: input.summary,
        arguments: input.arguments,
        idempotency_key: input.idempotencyKey,
      })
      .select('*')
      .single();

    if (error) throw new Error(`Erro ao registrar proposta de operação: ${error.message}`);

    return {
      id: String(data.id),
      operationType: data.operation_type as AgentOperationType,
      status: data.status as AgentOperationProposal['status'],
      title: String(data.title),
      summary: String(data.summary),
      arguments: (data.arguments as Record<string, unknown>) || {},
      idempotencyKey: String(data.idempotency_key),
      createdAt: String(data.created_at),
    };
  }

  async getOperationById(operationId: string): Promise<AgentOperationProposal | null> {
    const { data, error } = await this.supabase
      .from('agent_operations')
      .select('*')
      .eq('id', operationId)
      .eq('user_id', this.userId)
      .maybeSingle();
    if (error || !data) return null;

    return {
      id: String(data.id),
      operationType: data.operation_type as AgentOperationType,
      status: data.status as AgentOperationProposal['status'],
      title: String(data.title),
      summary: String(data.summary),
      arguments: (data.arguments as Record<string, unknown>) || {},
      idempotencyKey: String(data.idempotency_key),
      createdAt: String(data.created_at),
      executedAt: data.executed_at ? String(data.executed_at) : undefined,
      errorMessage: data.error_message ? String(data.error_message) : undefined,
    };
  }

  async executeOrCancelOperation(
    operationId: string,
    action: 'confirm' | 'cancel'
  ): Promise<{
    operation: AgentOperationProposal;
    conflict?: string;
    mutatedData?: Record<string, unknown>;
  }> {
    // RPC SECURITY INVOKER: bloqueio da proposta, mutação e status em uma transação.
    const { data, error } = await this.supabase.rpc('confirm_agent_operation', {
      p_operation_id: operationId,
      p_action: action,
    });
    if (error) {
      if (error.code === 'PGRST202') {
        throw new Error('Confirmação indisponível: a migration de confirmação atômica ainda não foi aplicada.');
      }
      throw new Error(error.message);
    }
    const row = data.operation;
    return {
      operation: {
        id: String(row.id),
        operationType: row.operation_type as AgentOperationType,
        status: row.status as AgentOperationProposal['status'],
        title: String(row.title),
        summary: String(row.summary),
        arguments: row.arguments || {},
        idempotencyKey: String(row.idempotency_key),
        createdAt: String(row.created_at),
        executedAt: row.executed_at ? String(row.executed_at) : undefined,
        errorMessage: row.error_message ? String(row.error_message) : undefined,
      },
      conflict: data.conflict,
      mutatedData: data.mutatedData,
    };
  }
}

interface UserMemoryBucket {
  transactions: Transaction[];
  budgets: CategoryBudget[];
  goals: PiggyBankGoal[];
  receiptHashes: string[];
  conversations: Map<string, { id: string; title: string }>;
  messages: AgentMessage[];
  operations: Map<string, AgentOperationProposal>;
}

/**
 * Store isolado por usuário em memória — utilizado em Modo Demonstração e testes de integração.
 * Garante isolamento estrito entre userIds diferentes (User A nunca acessa User B).
 */
export class InMemoryServerFinanceStore implements ServerFinanceStore {
  readonly userId: string;
  private bucket: UserMemoryBucket;

  private static registry = new Map<string, UserMemoryBucket>();

  constructor(
    userId: string,
    initialData?: {
      transactions?: Transaction[];
      budgets?: CategoryBudget[];
      goals?: PiggyBankGoal[];
      receiptHashes?: string[];
    }
  ) {
    this.userId = userId;
    let existing = InMemoryServerFinanceStore.registry.get(userId);
    if (!existing) {
      existing = {
        transactions: initialData?.transactions ? [...initialData.transactions] : [],
        budgets: initialData?.budgets ? [...initialData.budgets] : [],
        goals: initialData?.goals ? [...initialData.goals] : [],
        receiptHashes: initialData?.receiptHashes ? [...initialData.receiptHashes] : [],
        conversations: new Map(),
        messages: [],
        operations: new Map(),
      };
      InMemoryServerFinanceStore.registry.set(userId, existing);
    } else if (initialData) {
      if (initialData.transactions) existing.transactions = [...initialData.transactions];
      if (initialData.budgets) existing.budgets = [...initialData.budgets];
      if (initialData.goals) existing.goals = [...initialData.goals];
      if (initialData.receiptHashes) existing.receiptHashes = [...initialData.receiptHashes];
    }
    this.bucket = existing;
  }

  static clearAll(): void {
    InMemoryServerFinanceStore.registry.clear();
  }

  async getReceiptHashes(): Promise<string[]> {
    return [...this.bucket.receiptHashes];
  }

  async listTransactions(): Promise<Transaction[]> {
    return [...this.bucket.transactions];
  }

  async getTransactionById(id: string): Promise<Transaction | null> {
    return this.bucket.transactions.find((t) => t.id === id) || null;
  }

  async listBudgets(): Promise<CategoryBudget[]> {
    return [...this.bucket.budgets];
  }

  async listGoals(): Promise<PiggyBankGoal[]> {
    return [...this.bucket.goals];
  }

  async getGoalById(id: string): Promise<PiggyBankGoal | null> {
    return this.bucket.goals.find((g) => g.id === id) || null;
  }

  async ensureConversation(conversationId?: string, titleHint?: string): Promise<string> {
    if (conversationId && this.bucket.conversations.has(conversationId)) {
      return conversationId;
    }
    const id = conversationId || makeUuid();
    this.bucket.conversations.set(id, { id, title: (titleHint || 'Conversa').slice(0, 80) });
    return id;
  }

  async getConversationMessages(conversationId: string): Promise<AgentMessage[]> {
    return this.bucket.messages.filter((m) => m.conversationId === conversationId).slice(-24);
  }

  async saveMessage(input: {
    conversationId: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    toolTraces?: AgentToolCallTrace[];
    operationId?: string;
    disclaimer?: string;
  }): Promise<AgentMessage> {
    const msg: AgentMessage = {
      id: makeUuid(),
      conversationId: input.conversationId,
      role: input.role,
      content: input.content,
      toolTraces: input.toolTraces,
      operationProposal: input.operationId
        ? this.bucket.operations.get(input.operationId)
        : undefined,
      disclaimer: input.disclaimer,
      createdAt: new Date().toISOString(),
    };
    this.bucket.messages.push(msg);
    return msg;
  }

  async createPendingOperation(input: {
    conversationId?: string;
    operationType: AgentOperationType;
    title: string;
    summary: string;
    arguments: Record<string, unknown>;
    idempotencyKey: string;
  }): Promise<AgentOperationProposal> {
    const op: AgentOperationProposal = {
      id: makeUuid(),
      operationType: input.operationType,
      status: 'pending_confirmation',
      title: input.title,
      summary: input.summary,
      arguments: input.arguments,
      idempotencyKey: input.idempotencyKey,
      createdAt: new Date().toISOString(),
    };
    this.bucket.operations.set(op.id, op);
    return op;
  }

  async getOperationById(operationId: string): Promise<AgentOperationProposal | null> {
    return this.bucket.operations.get(operationId) || null;
  }

  async executeOrCancelOperation(
    operationId: string,
    action: 'confirm' | 'cancel'
  ): Promise<{
    operation: AgentOperationProposal;
    conflict?: string;
    mutatedData?: Record<string, unknown>;
  }> {
    const existing = this.bucket.operations.get(operationId);
    if (!existing) {
      throw new Error('Operação não encontrada ou sem permissão de acesso.');
    }
    if (existing.status !== 'pending_confirmation') {
      return {
        operation: existing,
        conflict:
          existing.status === 'executed'
            ? 'Esta operação já foi confirmada e executada anteriormente.'
            : 'Esta operação já foi encerrada e não pode ser executada novamente.',
      };
    }

    if (action === 'cancel') {
      const updated: AgentOperationProposal = { ...existing, status: 'cancelled' };
      this.bucket.operations.set(operationId, updated);
      return { operation: updated };
    }

    const args = existing.arguments;
    let mutatedData: Record<string, unknown> = {};

    if (existing.operationType === 'create_transaction') {
      const tx: Transaction = {
        id: makeUuid(),
        description: String(args.description),
        amount: fromCents(toCents(Number(args.amount))),
        type: args.type as 'income' | 'expense',
        category: String(args.category),
        date: String(args.date),
        account: args.account as PaymentMethod,
        status: (args.status as 'paid' | 'pending') || 'paid',
        notes: args.notes ? String(args.notes) : undefined,
        idempotencyKey: existing.idempotencyKey,
        createdAt: Date.now(),
      };
      this.bucket.transactions.unshift(tx);
      mutatedData = { transaction: tx };
    } else if (existing.operationType === 'update_transaction') {
      const txId = String(args.transactionId);
      const target = this.bucket.transactions.find((t) => t.id === txId);
      if (!target) throw new Error('Transação não encontrada para edição.');
      const updatedTx: Transaction = {
        ...target,
        ...(args.description !== undefined ? { description: String(args.description) } : {}),
        ...(args.amount !== undefined ? { amount: fromCents(toCents(Number(args.amount))) } : {}),
        ...(args.type !== undefined ? { type: args.type as 'income' | 'expense' } : {}),
        ...(args.category !== undefined ? { category: String(args.category) } : {}),
        ...(args.date !== undefined ? { date: String(args.date) } : {}),
        ...(args.account !== undefined ? { account: args.account as PaymentMethod } : {}),
        ...(args.status !== undefined ? { status: args.status as 'paid' | 'pending' } : {}),
        ...(args.notes !== undefined ? { notes: String(args.notes) } : {}),
      };
      this.bucket.transactions = this.bucket.transactions.map((t) =>
        t.id === txId ? updatedTx : t
      );
      mutatedData = { transaction: updatedTx };
    } else if (existing.operationType === 'delete_transaction') {
      const txId = String(args.transactionId);
      const exists = this.bucket.transactions.some((t) => t.id === txId);
      if (!exists) throw new Error('Transação não encontrada para exclusão.');
      this.bucket.transactions = this.bucket.transactions.filter((t) => t.id !== txId);
      mutatedData = { deletedTransactionId: txId };
    } else if (existing.operationType === 'update_budget') {
      const cat = String(args.category);
      const period = String(args.period || 'monthly');
      const catMeta = DEFAULT_CATEGORIES.find((c) => c.name === cat);
      const nextBudget: CategoryBudget = {
        id: makeUuid(),
        category: cat,
        limit: fromCents(toCents(Number(args.limit))),
        period,
        icon: catMeta?.icon || 'Receipt',
        color: catMeta?.color || '#3F6253',
        bgColor: catMeta?.bgColor || '#EEF3F0',
      };
      const idx = this.bucket.budgets.findIndex(
        (b) => b.category === cat && (b.period || 'monthly') === period
      );
      if (idx >= 0) {
        this.bucket.budgets[idx] = nextBudget;
      } else {
        this.bucket.budgets.push(nextBudget);
      }
      mutatedData = { budget: nextBudget };
    } else if (existing.operationType === 'goal_contribution') {
      const goalId = String(args.goalId);
      const goal = this.bucket.goals.find((g) => g.id === goalId);
      if (!goal) throw new Error('Cofrinho não encontrado.');
      const contribType = args.type as 'deposit' | 'withdraw';
      const amount = fromCents(toCents(Number(args.amount)));
      const applied = applyGoalContribution(goal.currentAmount, contribType, amount);
      if (!applied.ok) throw new Error(applied.error);
      const contrib = {
        id: makeUuid(),
        goalId,
        type: contribType,
        amount,
        notes: args.notes ? String(args.notes) : 'Movimentação via Assistente IA',
        createdAt: new Date().toISOString(),
      };
      const updatedGoal: PiggyBankGoal = {
        ...goal,
        currentAmount: applied.nextAmount,
        contributions: [contrib, ...(goal.contributions || [])],
      };
      this.bucket.goals = this.bucket.goals.map((g) => (g.id === goalId ? updatedGoal : g));
      mutatedData = { goal: updatedGoal, contribution: contrib };
    }

    const executed: AgentOperationProposal = {
      ...existing,
      status: 'executed',
      executedAt: new Date().toISOString(),
    };
    this.bucket.operations.set(operationId, executed);

    return { operation: executed, mutatedData };
  }
}
