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
