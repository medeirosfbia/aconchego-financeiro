import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Session } from '@supabase/supabase-js';
import { RotateCcw, AlertCircle, RefreshCw, FlaskConical, LogOut } from 'lucide-react';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { TransactionsView } from './components/TransactionsView';
import { BudgetsView } from './components/BudgetsView';
import { PiggyBanksView } from './components/PiggyBanksView';
import { ReceiptsGalleryView } from './components/ReceiptsGalleryView';
import { ConfirmScannedExpenseInput, ScanReceiptView } from './components/ScanReceiptView';
import { AgentAssistantView } from './components/AgentAssistantView';
import { AuthMode, AuthView } from './components/AuthView';
import { TransactionModal } from './components/TransactionModal';
import { PiggyBankModal } from './components/PiggyBankModal';
import { BudgetModal } from './components/BudgetModal';
import { ImageLightboxModal } from './components/ImageLightboxModal';
import { ConfirmationModal } from './components/ConfirmationModal';
import { getSupabaseClient } from './lib/supabase';
import {
  DemoFinanceRepository,
  FinanceRepository,
  SupabaseFinanceRepository,
} from './services/financeRepository';
import {
  ActiveTab,
  AgentMessage,
  AgentOperationProposal,
  CategoryBudget,
  PiggyBankGoal,
  Transaction,
  TransactionType,
  UserProfile,
} from './types/finance';
import { getCurrentYearMonth } from './utils/formatters';

interface AppProps {
  initialDemoMode?: boolean;
  injectedRepository?: FinanceRepository;
}

