import React from 'react';
import {
  Plus,
  Receipt,
  Sparkles,
  LayoutDashboard,
  ArrowLeftRight,
  PieChart,
  PiggyBank,
  Camera,
  Bot,
  LogOut,
  FlaskConical,
} from 'lucide-react';
import { ActiveTab, UserProfile } from '../types/finance';
import { AVATAR_DEFAULT_URL, resolveAssetUrl } from '../utils/assets';

interface HeaderProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onNewTransaction: () => void;
  onOpenReceipts: () => void;
  receiptCount: number;
  userProfile?: UserProfile | null;
  isDemoMode?: boolean;
  onSignOut?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  onNewTransaction,
  receiptCount,
  userProfile,
  isDemoMode = false,
  onSignOut,
}) => {
  const displayName = isDemoMode
    ? 'Modo Demonstração'
    : userProfile?.fullName || userProfile?.email || 'Sua Conta';
  const avatarSrc = resolveAssetUrl(userProfile?.avatarUrl) || AVATAR_DEFAULT_URL;

  const navLinkClass = (tab: ActiveTab) =>
    `whitespace-nowrap shrink-0 transition-colors pb-0.5 border-b-2 px-1.5 py-1 cursor-pointer flex items-center gap-1 ${
      activeTab === tab
        ? 'text-[#274A3C] border-[#274A3C] font-semibold'
        : 'text-[#5C6661] border-transparent hover:text-[#1A1C1A]'
    }`;

  return (
    <>
      {/* Desktop, Tablet & Mobile Top Bar */}
      <header className="sticky top-0 z-30 bg-[#FAF9F6]/95 backdrop-blur-md border-b border-[#E9E5DC]">
        <div className="max-w-7xl mx-auto px-3 sm:px-5 md:px-5 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2 md:gap-3">
          {/* Zone 1: Brand title wordmark */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => onTabChange('overview')}
              className="flex items-center gap-2 sm:gap-2.5 text-left group focus:outline-none cursor-pointer"
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#274A3C] flex items-center justify-center text-[#C4EBD8] shadow-sm shrink-0">
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-[#C4EBD8]" />
              </div>
              <span className="text-base sm:text-lg md:text-base lg:text-xl font-bold tracking-tight text-[#1A1C1A] whitespace-nowrap">
                <span className="inline lg:hidden">Aconchego</span>
                <span className="hidden lg:inline">Aconchego Finanças</span>
              </span>
            </button>
            {isDemoMode && (
              <span className="hidden xl:inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#FCF1ED] text-[#954827] border border-[#F5D3C4]">
                <FlaskConical className="w-3 h-3" />
                Demo
              </span>
            )}
          </div>

          {/* Zone 2: Navigation links */}
          <nav aria-label="Navegação Principal" className="hidden md:flex items-center gap-1 md:gap-1.5 lg:gap-2 2xl:gap-4 text-xs lg:text-sm font-medium overflow-x-auto">
            <button
              type="button"
              onClick={() => onTabChange('overview')}
              aria-current={activeTab === 'overview' ? 'page' : undefined}
              className={navLinkClass('overview')}
            >
              Visão Geral
            </button>
            <button
              type="button"
              onClick={() => onTabChange('transactions')}
              aria-current={activeTab === 'transactions' ? 'page' : undefined}
              className={navLinkClass('transactions')}
            >
              Extrato
            </button>
            <button
              type="button"
              onClick={() => onTabChange('scan')}
              aria-current={activeTab === 'scan' ? 'page' : undefined}
              className={navLinkClass('scan')}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Escanear</span>
            </button>
            <button
              type="button"
              onClick={() => onTabChange('assistant')}
              aria-current={activeTab === 'assistant' ? 'page' : undefined}
              className={navLinkClass('assistant')}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Assistente IA</span>
            </button>
            <button
              type="button"
              onClick={() => onTabChange('budgets')}
              aria-current={activeTab === 'budgets' ? 'page' : undefined}
              className={navLinkClass('budgets')}
            >
              Orçamentos
            </button>
            <button
              type="button"
              onClick={() => onTabChange('piggybanks')}
              aria-current={activeTab === 'piggybanks' ? 'page' : undefined}
              className={navLinkClass('piggybanks')}
            >
              Cofrinhos
            </button>
            <button
              type="button"
              onClick={() => onTabChange('receipts')}
              aria-current={activeTab === 'receipts' ? 'page' : undefined}
              className={navLinkClass('receipts')}
            >
              <span>Comprovantes</span>
              {receiptCount > 0 && (
                <span className="text-[10px] lg:text-[11px] font-semibold px-1.5 py-0.2 rounded-full bg-[#3F6253]/10 text-[#274A3C]">
                  {receiptCount}
                </span>
              )}
            </button>
          </nav>

          {/* Zone 3: Primary Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onNewTransaction}
              aria-label="Nova Transação"
              className="flex items-center gap-1.5 px-3 sm:px-3.5 lg:px-4 py-1.5 sm:py-2 text-xs lg:text-sm font-semibold text-white bg-[#274A3C] hover:bg-[#1E3B30] rounded-full shadow-sm transition-all duration-150 active:scale-95 whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 lg:w-4 lg:h-4 shrink-0" />
              <span className="hidden 2xl:inline">Nova Transação</span>
              <span className="2xl:hidden">Novo</span>
            </button>

            <div
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full ring-2 ring-[#E9E5DC] overflow-hidden bg-[#EAE6DE] shrink-0"
              title={displayName}
            >
              <img
                src={avatarSrc}
                alt={displayName}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>

            {onSignOut && (
              <button
                type="button"
                onClick={onSignOut}
                aria-label={isDemoMode ? 'Sair do modo demonstração' : 'Sair da conta'}
                title={isDemoMode ? 'Sair do modo demonstração' : 'Sair da conta'}
                className="p-1.5 sm:p-2 text-[#5C6661] hover:text-[#BA1A1A] hover:bg-[#FDF0ED] rounded-full transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Thumb-Friendly Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Navegação Principal Mobile"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#FAF9F6]/95 backdrop-blur-md border-t border-[#EAE6DE] pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(39,74,60,0.06)]"
      >
        <div className="grid grid-cols-7 h-14 max-w-lg mx-auto px-0.5">
          <button
            type="button"
            onClick={() => onTabChange('overview')}
            aria-current={activeTab === 'overview' ? 'page' : undefined}
            className={`flex flex-col items-center justify-center gap-0.5 py-1 text-[9.5px] font-medium transition-colors cursor-pointer ${
              activeTab === 'overview'
                ? 'text-[#274A3C] font-bold'
                : 'text-[#5C6661] hover:text-[#1A1C1A]'
            }`}
          >
            <div className={`p-1 rounded-xl ${activeTab === 'overview' ? 'bg-[#EEF3F0]' : ''}`}>
              <LayoutDashboard className="w-4 h-4" />
            </div>
            <span className="truncate">Início</span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange('transactions')}
            aria-current={activeTab === 'transactions' ? 'page' : undefined}
            className={`flex flex-col items-center justify-center gap-0.5 py-1 text-[9.5px] font-medium transition-colors cursor-pointer ${
              activeTab === 'transactions'
                ? 'text-[#274A3C] font-bold'
                : 'text-[#5C6661] hover:text-[#1A1C1A]'
            }`}
          >
            <div className={`p-1 rounded-xl ${activeTab === 'transactions' ? 'bg-[#EEF3F0]' : ''}`}>
              <ArrowLeftRight className="w-4 h-4" />
            </div>
            <span className="truncate">Extrato</span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange('scan')}
            aria-current={activeTab === 'scan' ? 'page' : undefined}
            className={`flex flex-col items-center justify-center gap-0.5 py-1 text-[9.5px] font-medium transition-colors cursor-pointer ${
              activeTab === 'scan'
                ? 'text-[#274A3C] font-bold'
                : 'text-[#5C6661] hover:text-[#1A1C1A]'
            }`}
          >
            <div
              className={`p-1 rounded-xl ${
                activeTab === 'scan'
                  ? 'bg-[#274A3C] text-white'
                  : 'bg-[#E0835D]/15 text-[#954827]'
              }`}
            >
              <Camera className="w-4 h-4" />
            </div>
            <span className="truncate">Escanear</span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange('assistant')}
            aria-current={activeTab === 'assistant' ? 'page' : undefined}
            className={`flex flex-col items-center justify-center gap-0.5 py-1 text-[9.5px] font-medium transition-colors cursor-pointer ${
              activeTab === 'assistant'
                ? 'text-[#274A3C] font-bold'
                : 'text-[#5C6661] hover:text-[#1A1C1A]'
            }`}
          >
            <div
              className={`p-1 rounded-xl ${
                activeTab === 'assistant'
                  ? 'bg-[#274A3C] text-[#C4EBD8]'
                  : 'bg-[#EEF3F0] text-[#274A3C]'
              }`}
            >
              <Bot className="w-4 h-4" />
            </div>
            <span className="truncate">Agente</span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange('budgets')}
            aria-current={activeTab === 'budgets' ? 'page' : undefined}
            className={`flex flex-col items-center justify-center gap-0.5 py-1 text-[9.5px] font-medium transition-colors cursor-pointer ${
              activeTab === 'budgets'
                ? 'text-[#274A3C] font-bold'
                : 'text-[#5C6661] hover:text-[#1A1C1A]'
            }`}
          >
            <div className={`p-1 rounded-xl ${activeTab === 'budgets' ? 'bg-[#EEF3F0]' : ''}`}>
              <PieChart className="w-4 h-4" />
            </div>
            <span className="truncate">Limites</span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange('piggybanks')}
            aria-current={activeTab === 'piggybanks' ? 'page' : undefined}
            className={`flex flex-col items-center justify-center gap-0.5 py-1 text-[9.5px] font-medium transition-colors cursor-pointer ${
              activeTab === 'piggybanks'
                ? 'text-[#274A3C] font-bold'
                : 'text-[#5C6661] hover:text-[#1A1C1A]'
            }`}
          >
            <div className={`p-1 rounded-xl ${activeTab === 'piggybanks' ? 'bg-[#EEF3F0]' : ''}`}>
              <PiggyBank className="w-4 h-4" />
            </div>
            <span className="truncate">Metas</span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange('receipts')}
            aria-current={activeTab === 'receipts' ? 'page' : undefined}
            className={`flex flex-col items-center justify-center gap-0.5 py-1 text-[9.5px] font-medium transition-colors cursor-pointer relative ${
              activeTab === 'receipts'
                ? 'text-[#274A3C] font-bold'
                : 'text-[#5C6661] hover:text-[#1A1C1A]'
            }`}
          >
            <div className={`p-1 rounded-xl relative ${activeTab === 'receipts' ? 'bg-[#EEF3F0]' : ''}`}>
              <Receipt className="w-4 h-4" />
              {receiptCount > 0 && (
                <span className="absolute -top-1 -right-1.5 w-3.5 h-3.5 bg-[#274A3C] text-[#C4EBD8] text-[9px] font-bold rounded-full flex items-center justify-center">
                  {receiptCount}
                </span>
              )}
            </div>
            <span className="truncate">Recibos</span>
          </button>
        </div>
      </nav>
    </>
  );
};
