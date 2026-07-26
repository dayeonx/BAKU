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

export function semesterDateRange(label: string): { start: string; endExclusive: string } {
  const [yearStr, half] = label.split("-");
  const year = Number(yearStr);

  if (half.startsWith("1")) {
    return { start: `${year}-03-01`, endExclusive: `${year}-09-01` };
  }
  return { start: `${year}-09-01`, endExclusive: `${year + 1}-03-01` };
}
