export type TransactionType = 'expense' | 'income';

export type PaymentMethod =
  | 'Cartão de Crédito'
  | 'Conta Corrente'
  | 'Pix'
  | 'Dinheiro'
  | 'Boleto';

export type TransactionStatus = 'paid' | 'pending';

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: TransactionType;
  category: string;
  date: string; // YYYY-MM-DD
  account: PaymentMethod;
  status: TransactionStatus;
  imageUrl?: string; // Signed URL, external URL or preview link
  receiptId?: string;
  receiptPath?: string;
  notes?: string;
  idempotencyKey?: string;
  createdAt: number;
}

export interface CategoryBudget {
  id?: string;
  category: string;
  limit: number;
  period?: string; // 'monthly' or 'YYYY-MM'
  icon: string;
  color: string;
  bgColor: string;
}

export interface GoalContribution {
  id: string;
  goalId: string;
  type: 'deposit' | 'withdraw';
  amount: number;
  notes?: string;
  createdAt: string;
}

export interface PiggyBankGoal {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string;
  imageUrl?: string;
  imagePath?: string;
  notes?: string;
  color: string;
  contributions?: GoalContribution[];
  createdAt?: string;
}

export type ActiveTab =
  | 'overview'
  | 'transactions'
  | 'scan'
  | 'budgets'
  | 'piggybanks'
  | 'receipts'
  | 'assistant';

export type UncertainReceiptField =
  | 'description'
  | 'amount'
  | 'date'
  | 'category'
  | 'account'
  | 'status';

export interface ScannedReceiptResult {
  documentType: string;
  description: string;
  amount: number;
  date: string;
  category: string;
  account: PaymentMethod;
  status: TransactionStatus;
  notes: string;
  confidence: 'alta' | 'media' | 'baixa';
  uncertainFields?: UncertainReceiptField[];
  fileHash?: string;
  isDuplicate?: boolean;
  duplicateTransactionId?: string;
}

export interface ReceiptRecord {
  id: string;
  transactionId?: string;
  storagePath: string;
  fileHash: string;
  mimeType: string;
  documentType?: string;
  signedUrl?: string;
  createdAt: string;
}

export interface FilterState {
  search: string;
  type: 'all' | 'expense' | 'income';
  category: string;
  period: string; // 'all' or 'YYYY-MM'
  status: 'all' | 'paid' | 'pending';
  account: 'all' | PaymentMethod;
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
}

export type AgentOperationType =
  | 'create_transaction'
  | 'update_transaction'
  | 'delete_transaction'
  | 'update_budget'
  | 'goal_contribution';

export type AgentOperationStatus =
  | 'pending_confirmation'
  | 'executed'
  | 'cancelled'
  | 'failed';

export interface AgentOperationProposal {
  id: string;
  operationType: AgentOperationType;
  status: AgentOperationStatus;
  title: string;
  summary: string;
  arguments: Record<string, unknown>;
  idempotencyKey: string;
  createdAt: string;
  executedAt?: string;
  errorMessage?: string;
}

export interface AgentToolCallTrace {
  name: string;
  args: Record<string, unknown>;
  summary?: string;
}

export interface AgentMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolTraces?: AgentToolCallTrace[];
  operationProposal?: AgentOperationProposal;
  disclaimer?: string;
  createdAt: string;
}

export interface AgentConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}
