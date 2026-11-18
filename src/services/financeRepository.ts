import { SupabaseClient } from '@supabase/supabase-js';
import {
  AgentConversation,
  AgentMessage,
  AgentOperationProposal,
  CategoryBudget,
  GoalContribution,
  PiggyBankGoal,
  Transaction,
  UserProfile,
} from '../types/finance';
import { DEFAULT_BUDGETS, INITIAL_GOALS, buildDemoTransactions } from '../data/initialData';
import { applyGoalContribution, fromCents, toCents } from '../utils/financeMath';

export interface LoadedFinanceData {
  profile: UserProfile | null;
  transactions: Transaction[];
  budgets: CategoryBudget[];
  goals: PiggyBankGoal[];
  importedHashes: string[];
}

const DEMO_STORAGE_TXS = 'aconchego_demo_v2_txs';
const DEMO_STORAGE_BUDGETS = 'aconchego_demo_v2_budgets';
const DEMO_STORAGE_GOALS = 'aconchego_demo_v2_goals';
const DEMO_STORAGE_HASHES = 'aconchego_demo_v2_hashes';

function makeId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; mimeType: string; ext: string } {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(dataUrl);
  if (!match) {
    throw new Error('Formato de imagem inválido. Utilize JPG, PNG ou WebP.');
  }
  const mimeType = match[1];
  const base64 = match[2];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  return { bytes, mimeType, ext };
}

function dataUrlToBlob(dataUrl: string): { blob: Blob; mimeType: string; ext: string } {
  const { bytes, mimeType, ext } = dataUrlToBytes(dataUrl);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return { blob: new Blob([copy.buffer], { type: mimeType }), mimeType, ext };
}

export async function computeFileSha256Hex(dataUrlOrBlob: string | Blob): Promise<string> {
  let bytes: Uint8Array;
  if (typeof dataUrlOrBlob === 'string') {
    if (dataUrlOrBlob.startsWith('data:')) {
      bytes = dataUrlToBytes(dataUrlOrBlob).bytes;
    } else {
      bytes = new TextEncoder().encode(dataUrlOrBlob);
    }
  } else {
    bytes = new Uint8Array(await dataUrlOrBlob.arrayBuffer());
  }

  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      const hashBuffer = await crypto.subtle.digest('SHA-256', copy.buffer);
      return Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch {
    // Fallback em contextos sem crypto.subtle
  }
  return `fallback-${bytes.byteLength}`;
}

export interface SaveTransactionInput {
  id?: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  date: string;
  account: Transaction['account'];
  status: Transaction['status'];
  imageUrl?: string;
  receiptId?: string;
  receiptPath?: string;
  notes?: string;
  fileHash?: string;
  documentType?: string;
  extractedPayload?: Record<string, unknown>;
  idempotencyKey?: string;
}

export interface FinanceRepository {
  isDemo: boolean;
  loadAll(): Promise<LoadedFinanceData>;
  saveTransaction(input: SaveTransactionInput): Promise<Transaction>;
  deleteTransaction(id: string): Promise<void>;
  toggleTransactionStatus(tx: Transaction): Promise<Transaction>;
  saveBudget(budget: CategoryBudget): Promise<CategoryBudget>;
  deleteBudget(budget: CategoryBudget): Promise<void>;
  saveGoal(goal: PiggyBankGoal): Promise<PiggyBankGoal>;
  deleteGoal(id: string): Promise<void>;
  contributeToGoal(
    goalId: string,
    type: 'deposit' | 'withdraw',
    amount: number,
    notes?: string
  ): Promise<{ goal: PiggyBankGoal; contribution: GoalContribution }>;
  checkReceiptDuplicate(fileHash: string): Promise<boolean>;
  loadAgentHistory(): Promise<{
    conversations: AgentConversation[];
    messages: AgentMessage[];
    operations: AgentOperationProposal[];
  }>;
  resetDemoData?(): Promise<LoadedFinanceData>;
}

export class SupabaseFinanceRepository implements FinanceRepository {
  isDemo = false;
  private supabase: SupabaseClient;
  private userId: string;
  private userEmail: string;
  private userFullName: string;

  constructor(
    supabase: SupabaseClient,
    user: { id: string; email?: string | null; fullName?: string | null }
  ) {
    this.supabase = supabase;
    this.userId = user.id;
    this.userEmail = user.email || '';
    this.userFullName = user.fullName || '';
  }

