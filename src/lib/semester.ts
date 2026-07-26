export function semesterLabel(dateStr: string): string {
  const [yearStr, monthStr] = dateStr.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);

  if (month >= 3 && month <= 8) return `${year}-1학기`;
  if (month >= 9) return `${year}-2학기`;
  return `${year - 1}-2학기`;
}

export function currentSemesterLabel(today: Date = new Date()): string {
  const iso = today.toISOString().slice(0, 10);
  return semesterLabel(iso);
}
