export function formatCurrency(value: number): string {
  const safeValue = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(safeValue);
}

export function getTodayIsoDate(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getCurrentYearMonth(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function getRecentYearMonths(count: number = 6, now: Date = new Date()): string[] {
  const months: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(getCurrentYearMonth(d));
  }
  return months;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  }
  return dateStr;
}

export function formatFriendlyDate(dateStr: string, now: Date = new Date()): string {
  if (!dateStr) return '';
  const todayStr = getTodayIsoDate(now);

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getTodayIsoDate(yesterday);

  if (dateStr === todayStr) {
    return 'Hoje';
  }
  if (dateStr === yesterdayStr) {
    return 'Ontem';
  }

  const [y, m, d] = dateStr.split('-');
  if (!y || !m || !d) return dateStr;

  const months = [
    'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
    'jul', 'ago', 'set', 'out', 'nov', 'dez',
  ];
  const mIndex = parseInt(m, 10) - 1;
  return `${d} de ${months[mIndex] || m}`;
}

export function getMonthLabel(yearMonth: string): string {
  if (!yearMonth || yearMonth === 'all') return 'Todo o histórico';
  if (yearMonth === 'monthly') return 'Mensal (recorrente)';
  const [year, month] = yearMonth.split('-');
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];
  const idx = parseInt(month, 10) - 1;
  if (idx < 0 || idx > 11 || !year) return yearMonth;
  return `${monthNames[idx]} de ${year}`;
}