  private async signPrivateUrl(bucket: 'receipts' | 'goal-images', path?: string | null): Promise<string | undefined> {
    if (!path) return undefined;
    const { data, error } = await this.supabase.storage.from(bucket).createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) {
      return undefined;
    }
    return data.signedUrl;
  }

  async loadAll(): Promise<LoadedFinanceData> {
    const [profileRes, txRes, budgetRes, goalRes, contribRes, receiptRes] = await Promise.all([
      this.supabase.from('profiles').select('*').eq('id', this.userId).maybeSingle(),
      this.supabase
        .from('transactions')
        .select('*, receipts(id, storage_path, file_hash)')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false }),
      this.supabase.from('budgets').select('*').order('category', { ascending: true }),
      this.supabase.from('financial_goals').select('*').order('created_at', { ascending: true }),
      this.supabase.from('goal_contributions').select('*').order('created_at', { ascending: false }),
      this.supabase.from('receipts').select('file_hash'),
    ]);

    if (txRes.error) throw new Error(`Erro ao carregar transações: ${txRes.error.message}`);
    if (budgetRes.error) throw new Error(`Erro ao carregar orçamentos: ${budgetRes.error.message}`);
    if (goalRes.error) throw new Error(`Erro ao carregar cofrinhos: ${goalRes.error.message}`);

    const profile: UserProfile = {
      id: this.userId,
      email: profileRes.data?.email || this.userEmail,
      fullName: profileRes.data?.full_name || this.userFullName,
      avatarUrl: profileRes.data?.avatar_url || undefined,
    };

    const transactions: Transaction[] = await Promise.all(
      (txRes.data || []).map(async (row: Record<string, unknown>) => {
        const linkedReceipt = row.receipts as { id?: string; storage_path?: string } | null;
        const signed = linkedReceipt?.storage_path
          ? await this.signPrivateUrl('receipts', linkedReceipt.storage_path)
          : undefined;
        return {
          id: String(row.id),
          description: String(row.description),
          amount: Number(row.amount),
          type: row.type as 'income' | 'expense',
          category: String(row.category),
          date: String(row.date),
          account: row.payment_method as Transaction['account'],
          status: row.status as Transaction['status'],
          imageUrl: signed || (row.external_image_url ? String(row.external_image_url) : undefined),
          receiptId: row.receipt_id ? String(row.receipt_id) : undefined,
          receiptPath: linkedReceipt?.storage_path || undefined,
          notes: row.notes ? String(row.notes) : undefined,
          idempotencyKey: row.idempotency_key ? String(row.idempotency_key) : undefined,
          createdAt: row.created_at ? new Date(String(row.created_at)).getTime() : Date.now(),
        };
      })
    );

    const budgets: CategoryBudget[] = (budgetRes.data || []).map((row: Record<string, unknown>) => ({
      id: String(row.id),
      category: String(row.category),
      limit: Number(row.limit_amount),
      period: String(row.period || 'monthly'),
      icon: String(row.icon || 'Receipt'),
      color: String(row.color || '#3F6253'),
      bgColor: String(row.bg_color || '#EEF3F0'),
    }));

    const contribsByGoal = new Map<string, GoalContribution[]>();
    for (const c of contribRes.data || []) {
      const gid = String(c.goal_id);
      const list = contribsByGoal.get(gid) || [];
      list.push({
        id: String(c.id),
        goalId: gid,
        type: c.type as 'deposit' | 'withdraw',
        amount: Number(c.amount),
        notes: c.notes ? String(c.notes) : undefined,
        createdAt: String(c.created_at),
      });
      contribsByGoal.set(gid, list);
    }

    const goals: PiggyBankGoal[] = await Promise.all(
      (goalRes.data || []).map(async (row: Record<string, unknown>) => {
        const imagePath = row.image_path ? String(row.image_path) : undefined;
        const signed = imagePath ? await this.signPrivateUrl('goal-images', imagePath) : undefined;
        return {
          id: String(row.id),
          title: String(row.title),
          targetAmount: Number(row.target_amount),
          currentAmount: Number(row.current_amount),
          targetDate: row.target_date ? String(row.target_date) : undefined,
          imagePath,
          imageUrl: signed || (row.external_image_url ? String(row.external_image_url) : undefined),
          notes: row.notes ? String(row.notes) : undefined,
          color: String(row.color || '#3F6253'),
          contributions: contribsByGoal.get(String(row.id)) || [],
          createdAt: row.created_at ? String(row.created_at) : undefined,
        };
      })
    );

    const importedHashes = (receiptRes.data || []).map((r: { file_hash: string }) => r.file_hash);

    return { profile, transactions, budgets, goals, importedHashes };
  }

  async checkReceiptDuplicate(fileHash: string): Promise<boolean> {
    if (!fileHash) return false;
    const { data, error } = await this.supabase
      .from('receipts')
      .select('id')
      .eq('file_hash', fileHash)
      .maybeSingle();
    if (error) return false;
    return Boolean(data?.id);
  }

  async saveTransaction(input: SaveTransactionInput): Promise<Transaction> {
    let receiptId = input.receiptId;
    let receiptPath = input.receiptPath;
    let externalImageUrl: string | null = null;
    let signedUrl: string | undefined = undefined;

    if (input.imageUrl && input.imageUrl.startsWith('data:image/')) {
      const { blob, mimeType, ext } = dataUrlToBlob(input.imageUrl);
      const fileHash = input.fileHash || (await computeFileSha256Hex(blob));

      if (!input.id) {
        const duplicated = await this.checkReceiptDuplicate(fileHash);
        if (duplicated) {
          throw new Error('Este comprovante já foi importado anteriormente.');
        }
      }

      const storagePath = `${this.userId}/${makeId('receipt')}.${ext}`;
      const { error: uploadErr } = await this.supabase.storage
        .from('receipts')
        .upload(storagePath, blob, { contentType: mimeType, upsert: false });
      if (uploadErr) {
        throw new Error(`Falha ao armazenar comprovante privado: ${uploadErr.message}`);
      }

      const { data: receiptRow, error: receiptErr } = await this.supabase
        .from('receipts')
        .insert({
          user_id: this.userId,
          storage_path: storagePath,
          file_hash: fileHash,
          mime_type: mimeType,
          document_type: input.documentType || 'Comprovante',
          extracted_payload: input.extractedPayload || null,
        })
        .select('*')
        .single();

      if (receiptErr) {
        await this.supabase.storage.from('receipts').remove([storagePath]);
        if (receiptErr.code === '23505') {
          throw new Error('Este comprovante já foi importado anteriormente.');
        }
        throw new Error(`Erro ao registrar metadados do comprovante: ${receiptErr.message}`);
      }

      receiptId = String(receiptRow.id);
      receiptPath = storagePath;
      signedUrl = await this.signPrivateUrl('receipts', storagePath);
    } else if (input.imageUrl && !receiptId) {
      externalImageUrl = input.imageUrl;
    }

    const payload = {
      user_id: this.userId,
      description: input.description.trim(),
      amount: fromCents(toCents(input.amount)),
      type: input.type,
      category: input.category,
      date: input.date,
      payment_method: input.account,
      status: input.status,
      notes: input.notes?.trim() || null,
      receipt_id: receiptId || null,
      external_image_url: externalImageUrl,
      idempotency_key: input.idempotencyKey || makeId('tx-idem'),
    };

    if (input.id) {
      const { data, error } = await this.supabase
        .from('transactions')
        .update({
          description: payload.description,
          amount: payload.amount,
          type: payload.type,
          category: payload.category,
          date: payload.date,
          payment_method: payload.payment_method,
          status: payload.status,
          notes: payload.notes,
          receipt_id: payload.receipt_id,
          external_image_url: payload.external_image_url,
        })
        .eq('id', input.id)
        .select('*')
        .single();

      if (error) throw new Error(`Erro ao atualizar lançamento: ${error.message}`);
      return {
        id: String(data.id),
        description: String(data.description),
        amount: Number(data.amount),
        type: data.type as 'income' | 'expense',
        category: String(data.category),
        date: String(data.date),
        account: data.payment_method as Transaction['account'],
        status: data.status as Transaction['status'],
        imageUrl: signedUrl || input.imageUrl,
        receiptId: receiptId,
        receiptPath,
        notes: data.notes ? String(data.notes) : undefined,
        createdAt: new Date(String(data.created_at)).getTime(),
      };
    }

    const { data, error } = await this.supabase
      .from('transactions')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error('Operação duplicada detectada e bloqueada.');
      }
      throw new Error(`Erro ao salvar lançamento: ${error.message}`);
    }

    return {
      id: String(data.id),
      description: String(data.description),
      amount: Number(data.amount),
      type: data.type as 'income' | 'expense',
      category: String(data.category),
      date: String(data.date),
      account: data.payment_method as Transaction['account'],
      status: data.status as Transaction['status'],
      imageUrl: signedUrl || (data.external_image_url ? String(data.external_image_url) : undefined),
      receiptId: receiptId,
      receiptPath,
      notes: data.notes ? String(data.notes) : undefined,
      idempotencyKey: payload.idempotency_key,
      createdAt: new Date(String(data.created_at)).getTime(),
    };
  }

  async deleteTransaction(id: string): Promise<void> {
    const { error } = await this.supabase.from('transactions').delete().eq('id', id);
    if (error) throw new Error(`Erro ao excluir lançamento: ${error.message}`);
  }

  async toggleTransactionStatus(tx: Transaction): Promise<Transaction> {
    const nextStatus = tx.status === 'paid' ? 'pending' : 'paid';
    const { data, error } = await this.supabase
      .from('transactions')
      .update({ status: nextStatus })
      .eq('id', tx.id)
      .select('*')
      .single();
    if (error) throw new Error(`Erro ao atualizar status: ${error.message}`);
    return { ...tx, status: data.status as Transaction['status'] };
  }

  async saveBudget(budget: CategoryBudget): Promise<CategoryBudget> {
    const period = budget.period || 'monthly';
    const { data, error } = await this.supabase
      .from('budgets')
      .upsert(
        {
          user_id: this.userId,
          category: budget.category,
          period,
          limit_amount: fromCents(toCents(budget.limit)),
          icon: budget.icon,
          color: budget.color,
          bg_color: budget.bgColor,
        },
        { onConflict: 'user_id,category,period' }
      )
      .select('*')
      .single();

    if (error) throw new Error(`Erro ao salvar orçamento: ${error.message}`);
    return {
      id: String(data.id),
      category: String(data.category),
      limit: Number(data.limit_amount),
      period: String(data.period),
      icon: String(data.icon),
      color: String(data.color),
      bgColor: String(data.bg_color),
    };
  }

  async deleteBudget(budget: CategoryBudget): Promise<void> {
    const query = this.supabase.from('budgets').delete();
    const { error } = budget.id
      ? await query.eq('id', budget.id)
      : await query.eq('category', budget.category).eq('period', budget.period || 'monthly');
    if (error) throw new Error(`Erro ao excluir orçamento: ${error.message}`);
  }

  async saveGoal(goal: PiggyBankGoal): Promise<PiggyBankGoal> {
    let imagePath = goal.imagePath || null;
    let externalImageUrl: string | null = null;
    let signedUrl: string | undefined = undefined;

    if (goal.imageUrl && goal.imageUrl.startsWith('data:image/')) {
      const { blob, mimeType, ext } = dataUrlToBlob(goal.imageUrl);
      const storagePath = `${this.userId}/${makeId('goal')}.${ext}`;
      const { error: uploadErr } = await this.supabase.storage
        .from('goal-images')
        .upload(storagePath, blob, { contentType: mimeType, upsert: false });
      if (uploadErr) {
        throw new Error(`Erro ao salvar imagem do cofrinho: ${uploadErr.message}`);
      }
      imagePath = storagePath;
      signedUrl = await this.signPrivateUrl('goal-images', storagePath);
    } else if (goal.imageUrl && !imagePath) {
      externalImageUrl = goal.imageUrl;
    }

    const isUpdate = /^[0-9a-f-]{36}$/i.test(goal.id);

    if (isUpdate) {
      const { data, error } = await this.supabase
        .from('financial_goals')
        .update({
          title: goal.title.trim(),
          target_amount: fromCents(toCents(goal.targetAmount)),
          target_date: goal.targetDate || null,
          image_path: imagePath,
          external_image_url: externalImageUrl,
          notes: goal.notes?.trim() || null,
          color: goal.color || '#3F6253',
        })
        .eq('id', goal.id)
        .select('*')
        .single();
      if (error) throw new Error(`Erro ao atualizar cofrinho: ${error.message}`);
      return {
        ...goal,
        id: String(data.id),
        title: String(data.title),
        targetAmount: Number(data.target_amount),
        currentAmount: Number(data.current_amount),
        imagePath: imagePath || undefined,
        imageUrl: signedUrl || goal.imageUrl,
      };
    }

    const { data, error } = await this.supabase
      .from('financial_goals')
      .insert({
        user_id: this.userId,
        title: goal.title.trim(),
        target_amount: fromCents(toCents(goal.targetAmount)),
        current_amount: fromCents(toCents(goal.currentAmount)),
        target_date: goal.targetDate || null,
        image_path: imagePath,
        external_image_url: externalImageUrl,
        notes: goal.notes?.trim() || null,
        color: goal.color || '#3F6253',
      })
      .select('*')
      .single();

    if (error) throw new Error(`Erro ao criar cofrinho: ${error.message}`);

    return {
      id: String(data.id),
      title: String(data.title),
      targetAmount: Number(data.target_amount),
      currentAmount: Number(data.current_amount),
      targetDate: data.target_date ? String(data.target_date) : undefined,
      imagePath: imagePath || undefined,
      imageUrl: signedUrl || (data.external_image_url ? String(data.external_image_url) : undefined),
      notes: data.notes ? String(data.notes) : undefined,
      color: String(data.color),
      contributions: [],
      createdAt: String(data.created_at),
    };
  }

  async deleteGoal(id: string): Promise<void> {
    const { error } = await this.supabase.from('financial_goals').delete().eq('id', id);
    if (error) throw new Error(`Erro ao excluir cofrinho: ${error.message}`);
  }

  async contributeToGoal(
    goalId: string,
    type: 'deposit' | 'withdraw',
    amount: number,
    notes?: string
  ): Promise<{ goal: PiggyBankGoal; contribution: GoalContribution }> {
    const cleanAmount = fromCents(toCents(amount));
    const { data: contribRow, error: contribErr } = await this.supabase
      .from('goal_contributions')
      .insert({
        user_id: this.userId,
        goal_id: goalId,
        type,
        amount: cleanAmount,
        notes: notes?.trim() || null,
        idempotency_key: makeId('goal-contrib'),
      })
      .select('*')
      .single();

    if (contribErr) {
      throw new Error(contribErr.message);
    }

    const { data: goalRow, error: goalErr } = await this.supabase
      .from('financial_goals')
      .select('*')
      .eq('id', goalId)
      .single();

    if (goalErr) throw new Error(goalErr.message);

    const { data: allContribs } = await this.supabase
      .from('goal_contributions')
      .select('*')
      .eq('goal_id', goalId)
      .order('created_at', { ascending: false });

    const contribution: GoalContribution = {
      id: String(contribRow.id),
      goalId,
      type,
      amount: Number(contribRow.amount),
      notes: contribRow.notes ? String(contribRow.notes) : undefined,
      createdAt: String(contribRow.created_at),
    };

    const imagePath = goalRow.image_path ? String(goalRow.image_path) : undefined;
    const signed = imagePath ? await this.signPrivateUrl('goal-images', imagePath) : undefined;

    const goal: PiggyBankGoal = {
      id: String(goalRow.id),
      title: String(goalRow.title),
      targetAmount: Number(goalRow.target_amount),
      currentAmount: Number(goalRow.current_amount),
      targetDate: goalRow.target_date ? String(goalRow.target_date) : undefined,
      imagePath,
      imageUrl: signed || (goalRow.external_image_url ? String(goalRow.external_image_url) : undefined),
      notes: goalRow.notes ? String(goalRow.notes) : undefined,
      color: String(goalRow.color),
      contributions: (allContribs || []).map((c: Record<string, unknown>) => ({
        id: String(c.id),
        goalId,
        type: c.type as 'deposit' | 'withdraw',
        amount: Number(c.amount),
        notes: c.notes ? String(c.notes) : undefined,
        createdAt: String(c.created_at),
      })),
    };

    return { goal, contribution };
  }

  async loadAgentHistory(): Promise<{
    conversations: AgentConversation[];
    messages: AgentMessage[];
    operations: AgentOperationProposal[];
  }> {
    const [convRes, msgRes, opRes] = await Promise.all([
      this.supabase.from('agent_conversations').select('*').order('updated_at', { ascending: false }),
      this.supabase.from('agent_messages').select('*').order('created_at', { ascending: true }),
      this.supabase.from('agent_operations').select('*').order('created_at', { ascending: false }),
    ]);

    const operations: AgentOperationProposal[] = (opRes.data || []).map((o: Record<string, unknown>) => ({
      id: String(o.id),
      operationType: o.operation_type as AgentOperationProposal['operationType'],
      status: o.status as AgentOperationProposal['status'],
      title: String(o.title),
      summary: String(o.summary),
      arguments: (o.arguments as Record<string, unknown>) || {},
      idempotencyKey: String(o.idempotency_key),
      createdAt: String(o.created_at),
      executedAt: o.executed_at ? String(o.executed_at) : undefined,
      errorMessage: o.error_message ? String(o.error_message) : undefined,
    }));

    const opById = new Map(operations.map((o) => [o.id, o]));

    const conversations: AgentConversation[] = (convRes.data || []).map((c: Record<string, unknown>) => ({
      id: String(c.id),
      title: String(c.title),
      createdAt: String(c.created_at),
      updatedAt: String(c.updated_at),
    }));

    const messages: AgentMessage[] = (msgRes.data || []).map((m: Record<string, unknown>) => ({
      id: String(m.id),
      conversationId: String(m.conversation_id),
      role: m.role as AgentMessage['role'],
      content: String(m.content),
      toolTraces: Array.isArray(m.tool_traces) ? m.tool_traces : [],
      operationProposal: m.operation_id ? opById.get(String(m.operation_id)) : undefined,
      disclaimer: m.disclaimer ? String(m.disclaimer) : undefined,
      createdAt: String(m.created_at),
    }));

    return { conversations, messages, operations };
  }
}

