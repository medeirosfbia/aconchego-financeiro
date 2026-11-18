import React, { useState, useEffect, useId } from 'react';
import { X, SlidersHorizontal, AlertCircle } from 'lucide-react';
import { DEFAULT_CATEGORIES, EXPENSE_CATEGORIES } from '../data/initialData';
import { CategoryBudget } from '../types/finance';
import { parseCurrencyInput } from '../utils/financeMath';
import { getCurrentYearMonth, getMonthLabel, getRecentYearMonths } from '../utils/formatters';

interface BudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (budget: CategoryBudget) => void | Promise<void>;
  initialBudget?: CategoryBudget | null;
  defaultPeriod?: string;
}

export const BudgetModal: React.FC<BudgetModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialBudget,
  defaultPeriod,
}) => {
  const [category, setCategory] = useState('Alimentação');
  const [limitStr, setLimitStr] = useState('');
  const [period, setPeriod] = useState('monthly');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const titleId = useId();

  useEffect(() => {
    setFormError(null);
    setIsSubmitting(false);
    if (initialBudget) {
      setCategory(initialBudget.category);
      setLimitStr(initialBudget.limit.toFixed(2).replace('.', ','));
      setPeriod(initialBudget.period || 'monthly');
    } else {
      setCategory('Alimentação');
      setLimitStr('1000');
      setPeriod(defaultPeriod && defaultPeriod !== 'all' ? defaultPeriod : 'monthly');
    }
  }, [initialBudget, defaultPeriod, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const periodOptions = [
    { value: 'monthly', label: 'Mensal (recorrente em todos os meses)' },
    ...getRecentYearMonths(4).map((ym) => ({ value: ym, label: `Específico: ${getMonthLabel(ym)}` })),
  ];
  if (period !== 'monthly' && !periodOptions.some((o) => o.value === period)) {
    periodOptions.push({ value: period, label: `Específico: ${getMonthLabel(period)}` });
  }

  const categoryChoices = EXPENSE_CATEGORIES.some((c) => c.name === category)
    ? EXPENSE_CATEGORIES
    : DEFAULT_CATEGORIES;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setFormError(null);

    const limit = parseCurrencyInput(limitStr);
    if (limit === null) {
      setFormError('Informe um limite mensal válido maior que zero.');
      return;
    }

    const catDef = DEFAULT_CATEGORIES.find((c) => c.name === category);
    setIsSubmitting(true);
    try {
      await onSave({
        id: initialBudget?.id,
        category,
        limit,
        period: period || getCurrentYearMonth(),
        icon: catDef?.icon || 'Receipt',
        color: catDef?.color || '#3F6253',
        bgColor: catDef?.bgColor || '#EEF3F0',
      });
      onClose();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Não foi possível salvar o limite.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/40 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={() => !isSubmitting && onClose()}
    >
      <div
        className="bg-[#FFFFFF] w-full max-w-sm rounded-3xl border border-[#EAE6DE] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-[#F2EFE9] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#FAF9F6] border border-[#E6E2D8] flex items-center justify-center text-[#274A3C]">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <h2 id={titleId} className="text-base sm:text-lg font-bold text-[#1A1C1A]">
              {initialBudget ? 'Ajustar Limite' : 'Novo Orçamento'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Fechar modal de orçamento"
            className="p-1.5 text-[#5C6661] hover:text-[#1A1C1A] hover:bg-[#F2EFE9] rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="p-4 sm:p-6 space-y-4">
          {formError && (
            <div role="alert" className="p-3 rounded-xl bg-[#FDF0ED] border border-[#F5C2B8] text-[#BA1A1A] text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label htmlFor="budget-category" className="block text-xs font-bold text-[#1A1C1A] mb-1">
              Categoria
            </label>
            <select
              id="budget-category"
              value={category}
              disabled={Boolean(initialBudget)}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3.5 py-2 sm:py-2.5 bg-[#FAF9F6] border border-[#E6E2D8] rounded-xl text-base sm:text-sm focus:outline-none focus:border-[#3F6253] text-[#1A1C1A] cursor-pointer disabled:opacity-75"
            >
              {categoryChoices.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="budget-period" className="block text-xs font-bold text-[#1A1C1A] mb-1">
              Período do Limite
            </label>
            <select
              id="budget-period"
              value={period}
              disabled={Boolean(initialBudget)}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full px-3.5 py-2 sm:py-2.5 bg-[#FAF9F6] border border-[#E6E2D8] rounded-xl text-base sm:text-sm focus:outline-none focus:border-[#3F6253] text-[#1A1C1A] cursor-pointer disabled:opacity-75"
            >
              {periodOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="budget-limit" className="block text-xs font-bold text-[#1A1C1A] mb-1">
              Limite Mensal de Gastos (R$)
            </label>
            <input
              id="budget-limit"
              type="text"
              inputMode="decimal"
              placeholder="Ex: 1200,00"
              value={limitStr}
              onChange={(e) => setLimitStr(e.target.value)}
              autoFocus
              className="w-full px-3.5 py-2 sm:py-2.5 bg-[#FAF9F6] border border-[#E6E2D8] rounded-xl text-lg sm:text-xl font-bold font-mono tabular-nums text-[#1A1C1A] focus:outline-none focus:border-[#3F6253]"
            />
          </div>

          <div className="pt-3 border-t border-[#F2EFE9] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-[#5C6661] hover:text-[#1A1C1A] hover:bg-[#F2EFE9] rounded-full transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 sm:px-6 py-2.5 text-xs font-bold text-white bg-[#274A3C] hover:bg-[#1E3B30] rounded-full shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-60"
            >
              {isSubmitting ? 'Salvando...' : 'Salvar Limite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
