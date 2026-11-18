import React, { useState } from 'react';
import { Plus, SlidersHorizontal, AlertCircle, CheckCircle, Trash2, PieChart } from 'lucide-react';
import { CategoryBudget, Transaction } from '../types/finance';
import { formatCurrency, getMonthLabel } from '../utils/formatters';
import { addMoney, calculateBudgetStatuses } from '../utils/financeMath';
import { CategoryIcon } from './CategoryIcon';
import { ConfirmationModal } from './ConfirmationModal';

interface BudgetsViewProps {
  budgets: CategoryBudget[];
  transactions: Transaction[];
  currentMonth: string;
  onEditBudget: (budget: CategoryBudget) => void;
  onNewBudget: () => void;
  onDeleteBudget: (budget: CategoryBudget) => void | Promise<void>;
}

export const BudgetsView: React.FC<BudgetsViewProps> = ({
  budgets,
  transactions,
  currentMonth,
  onEditBudget,
  onNewBudget,
  onDeleteBudget,
}) => {
  const [budgetToDelete, setBudgetToDelete] = useState<CategoryBudget | null>(null);

  const statuses = calculateBudgetStatuses(budgets, transactions, currentMonth);
  const totalBudgeted = statuses.reduce((acc, s) => addMoney(acc, s.budget.limit), 0);
  const totalSpentInBudgeted = statuses.reduce((acc, s) => addMoney(acc, s.spent), 0);
  const totalPendingInBudgeted = statuses.reduce((acc, s) => addMoney(acc, s.pendingSpent), 0);
  const availableTotal = Math.max(0, totalBudgeted - totalSpentInBudgeted);

  return (
    <div className="space-y-5 sm:space-y-6 md:space-y-7 pb-10">
      {/* Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-[#1A1C1A]">
            Orçamentos por Categoria
          </h1>
          <p className="text-xs sm:text-sm text-[#5C6661] mt-0.5">
            Planejamento de gastos conscientes para {getMonthLabel(currentMonth).toLowerCase()}.
          </p>
        </div>

        <button
          type="button"
          onClick={onNewBudget}
          className="flex items-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-white bg-[#274A3C] hover:bg-[#1E3B30] rounded-full shadow-sm transition-all active:scale-95 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>Novo Limite</span>
        </button>
      </div>

      {/* Overview Card: 3 columns on tablet and desktop */}
      <div className="p-4 sm:p-5 md:p-6 rounded-2xl bg-[#FFFFFF] border border-[#EAE6DE] shadow-xs grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 md:gap-6 items-center">
        <div>
          <span className="text-[11px] sm:text-xs font-semibold text-[#5C6661] uppercase tracking-wider">
            Total Orçado no Período
          </span>
          <p className="text-xl sm:text-2xl md:text-2xl lg:text-3xl font-bold text-[#1A1C1A] mt-1 font-mono tabular-nums break-words">
            {formatCurrency(totalBudgeted)}
          </p>
          <p className="text-[11px] sm:text-xs text-[#5C6661] mt-0.5">
            Soma dos tetos estipulados ({statuses.length} categorias)
          </p>
        </div>

        <div>
          <span className="text-[11px] sm:text-xs font-semibold text-[#5C6661] uppercase tracking-wider">
            Total Efetivado (Pago)
          </span>
          <p className="text-xl sm:text-2xl md:text-2xl lg:text-3xl font-bold text-[#C96846] mt-1 font-mono tabular-nums break-words">
            {formatCurrency(totalSpentInBudgeted)}
          </p>
          <p className="text-[11px] sm:text-xs text-[#5C6661] mt-0.5">
            {totalBudgeted > 0
              ? `${Math.round((totalSpentInBudgeted / totalBudgeted) * 100)}% do orçamento consumido`
              : 'Sem orçamentos definidos'}
            {totalPendingInBudgeted > 0 && ` · ${formatCurrency(totalPendingInBudgeted)} pendente`}
          </p>
        </div>

        <div className="bg-[#FAF9F6] p-3.5 sm:p-4 rounded-xl border border-[#EAE6DE]">
          <div className="flex items-center justify-between text-xs font-medium text-[#5C6661] mb-1.5">
            <span>Disponível</span>
            <span className="font-bold text-[#274A3C] font-mono tabular-nums">
              {formatCurrency(availableTotal)}
            </span>
          </div>
          <div className="h-2 w-full bg-[#EAE6DE] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                totalBudgeted > 0 && totalSpentInBudgeted > totalBudgeted
                  ? 'bg-[#BA1A1A]'
                  : 'bg-[#3F6253]'
              }`}
              style={{
                width: `${Math.min(
                  100,
                  totalBudgeted > 0 ? (totalSpentInBudgeted / totalBudgeted) * 100 : 0
                )}%`,
              }}
            />
          </div>
        </div>
      </div>

      {statuses.length === 0 ? (
        <div className="bg-[#FFFFFF] p-8 sm:p-12 rounded-2xl border border-[#EAE6DE] text-center text-[#5C6661]">
          <PieChart className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-[#C1C8C3] mb-3" />
          <h3 className="text-sm sm:text-base font-bold text-[#1A1C1A]">
            Nenhum limite de orçamento definido
          </h3>
          <p className="text-xs sm:text-sm mt-1 max-w-md mx-auto">
            Defina tetos mensais por categoria para acompanhar seus gastos com tranquilidade e receber alertas antes de ultrapassar o planejado.
          </p>
          <button
            type="button"
            onClick={onNewBudget}
            className="mt-4 px-4 py-2 bg-[#274A3C] text-white text-xs font-semibold rounded-full hover:bg-[#1E3B30] cursor-pointer"
          >
            + Definir primeiro limite
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4 md:gap-5">
          {statuses.map(({ budget: b, spent, pendingSpent, remaining, percent, isNear, isOver }) => (
            <div
              key={`${b.category}-${b.period || 'monthly'}`}
              className="bg-[#FFFFFF] p-4 sm:p-5 rounded-2xl border border-[#EAE6DE] shadow-xs flex flex-col justify-between hover:border-[#3F6253]/30 transition-all group"
            >
              <div>
                <div className="flex items-center justify-between mb-3 gap-2">
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <div
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${b.color}15`, color: b.color }}
                    >
                      <CategoryIcon name={b.category} className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm sm:text-base font-bold text-[#1A1C1A] truncate">
                        {b.category}
                      </h3>
                      <span className="text-xs text-[#5C6661] block truncate">
                        Teto: {formatCurrency(b.limit)} · {b.period && b.period !== 'monthly' ? b.period : 'Mensal'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onEditBudget(b)}
                      aria-label={`Editar limite de ${b.category}`}
                      className="p-1.5 text-[#5C6661] hover:text-[#1A1C1A] hover:bg-[#F2EFE9] rounded-lg transition-colors cursor-pointer"
                      title="Editar limite"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setBudgetToDelete(b)}
                      aria-label={`Excluir limite de ${b.category}`}
                      className="p-1.5 text-[#5C6661] hover:text-[#BA1A1A] hover:bg-[#FDF0ED] rounded-lg transition-colors cursor-pointer"
                      title="Excluir limite"
                    >
                      <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-3 sm:mt-4 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-[#5C6661]">
                      Pago: <span className="text-[#1A1C1A] font-mono tabular-nums">{formatCurrency(spent)}</span>
                    </span>
                    <span
                      className={`font-mono tabular-nums ${
                        isOver
                          ? 'text-[#BA1A1A]'
                          : isNear
                          ? 'text-[#E0835D]'
                          : 'text-[#437A5B]'
                      }`}
                    >
                      {percent}%
                    </span>
                  </div>

                  <div className="h-2.5 w-full bg-[#F2EFE9] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isOver
                          ? 'bg-[#BA1A1A]'
                          : isNear
                          ? 'bg-[#E0835D]'
                          : 'bg-[#437A5B]'
                      }`}
                      style={{ width: `${Math.min(100, percent)}%` }}
                    />
                  </div>
                  {pendingSpent > 0 && (
                    <p className="text-[11px] text-[#5C6661]">
                      + {formatCurrency(pendingSpent)} em lançamentos pendentes
                    </p>
                  )}
                </div>
              </div>

              {/* Status footer */}
              <div className="mt-3.5 pt-3 border-t border-[#F5F3ED] flex items-center justify-between text-xs gap-2">
                <div className="min-w-0">
                  {isOver ? (
                    <span className="flex items-center gap-1.5 text-[#BA1A1A] font-medium truncate">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">Estourou em {formatCurrency(Math.abs(remaining))}</span>
                    </span>
                  ) : isNear ? (
                    <span className="flex items-center gap-1.5 text-[#954827] font-medium truncate">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">Atenção · Restam {formatCurrency(remaining)}</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-[#437A5B] font-medium truncate">
                      <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">Restam {formatCurrency(remaining)}</span>
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onEditBudget(b)}
                  className="text-xs font-semibold text-[#3F6253] hover:underline cursor-pointer shrink-0"
                >
                  Ajustar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmationModal
        isOpen={Boolean(budgetToDelete)}
        title="Excluir Limite de Orçamento"
        description={
          budgetToDelete
            ? `Deseja remover o limite definido para "${budgetToDelete.category}" (${formatCurrency(
                budgetToDelete.limit
              )})? As transações existentes não serão apagadas.`
            : ''
        }
        confirmLabel="Sim, Excluir"
        cancelLabel="Cancelar"
        isDestructive={true}
        iconType="trash"
        onConfirm={async () => {
          if (budgetToDelete) {
            await onDeleteBudget(budgetToDelete);
          }
        }}
        onCancel={() => setBudgetToDelete(null)}
      />
    </div>
  );
};