export class DemoFinanceRepository implements FinanceRepository {
  isDemo = true;
  private transactions: Transaction[] = [];
  private budgets: CategoryBudget[] = [];
  private goals: PiggyBankGoal[] = [];
  private importedHashes: string[] = [];

  private loadStorage<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw) as T;
    } catch {
      // ignore storage errors
    }
    return fallback;
  }

  private saveStorage(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore storage errors
    }
  }

  async loadAll(): Promise<LoadedFinanceData> {
    this.transactions = this.loadStorage(DEMO_STORAGE_TXS, buildDemoTransactions());
    this.budgets = this.loadStorage(DEMO_STORAGE_BUDGETS, DEFAULT_BUDGETS);
    this.goals = this.loadStorage(DEMO_STORAGE_GOALS, INITIAL_GOALS);
    this.importedHashes = this.loadStorage(DEMO_STORAGE_HASHES, []);

    return {
      profile: {
        id: 'demo-user',
        email: 'demo@aconchego.local',
        fullName: 'Visitante (Demo)',
      },
      transactions: this.transactions,
      budgets: this.budgets,
      goals: this.goals,
      importedHashes: this.importedHashes,
    };
  }

  async resetDemoData(): Promise<LoadedFinanceData> {
    this.transactions = buildDemoTransactions();
    this.budgets = [...DEFAULT_BUDGETS];
    this.goals = INITIAL_GOALS.map((g) => ({ ...g, contributions: [...(g.contributions || [])] }));
    this.importedHashes = [];
    this.saveStorage(DEMO_STORAGE_TXS, this.transactions);
    this.saveStorage(DEMO_STORAGE_BUDGETS, this.budgets);
    this.saveStorage(DEMO_STORAGE_GOALS, this.goals);
    this.saveStorage(DEMO_STORAGE_HASHES, this.importedHashes);
    return this.loadAll();
  }

  async checkReceiptDuplicate(fileHash: string): Promise<boolean> {
    return this.importedHashes.includes(fileHash);
  }

  async saveTransaction(input: SaveTransactionInput): Promise<Transaction> {
    if (input.fileHash && !input.id && this.importedHashes.includes(input.fileHash)) {
      throw new Error('Este comprovante já foi importado nesta sessão de demonstração.');
    }
    if (input.idempotencyKey && !input.id) {
      const existing = this.transactions.find((t) => t.idempotencyKey === input.idempotencyKey);
      if (existing) return existing;
    }

    if (input.id) {
      let updated: Transaction | null = null;
      this.transactions = this.transactions.map((t) => {
        if (t.id !== input.id) return t;
        updated = {
          ...t,
          description: input.description,
          amount: input.amount,
          type: input.type,
          category: input.category,
          date: input.date,
          account: input.account,
          status: input.status,
          imageUrl: input.imageUrl,
          notes: input.notes,
        };
        return updated;
      });
      this.saveStorage(DEMO_STORAGE_TXS, this.transactions);
      if (!updated) throw new Error('Transação não encontrada.');
      return updated;
    }

    const newTx: Transaction = {
      id: makeId('demo-tx'),
      description: input.description,
      amount: input.amount,
      type: input.type,
      category: input.category,
      date: input.date,
      account: input.account,
      status: input.status,
      imageUrl: input.imageUrl,
      notes: input.notes,
      idempotencyKey: input.idempotencyKey,
      createdAt: Date.now(),
    };
    this.transactions = [newTx, ...this.transactions];
    this.saveStorage(DEMO_STORAGE_TXS, this.transactions);

    if (input.fileHash) {
      this.importedHashes = [...this.importedHashes, input.fileHash];
      this.saveStorage(DEMO_STORAGE_HASHES, this.importedHashes);
    }

    return newTx;
  }

  async deleteTransaction(id: string): Promise<void> {
    this.transactions = this.transactions.filter((t) => t.id !== id);
    this.saveStorage(DEMO_STORAGE_TXS, this.transactions);
  }

  async toggleTransactionStatus(tx: Transaction): Promise<Transaction> {
    const next: Transaction = {
      ...tx,
      status: tx.status === 'paid' ? 'pending' : 'paid',
    };
    this.transactions = this.transactions.map((t) => (t.id === tx.id ? next : t));
    this.saveStorage(DEMO_STORAGE_TXS, this.transactions);
    return next;
  }

  async saveBudget(budget: CategoryBudget): Promise<CategoryBudget> {
    const period = budget.period || 'monthly';
    const nextBudget = { ...budget, period };
    const exists = this.budgets.some(
      (b) => b.category === nextBudget.category && (b.period || 'monthly') === period
    );
    if (exists) {
      this.budgets = this.budgets.map((b) =>
        b.category === nextBudget.category && (b.period || 'monthly') === period ? nextBudget : b
      );
    } else {
      this.budgets = [...this.budgets, nextBudget];
    }
    this.saveStorage(DEMO_STORAGE_BUDGETS, this.budgets);
    return nextBudget;
  }

  async deleteBudget(budget: CategoryBudget): Promise<void> {
    const period = budget.period || 'monthly';
    this.budgets = this.budgets.filter(
      (b) => !(b.category === budget.category && (b.period || 'monthly') === period)
    );
    this.saveStorage(DEMO_STORAGE_BUDGETS, this.budgets);
  }

  async saveGoal(goal: PiggyBankGoal): Promise<PiggyBankGoal> {
    const exists = this.goals.some((g) => g.id === goal.id);
    if (exists) {
      this.goals = this.goals.map((g) => (g.id === goal.id ? goal : g));
    } else {
      this.goals = [...this.goals, goal];
    }
    this.saveStorage(DEMO_STORAGE_GOALS, this.goals);
    return goal;
  }

  async deleteGoal(id: string): Promise<void> {
    this.goals = this.goals.filter((g) => g.id !== id);
    this.saveStorage(DEMO_STORAGE_GOALS, this.goals);
  }

  async contributeToGoal(
    goalId: string,
    type: 'deposit' | 'withdraw',
    amount: number,
    notes?: string
  ): Promise<{ goal: PiggyBankGoal; contribution: GoalContribution }> {
    const target = this.goals.find((g) => g.id === goalId);
    if (!target) throw new Error('Cofrinho não encontrado.');

    const res = applyGoalContribution(target.currentAmount, type, amount);
    if (!res.ok) throw new Error(res.error);

    const contribution: GoalContribution = {
      id: makeId('demo-contrib'),
      goalId,
      type,
      amount,
      notes,
      createdAt: new Date().toISOString(),
    };

    const updatedGoal: PiggyBankGoal = {
      ...target,
      currentAmount: res.nextAmount,
      contributions: [contribution, ...(target.contributions || [])],
    };

    this.goals = this.goals.map((g) => (g.id === goalId ? updatedGoal : g));
    this.saveStorage(DEMO_STORAGE_GOALS, this.goals);
    return { goal: updatedGoal, contribution };
  }

  async loadAgentHistory() {
    return { conversations: [], messages: [], operations: [] };
  }
}
