import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Download,
  Plus,
  Receipt,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  ArrowUpDown,
} from 'lucide-react';
import { DEFAULT_CATEGORIES, PAYMENT_METHODS } from '../data/initialData';
import { FilterState, PaymentMethod, Transaction, TransactionStatus } from '../types/finance';
import { formatCurrency, formatFriendlyDate, getMonthLabel, getRecentYearMonths } from '../utils/formatters';
import { resolveAssetUrl } from '../utils/assets';
import { calculatePeriodSummary } from '../utils/financeMath';
import { CategoryIcon } from './CategoryIcon';
import { ConfirmationModal } from './ConfirmationModal';

interface TransactionsViewProps {
  transactions: Transaction[];
  onNewTransaction: () => void;
  onEditTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (id: string) => void | Promise<void>;
  onToggleStatus: (id: string) => void | Promise<void>;
  onViewReceipt: (tx: Transaction) => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  transactions,
  onNewTransaction,
  onEditTransaction,
  onDeleteTransaction,
  onToggleStatus,
  onViewReceipt,
}) => {
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    type: 'all',
    category: 'all',
    period: 'all',
    status: 'all',
    account: 'all',
  });

  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);

  const periodOptions = useMemo(() => {
    const monthSet = new Set<string>(getRecentYearMonths(6));
    transactions.forEach((t) => {
      if (t.date && t.date.length >= 7) {
        monthSet.add(t.date.slice(0, 7));
      }
    });
    return Array.from(monthSet)
      .sort((a, b) => b.localeCompare(a))
      .map((value) => ({ value, label: getMonthLabel(value) }));
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((tx) => {
        if (filters.search) {
          const q = filters.search.toLowerCase();
          const matchDesc = tx.description.toLowerCase().includes(q);
          const matchCat = tx.category.toLowerCase().includes(q);
          const matchAcc = tx.account.toLowerCase().includes(q);
          const matchNotes = (tx.notes || '').toLowerCase().includes(q);
          if (!matchDesc && !matchCat && !matchAcc && !matchNotes) return false;
        }

        if (filters.type !== 'all' && tx.type !== filters.type) {
          return false;
        }

        if (filters.category !== 'all' && tx.category !== filters.category) {
          return false;
        }

        if (filters.period !== 'all' && !tx.date.startsWith(filters.period)) {
          return false;
        }

        if (filters.status !== 'all' && tx.status !== filters.status) {
          return false;
        }

        if (filters.account !== 'all' && tx.account !== filters.account) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'amount') {
          if (a.amount !== b.amount) {
            return sortOrder === 'desc' ? b.amount - a.amount : a.amount - b.amount;
          }
        }
        const timeA = new Date(a.date).getTime();
        const timeB = new Date(b.date).getTime();
        if (timeA !== timeB) {
          return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
        }
        return sortOrder === 'desc' ? b.createdAt - a.createdAt : a.createdAt - b.createdAt;
      });
  }, [transactions, filters, sortBy, sortOrder]);

  const filteredSummary = useMemo(
    () => calculatePeriodSummary(filteredTransactions, 'all'),
    [filteredTransactions]
  );

  const handleExportCSV = () => {
    const headers = ['Data', 'Tipo', 'Descrição', 'Categoria', 'Forma de Pagamento', 'Valor', 'Status', 'Notas'];
    const rows = filteredTransactions.map((t) => [
      t.date,
      t.type === 'income' ? 'Receita' : 'Despesa',
      `"${t.description.replace(/"/g, '""')}"`,
      t.category,
      t.account,
      t.amount.toFixed(2),
      t.status === 'paid' ? 'Efetivado' : 'Pendente',
      `"${(t.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `extrato_aconchego_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 sm:space-y-5 md:space-y-6 pb-10">
      {/* Title & Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-[#1A1C1A]">
            Extrato de Lançamentos
          </h1>
          <p className="text-xs sm:text-sm text-[#5C6661] mt-0.5">
            Histórico completo de entradas, saídas e comprovantes anexados.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={filteredTransactions.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-semibold text-[#1A1C1A] bg-[#FFFFFF] hover:bg-[#F5F3ED] rounded-full border border-[#D9D5CC] shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            title="Exportar registros filtrados em arquivo CSV"
          >
            <Download className="w-3.5 h-3.5 text-[#5C6661]" />
            <span>Exportar CSV</span>
          </button>

          <button
            type="button"
            onClick={onNewTransaction}
            className="flex items-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-white bg-[#274A3C] hover:bg-[#1E3B30] rounded-full shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Nova Transação</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-[#FFFFFF] p-3.5 sm:p-4 md:p-5 rounded-2xl border border-[#EAE6DE] shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#5C6661] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              aria-label="Pesquisar transações por descrição, categoria ou anotação"
              placeholder="Buscar por descrição, anotação..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-[#FAF9F6] border border-[#E6E2D8] rounded-xl focus:outline-none focus:border-[#3F6253] text-[#1A1C1A] placeholder-[#5C6661]/70"
            />
          </div>

          {/* Segmented Type Filter */}
          <div className="grid grid-cols-3 sm:flex items-center gap-1 p-1 bg-[#F2EFE9] rounded-xl shrink-0">
            <button
              type="button"
              onClick={() => setFilters({ ...filters, type: 'all' })}
              className={`py-1.5 px-2 sm:px-3 text-xs font-semibold rounded-lg transition-colors cursor-pointer text-center ${
                filters.type === 'all'
                  ? 'bg-white text-[#1A1C1A] shadow-xs'
                  : 'text-[#5C6661] hover:text-[#1A1C1A]'
              }`}
            >
              Todas
            </button>
            <button
              type="button"
              onClick={() => setFilters({ ...filters, type: 'expense' })}
              className={`py-1.5 px-2 sm:px-3 text-xs font-semibold rounded-lg transition-colors cursor-pointer text-center ${
                filters.type === 'expense'
                  ? 'bg-white text-[#C96846] shadow-xs'
                  : 'text-[#5C6661] hover:text-[#1A1C1A]'
              }`}
            >
              Despesas
            </button>
            <button
              type="button"
              onClick={() => setFilters({ ...filters, type: 'income' })}
              className={`py-1.5 px-2 sm:px-3 text-xs font-semibold rounded-lg transition-colors cursor-pointer text-center ${
                filters.type === 'income'
                  ? 'bg-white text-[#437A5B] shadow-xs'
                  : 'text-[#5C6661] hover:text-[#1A1C1A]'
              }`}
            >
              Receitas
            </button>
          </div>
        </div>

        {/* Secondary Filters row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-2.5 pt-1 text-xs">
          {/* Category Dropdown */}
          <select
            aria-label="Filtrar por categoria"
            value={filters.category}
            onChange={(e) => setFilters({ ...filters, category: e.target.value })}
            className="w-full px-3 py-1.5 bg-[#FAF9F6] border border-[#E6E2D8] rounded-lg text-[#1A1C1A] font-medium focus:outline-none focus:border-[#3F6253] cursor-pointer truncate"
          >
            <option value="all">Todas as Categorias</option>
            {DEFAULT_CATEGORIES.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Period Dropdown */}
          <select
            aria-label="Filtrar por período"
            value={filters.period}
            onChange={(e) => setFilters({ ...filters, period: e.target.value })}
            className="w-full px-3 py-1.5 bg-[#FAF9F6] border border-[#E6E2D8] rounded-lg text-[#1A1C1A] font-medium focus:outline-none focus:border-[#3F6253] cursor-pointer truncate"
          >
            <option value="all">Todo o Histórico</option>
            {periodOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Status Dropdown */}
          <select
            aria-label="Filtrar por status"
            value={filters.status}
            onChange={(e) =>
              setFilters({ ...filters, status: e.target.value as 'all' | TransactionStatus })
            }
            className="w-full px-3 py-1.5 bg-[#FAF9F6] border border-[#E6E2D8] rounded-lg text-[#1A1C1A] font-medium focus:outline-none focus:border-[#3F6253] cursor-pointer truncate"
          >
            <option value="all">Todos os Status</option>
            <option value="paid">Efetivados / Pagos</option>
            <option value="pending">Pendentes</option>
          </select>

          {/* Payment Method Dropdown */}
          <select
            aria-label="Filtrar por método de pagamento"
            value={filters.account}
            onChange={(e) =>
              setFilters({ ...filters, account: e.target.value as 'all' | PaymentMethod })
            }
            className="w-full px-3 py-1.5 bg-[#FAF9F6] border border-[#E6E2D8] rounded-lg text-[#1A1C1A] font-medium focus:outline-none focus:border-[#3F6253] cursor-pointer truncate"
          >
            <option value="all">Todas as Formas</option>
            {PAYMENT_METHODS.map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </select>

          {/* Sort selector */}
          <div className="flex items-center gap-1.5">
            <select
              aria-label="Ordenar por campo"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'date' | 'amount')}
              className="flex-1 px-2.5 py-1.5 bg-[#FAF9F6] border border-[#E6E2D8] rounded-lg text-[#1A1C1A] font-medium focus:outline-none focus:border-[#3F6253] cursor-pointer"
            >
              <option value="date">Data</option>
              <option value="amount">Valor</option>
            </select>
            <button
              type="button"
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              className="px-2.5 py-1.5 bg-[#FAF9F6] border border-[#E6E2D8] rounded-lg text-[#5C6661] hover:text-[#1A1C1A] font-medium flex items-center justify-center gap-1 cursor-pointer shrink-0"
              title="Alternar direção da ordenação"
              aria-label="Alternar direção da ordenação"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>{sortOrder === 'desc' ? '↓' : '↑'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter summary strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-[#5C6661] px-1">
        <div>
          Mostrando <strong className="text-[#1A1C1A]">{filteredTransactions.length}</strong> de {transactions.length} lançamentos
        </div>
        <div className="flex items-center flex-wrap gap-3">
          <span>
            Entradas pagas: <strong className="text-[#437A5B] font-mono tabular-nums">+{formatCurrency(filteredSummary.paidIncome)}</strong>
          </span>
          <span>
            Saídas pagas: <strong className="text-[#C96846] font-mono tabular-nums">-{formatCurrency(filteredSummary.paidExpenses)}</strong>
          </span>
          {filteredSummary.pendingExpenses > 0 && (
            <span>
              A pagar: <strong className="text-[#954827] font-mono tabular-nums">{formatCurrency(filteredSummary.pendingExpenses)}</strong>
            </span>
          )}
        </div>
      </div>

      {/* Transactions List */}
      <div className="bg-[#FFFFFF] rounded-2xl border border-[#EAE6DE] shadow-xs overflow-hidden">
        {filteredTransactions.length === 0 ? (
          <div className="py-12 sm:py-16 text-center text-[#5C6661] px-4">
            <Filter className="w-8 h-8 sm:w-10 sm:h-10 mx-auto text-[#C1C8C3] mb-2 sm:mb-3" />
            <h3 className="text-sm sm:text-base font-bold text-[#1A1C1A]">Nenhuma transação encontrada</h3>
            <p className="text-xs sm:text-sm mt-1 max-w-md mx-auto">
              Tente alterar os filtros de busca ou período, ou adicione um novo lançamento financeiro.
            </p>
            <button
              type="button"
              onClick={() =>
                setFilters({ search: '', type: 'all', category: 'all', period: 'all', status: 'all', account: 'all' })
              }
              className="mt-3 sm:mt-4 px-4 py-2 bg-[#F2EFE9] text-xs font-semibold text-[#274A3C] rounded-full hover:bg-[#EAE6DE] cursor-pointer"
            >
              Limpar filtros
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[#F2EFE9]">
            {filteredTransactions.map((tx) => {
              const resolvedImg = resolveAssetUrl(tx.imageUrl);
              return (
                <div
                  key={tx.id}
                  className="p-3.5 sm:p-4 md:px-5 lg:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 hover:bg-[#FAF9F6] transition-colors group"
                >
                  {/* Left Side: Icon + Details */}
                  <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                    <div
                      className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 ${
                        tx.type === 'income'
                          ? 'bg-[#EDF5F0] text-[#437A5B]'
                          : 'bg-[#FCF1ED] text-[#C96846]'
                      }`}
                    >
                      <CategoryIcon name={tx.category} className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <span className="text-xs sm:text-sm font-bold text-[#1A1C1A] truncate max-w-[200px] sm:max-w-xs md:max-w-sm lg:max-w-md">
                          {tx.description}
                        </span>

                        {resolvedImg && (
                          <button
                            type="button"
                            onClick={() => onViewReceipt({ ...tx, imageUrl: resolvedImg })}
                            className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-[#274A3C] bg-[#E3ECE7] hover:bg-[#D5E3DC] px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                            title="Clique para ver o comprovante anexado"
                          >
                            <Receipt className="w-3 h-3 text-[#3F6253]" />
                            <span>Comprovante</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-[#5C6661] mt-0.5 flex-wrap">
                        <span>{formatFriendlyDate(tx.date)}</span>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">{tx.category}</span>
                        <span aria-hidden="true" className="hidden sm:inline">·</span>
                        <span className="hidden sm:inline">{tx.account}</span>
                        {tx.notes && (
                          <>
                            <span aria-hidden="true" className="hidden md:inline">·</span>
                            <span className="italic text-[#717974] truncate max-w-[150px] md:max-w-xs hidden md:inline">
                              "{tx.notes}"
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Side: Amount, Thumbnail & Action Buttons */}
                  <div className="flex items-center justify-between sm:justify-end gap-2.5 sm:gap-3 md:gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#F5F3ED]">
                    {resolvedImg && (
                      <button
                        type="button"
                        onClick={() => onViewReceipt({ ...tx, imageUrl: resolvedImg })}
                        className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-lg overflow-hidden border border-[#E6E2D8] hover:ring-2 hover:ring-[#3F6253] transition-all cursor-pointer relative shrink-0"
                        title="Ver imagem do comprovante"
                      >
                        <img
                          src={resolvedImg}
                          alt="Comprovante"
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </button>
                    )}

                    <div className="text-right">
                      <p
                        className={`text-sm sm:text-base font-bold font-mono tabular-nums ${
                          tx.type === 'income' ? 'text-[#437A5B]' : 'text-[#1A1C1A]'
                        }`}
                      >
                        {tx.type === 'income' ? '+' : '-'}
                        {formatCurrency(tx.amount)}
                      </p>

                      <button
                        type="button"
                        onClick={() => onToggleStatus(tx.id)}
                        className={`text-[10px] sm:text-[11px] font-semibold flex items-center justify-end gap-1 cursor-pointer transition-colors ${
                          tx.status === 'paid'
                            ? 'text-[#437A5B] hover:text-[#274A3C]'
                            : 'text-[#C96846] hover:text-[#954827]'
                        }`}
                        title="Clique para alternar status"
                      >
                        {tx.status === 'paid' ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Efetivado</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3" />
                            <span>Pendente</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-0.5 sm:gap-1 ml-1 sm:ml-2 pl-1.5 sm:pl-2 border-l border-[#EAE6DE]">
                      <button
                        type="button"
                        onClick={() => onEditTransaction(tx)}
                        aria-label={`Editar ${tx.description}`}
                        className="p-1.5 sm:p-2 text-[#5C6661] hover:text-[#1A1C1A] hover:bg-[#F2EFE9] rounded-lg cursor-pointer transition-colors"
                        title="Editar lançamento"
                      >
                        <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setTxToDelete(tx)}
                        aria-label={`Excluir ${tx.description}`}
                        className="p-1.5 sm:p-2 text-[#5C6661] hover:text-[#BA1A1A] hover:bg-[#FDF0ED] rounded-lg cursor-pointer transition-colors"
                        title="Excluir lançamento"
                      >
                        <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* In-app Confirmation Modal for Deleting Transaction */}
      <ConfirmationModal
        isOpen={Boolean(txToDelete)}
        title="Excluir Lançamento"
        description={
          txToDelete
            ? `Tem certeza que deseja excluir "${txToDelete.description}" no valor de ${formatCurrency(
                txToDelete.amount
              )}? Esta ação não pode ser desfeita.`
            : ''
        }
        confirmLabel="Sim, Excluir"
        cancelLabel="Cancelar"
        isDestructive={true}
        iconType="trash"
        onConfirm={async () => {
          if (txToDelete) {
            await onDeleteTransaction(txToDelete.id);
          }
        }}
        onCancel={() => setTxToDelete(null)}
      />
    </div>
  );
};
