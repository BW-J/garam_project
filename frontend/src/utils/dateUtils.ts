export const toLocalYearMonth = (date: Date | null | undefined): string | null => {
  if (!date) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

export const getDefaultPreviousMonth = () => {
  const now = new Date();
  // 현재 날짜에서 1달을 뺌 (자동으로 연도 변경 등 처리됨)
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const year = prevDate.getFullYear();
  const month = String(prevDate.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

export const isEditablePeriod = (yearMonth: string | undefined | null): boolean => {
  if (!yearMonth) return false;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1~12

  // 지난 달 계산
  let prevYear = currentYear;
  let prevMonth = currentMonth - 1;
  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear -= 1;
  }

  const target = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
  return yearMonth === target;
};