export default function App({
  initialDemoMode = false,
  injectedRepository,
}: AppProps) {
  // Auth & Mode State
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(Boolean(injectedRepository || initialDemoMode));
  const [authModeOverride, setAuthModeOverride] = useState<AuthMode | null>(null);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(initialDemoMode);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // Navigation & Period
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [currentMonth, setCurrentMonth] = useState<string>(() => getCurrentYearMonth());

  // Financial State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<CategoryBudget[]>([]);
  const [goals, setGoals] = useState<PiggyBankGoal[]>([]);
  const [importedHashes, setImportedHashes] = useState<string[]>([]);
  const [agentHistory, setAgentHistory] = useState<{
    conversationId?: string;
    messages: AgentMessage[];
  }>({ messages: [] });

  // Async UX State
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
  const [dataError, setDataError] = useState<string | null>(null);

  // Modals State
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [defaultTxType, setDefaultTxType] = useState<TransactionType>('expense');
  const [defaultImageUrl, setDefaultImageUrl] = useState<string>('');

  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<PiggyBankGoal | null>(null);
  const [goalModalMode, setGoalModalMode] = useState<'edit' | 'deposit' | 'withdraw'>('edit');

  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<CategoryBudget | null>(null);

  const [lightboxState, setLightboxState] = useState<{
    isOpen: boolean;
    imageUrl?: string;
    title?: string;
    transaction?: Transaction | null;
  }>({ isOpen: false });

  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  const repositoryRef = useRef<FinanceRepository | null>(injectedRepository || null);

  // Build active repository based on mode/session
  const resolveRepository = useCallback((): FinanceRepository | null => {
    if (injectedRepository) {
      repositoryRef.current = injectedRepository;
      return injectedRepository;
    }
    if (isDemoMode) {
      if (!repositoryRef.current || !repositoryRef.current.isDemo) {
        repositoryRef.current = new DemoFinanceRepository();
      }
      return repositoryRef.current;
    }
    const supabase = getSupabaseClient();
    if (supabase && session?.user) {
      repositoryRef.current = new SupabaseFinanceRepository(supabase, {
        id: session.user.id,
        email: session.user.email,
        fullName:
          (session.user.user_metadata?.full_name as string | undefined) || undefined,
      });
      return repositoryRef.current;
    }
    repositoryRef.current = null;
    return null;
  }, [injectedRepository, isDemoMode, session]);

  const loadAllData = useCallback(async () => {
    const repo = resolveRepository();
    if (!repo) return;

    setIsLoadingData(true);
    setDataError(null);
    try {
      const [loaded, history] = await Promise.all([
        repo.loadAll(),
        repo.loadAgentHistory(),
      ]);
      setUserProfile(loaded.profile);
      setTransactions(loaded.transactions);
      setBudgets(loaded.budgets);
      setGoals(loaded.goals);
      setImportedHashes(loaded.importedHashes);
      setAgentHistory({
        conversationId: history.conversations[0]?.id,
        messages: history.conversations[0]?.id
          ? history.messages.filter((m) => m.conversationId === history.conversations[0].id)
          : [],
      });
    } catch (err) {
      setDataError(
        err instanceof Error
          ? err.message
          : 'Não foi possível carregar seus dados financeiros.'
      );
    } finally {
      setIsLoadingData(false);
    }
  }, [resolveRepository]);

  // Listen to Supabase Auth session
  useEffect(() => {
    if (injectedRepository) {
      setAuthReady(true);
      return;
    }
    const supabase = getSupabaseClient();
    if (!supabase) {
      setAuthReady(true);
      return;
    }

    let mounted = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setSession(data.session ?? null);
        setAuthReady(true);
      })
      .catch(() => {
        if (mounted) setAuthReady(true);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY') {
        setAuthModeOverride('update_password');
      }
      setSession(nextSession ?? null);
      if (nextSession) {
        setIsDemoMode(false);
      } else {
        setTransactions([]);
        setBudgets([]);
        setGoals([]);
        setImportedHashes([]);
        setUserProfile(null);
        setAgentHistory({ messages: [] });
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [injectedRepository]);

  // Fetch data whenever authenticated session or demo mode becomes active
  useEffect(() => {
    if (authReady && (session?.user || isDemoMode || injectedRepository)) {
      loadAllData();
    }
  }, [authReady, session, isDemoMode, injectedRepository, loadAllData]);

  const handleSignOut = async () => {
    if (isDemoMode) {
      setIsDemoMode(false);
      repositoryRef.current = null;
      setTransactions([]);
      setBudgets([]);
      setGoals([]);
      setImportedHashes([]);
      setUserProfile(null);
      setActiveTab('overview');
      return;
    }
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    repositoryRef.current = null;
    setSession(null);
    setActiveTab('overview');
  };

  // Transaction Handlers
  const handleOpenNewTransaction = (
    type: TransactionType = 'expense',
    prefillImg: string = ''
  ) => {
    setEditingTransaction(null);
    setDefaultTxType(type);
    setDefaultImageUrl(prefillImg);
    setIsTxModalOpen(true);
  };

  const handleEditTransaction = (tx: Transaction) => {
    setEditingTransaction(tx);
    setIsTxModalOpen(true);
  };

  const handleSaveTransaction = async (
    txData: Omit<Transaction, 'id' | 'createdAt'> & { id?: string }
  ) => {
    const repo = resolveRepository();
    if (!repo) throw new Error('Sessão inválida. Entre novamente.');
    const saved = await repo.saveTransaction(txData);
    setTransactions((prev) => {
      const exists = prev.some((t) => t.id === saved.id);
      if (exists) {
        return prev.map((t) => (t.id === saved.id ? saved : t));
      }
      return [saved, ...prev];
    });
  };

  const handleConfirmScannedExpense = async (
    data: ConfirmScannedExpenseInput
  ): Promise<Transaction> => {
    const repo = resolveRepository();
    if (!repo) throw new Error('Sessão inválida. Entre novamente.');
    const saved = await repo.saveTransaction({
      description: data.description,
      amount: data.amount,
      type: 'expense',
      category: data.category,
      date: data.date,
      account: data.account,
      status: data.status,
      imageUrl: data.imageUrl,
      notes: data.notes,
      fileHash: data.fileHash,
      documentType: data.documentType,
      extractedPayload: data.extractedPayload,
    });
    setTransactions((prev) => [saved, ...prev]);
    if (data.fileHash) {
      setImportedHashes((prev) =>
        prev.includes(data.fileHash!) ? prev : [...prev, data.fileHash!]
      );
    }
    return saved;
  };

  const handleDeleteTransaction = async (id: string) => {
    const repo = resolveRepository();
    if (!repo) return;
    await repo.deleteTransaction(id);
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  const handleToggleTxStatus = async (id: string) => {
    const repo = resolveRepository();
    const target = transactions.find((t) => t.id === id);
    if (!repo || !target) return;
    const updated = await repo.toggleTransactionStatus(target);
    setTransactions((prev) => prev.map((t) => (t.id === id ? updated : t)));
  };

  // Goals Handlers
  const handleOpenNewGoal = () => {
    setEditingGoal(null);
    setGoalModalMode('edit');
    setIsGoalModalOpen(true);
  };

  const handleEditGoal = (goal: PiggyBankGoal) => {
    setEditingGoal(goal);
    setGoalModalMode('edit');
    setIsGoalModalOpen(true);
  };

  const handleDepositGoal = (goal: PiggyBankGoal) => {
    setEditingGoal(goal);
    setGoalModalMode('deposit');
    setIsGoalModalOpen(true);
  };

  const handleWithdrawGoal = (goal: PiggyBankGoal) => {
    setEditingGoal(goal);
    setGoalModalMode('withdraw');
    setIsGoalModalOpen(true);
  };

  const handleSaveGoal = async (goal: PiggyBankGoal) => {
    const repo = resolveRepository();
    if (!repo) throw new Error('Sessão inválida.');
    const saved = await repo.saveGoal(goal);
    setGoals((prev) => {
      const exists = prev.some((g) => g.id === saved.id);
      if (exists) {
        return prev.map((g) => (g.id === saved.id ? saved : g));
      }
      return [...prev, saved];
    });
  };

  const handleGoalContribution = async (
    goalId: string,
    type: 'deposit' | 'withdraw',
    amount: number,
    notes?: string
  ) => {
    const repo = resolveRepository();
    if (!repo) throw new Error('Sessão inválida.');
    const { goal: updatedGoal } = await repo.contributeToGoal(goalId, type, amount, notes);
    setGoals((prev) => prev.map((g) => (g.id === goalId ? updatedGoal : g)));
  };

  const handleDeleteGoal = async (id: string) => {
    const repo = resolveRepository();
    if (!repo) return;
    await repo.deleteGoal(id);
    setGoals((prev) => prev.filter((g) => g.id !== id));
  };

  // Budgets Handlers
  const handleOpenNewBudget = () => {
    setEditingBudget(null);
    setIsBudgetModalOpen(true);
  };

  const handleEditBudget = (budget: CategoryBudget) => {
    setEditingBudget(budget);
    setIsBudgetModalOpen(true);
  };

  const handleSaveBudget = async (budget: CategoryBudget) => {
    const repo = resolveRepository();
    if (!repo) throw new Error('Sessão inválida.');
    const saved = await repo.saveBudget(budget);
    setBudgets((prev) => {
      const period = saved.period || 'monthly';
      const exists = prev.some(
        (b) => b.category === saved.category && (b.period || 'monthly') === period
      );
      if (exists) {
        return prev.map((b) =>
          b.category === saved.category && (b.period || 'monthly') === period ? saved : b
        );
      }
      return [...prev, saved];
    });
  };

  const handleDeleteBudget = async (budget: CategoryBudget) => {
    const repo = resolveRepository();
    if (!repo) return;
    await repo.deleteBudget(budget);
    const period = budget.period || 'monthly';
    setBudgets((prev) =>
      prev.filter((b) => !(b.category === budget.category && (b.period || 'monthly') === period))
    );
  };

  // Lightbox Handlers
  const handleViewReceipt = (tx: Transaction) => {
    if (tx.imageUrl) {
      setLightboxState({
        isOpen: true,
        imageUrl: tx.imageUrl,
        title: tx.description,
        transaction: tx,
      });
    }
  };

  const handleViewGoalImage = (goal: PiggyBankGoal) => {
    if (goal.imageUrl) {
      setLightboxState({
        isOpen: true,
        imageUrl: goal.imageUrl,
        title: goal.title,
        transaction: null,
      });
    }
  };

  // Demo reset handler (only available in Demo Mode)
  const handleExecuteDemoReset = async () => {
    const repo = resolveRepository();
    if (repo?.isDemo && repo.resetDemoData) {
      const loaded = await repo.resetDemoData();
      setTransactions(loaded.transactions);
      setBudgets(loaded.budgets);
      setGoals(loaded.goals);
      setImportedHashes(loaded.importedHashes);
    }
  };

  // Sync Demo Mode mutations triggered by the AI Agent
  const handleDemoAgentMutation = async (
    operation: AgentOperationProposal,
    mutatedData?: Record<string, unknown>
  ) => {
    const repo = resolveRepository();
    if (!repo || !repo.isDemo) return;

    if (operation.operationType === 'create_transaction' && mutatedData?.transaction) {
      const tx = mutatedData.transaction as Transaction;
      await repo.saveTransaction(tx);
    } else if (operation.operationType === 'update_transaction' && mutatedData?.transaction) {
      const tx = mutatedData.transaction as Transaction;
      await repo.saveTransaction(tx);
    } else if (
      operation.operationType === 'delete_transaction' &&
      mutatedData?.deletedTransactionId
    ) {
      await repo.deleteTransaction(String(mutatedData.deletedTransactionId));
    } else if (operation.operationType === 'update_budget' && mutatedData?.budget) {
      await repo.saveBudget(mutatedData.budget as CategoryBudget);
    } else if (operation.operationType === 'goal_contribution') {
      const args = operation.arguments;
      await repo.contributeToGoal(
        String(args.goalId),
        args.type as 'deposit' | 'withdraw',
        Number(args.amount),
        args.notes ? String(args.notes) : undefined
      );
    }
    await loadAllData();
  };

  // Auth Gate
  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <div className="w-10 h-10 rounded-2xl bg-[#274A3C] text-[#C4EBD8] flex items-center justify-center mx-auto animate-pulse">
            <RefreshCw className="w-5 h-5 animate-spin" />
          </div>
          <p className="text-sm font-semibold text-[#1A1C1A]">Carregando sua sessão...</p>
        </div>
      </div>
    );
  }

  if (authModeOverride === 'update_password') {
    return (
      <AuthView
        initialMode="update_password"
        onEnterDemoMode={() => {
          setAuthModeOverride(null);
          setIsDemoMode(true);
        }}
        onPasswordUpdated={() => setAuthModeOverride(null)}
      />
    );
  }

  if (!session && !isDemoMode && !injectedRepository) {
    return (
      <AuthView
        onEnterDemoMode={() => {
          setIsDemoMode(true);
        }}
      />
    );
  }

  const authHeaders: Record<string, string> = isDemoMode
    ? {
        Authorization: 'Bearer demo-session',
        'x-aconchego-demo': 'true',
      }
    : session?.access_token
    ? {
        Authorization: `Bearer ${session.access_token}`,
      }
    : {};

  const receiptCount = transactions.filter((t) => Boolean(t.imageUrl)).length;

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#1A1C1A] flex flex-col font-sans selection:bg-[#3F6253]/15">
      {/* Voluntary Demo Banner */}
      {isDemoMode && (
        <div className="bg-[#FCF1ED] border-b border-[#F5D3C4] px-3 sm:px-6 py-2 text-xs text-[#954827]">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-center sm:text-left">
              <FlaskConical className="w-4 h-4 shrink-0" />
              <span>
                <strong>Modo Demonstração ativo:</strong> você está visualizando dados fictícios apenas nesta sessão local.
              </span>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#FFFFFF] border border-[#E6C5B8] text-[11px] font-semibold text-[#954827] hover:bg-[#FAF9F6] cursor-pointer shrink-0"
            >
              <LogOut className="w-3 h-3" />
              <span>Entrar com conta real</span>
            </button>
          </div>
        </div>
      )}

      {/* Universal Top Bar */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onNewTransaction={() => handleOpenNewTransaction('expense')}
        onOpenReceipts={() => setActiveTab('receipts')}
        receiptCount={receiptCount}
        userProfile={userProfile}
        isDemoMode={isDemoMode}
        onSignOut={handleSignOut}
      />

      {/* Main Viewport Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-20 md:pb-10">
        {dataError && (
          <div role="alert" className="mb-4 p-4 rounded-2xl bg-[#FDF0ED] border border-[#F5C2B8] text-xs sm:text-sm text-[#BA1A1A] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{dataError}</span>
            </div>
            <button
              type="button"
              onClick={loadAllData}
              className="px-3.5 py-1.5 rounded-full bg-[#FFFFFF] border border-[#F5C2B8] text-xs font-semibold text-[#BA1A1A] hover:bg-[#FAF9F6] cursor-pointer"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {isLoadingData && transactions.length === 0 && budgets.length === 0 && goals.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <RefreshCw className="w-6 h-6 text-[#3F6253] animate-spin mx-auto" />
            <p className="text-sm text-[#5C6661]">Sincronizando seus dados financeiros...</p>
          </div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <DashboardView
                transactions={transactions}
                budgets={budgets}
                goals={goals}
                currentMonth={currentMonth}
                onMonthChange={setCurrentMonth}
                onNewTransaction={handleOpenNewTransaction}
                onOpenScanReceipt={() => setActiveTab('scan')}
                onOpenAssistant={() => setActiveTab('assistant')}
                onViewAllTransactions={() => setActiveTab('transactions')}
                onViewAllGoals={() => setActiveTab('piggybanks')}
                onViewReceipt={handleViewReceipt}
                onQuickDeposit={handleDepositGoal}
                userName={userProfile?.fullName}
              />
            )}

            {activeTab === 'transactions' && (
              <TransactionsView
                transactions={transactions}
                onNewTransaction={() => handleOpenNewTransaction('expense')}
                onEditTransaction={handleEditTransaction}
                onDeleteTransaction={handleDeleteTransaction}
                onToggleStatus={handleToggleTxStatus}
                onViewReceipt={handleViewReceipt}
              />
            )}

            {activeTab === 'scan' && (
              <ScanReceiptView
                authHeaders={authHeaders}
                demoImportedHashes={isDemoMode ? importedHashes : undefined}
                onConfirmExpense={handleConfirmScannedExpense}
                onEditTransaction={handleEditTransaction}
                onDeleteTransaction={handleDeleteTransaction}
                onGoToTransactions={() => setActiveTab('transactions')}
                onViewReceipt={handleViewReceipt}
              />
            )}

            {activeTab === 'assistant' && (
              <AgentAssistantView
                authHeaders={authHeaders}
                isDemoMode={isDemoMode}
                currentMonth={currentMonth}
                transactions={transactions}
                budgets={budgets}
                goals={goals}
                initialConversationId={agentHistory.conversationId}
                initialMessages={agentHistory.messages}
                onDataMutated={loadAllData}
                onDemoOperationExecuted={handleDemoAgentMutation}
              />
            )}

            {activeTab === 'budgets' && (
              <BudgetsView
                budgets={budgets}
                transactions={transactions}
                currentMonth={currentMonth}
                onEditBudget={handleEditBudget}
                onNewBudget={handleOpenNewBudget}
                onDeleteBudget={handleDeleteBudget}
              />
            )}

            {activeTab === 'piggybanks' && (
              <PiggyBanksView
                goals={goals}
                onNewGoal={handleOpenNewGoal}
                onEditGoal={handleEditGoal}
                onDeleteGoal={handleDeleteGoal}
                onDeposit={handleDepositGoal}
                onWithdraw={handleWithdrawGoal}
                onViewImage={handleViewGoalImage}
              />
            )}

            {activeTab === 'receipts' && (
              <ReceiptsGalleryView
                transactions={transactions}
                onViewReceipt={handleViewReceipt}
                onNewTransactionWithImage={(imageUrl) =>
                  handleOpenNewTransaction('expense', imageUrl)
                }
              />
            )}
          </>
        )}
      </main>

      {/* Modals */}
      <TransactionModal
        isOpen={isTxModalOpen}
        onClose={() => setIsTxModalOpen(false)}
        onSave={handleSaveTransaction}
        initialTransaction={editingTransaction}
        defaultType={defaultTxType}
        defaultImageUrl={defaultImageUrl}
      />

      <PiggyBankModal
        isOpen={isGoalModalOpen}
        onClose={() => setIsGoalModalOpen(false)}
        onSaveGoal={handleSaveGoal}
        onUpdateAmount={handleGoalContribution}
        initialGoal={editingGoal}
        mode={goalModalMode}
      />

      <BudgetModal
        isOpen={isBudgetModalOpen}
        onClose={() => setIsBudgetModalOpen(false)}
        onSave={handleSaveBudget}
        initialBudget={editingBudget}
        defaultPeriod={currentMonth}
      />

      <ImageLightboxModal
        isOpen={lightboxState.isOpen}
        onClose={() => setLightboxState({ isOpen: false })}
        imageUrl={lightboxState.imageUrl}
        title={lightboxState.title}
        transaction={lightboxState.transaction}
      />

      {/* Quiet Footer */}
      <footer className="mt-auto border-t border-[#EAE6DE] py-5 pb-20 md:py-6 md:pb-6 bg-[#FAF9F6] text-xs text-[#5C6661]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <p>
            © {new Date().getFullYear()} Aconchego Finanças · Controle financeiro pessoal simples e acolhedor.
          </p>

          {isDemoMode && (
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(true)}
                className="text-[#5C6661] hover:text-[#1A1C1A] flex items-center gap-1.5 cursor-pointer underline transition-colors"
                title="Restaurar dados de demonstração iniciais"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restaurar dados de demonstração</span>
              </button>
            </div>
          )}
        </div>
      </footer>

      {/* Reset Confirmation Modal (Demo Mode only) */}
      <ConfirmationModal
        isOpen={isResetConfirmOpen}
        title="Restaurar Dados de Demonstração"
        description="Deseja restaurar os lançamentos, limites e cofrinhos fictícios para o estado inicial de demonstração?"
        confirmLabel="Sim, Restaurar"
        cancelLabel="Cancelar"
        isDestructive={false}
        iconType="reset"
        onConfirm={handleExecuteDemoReset}
        onCancel={() => setIsResetConfirmOpen(false)}
      />
    </div>
  );
}
