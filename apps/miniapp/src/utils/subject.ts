export const SUBJECT_TEXT: Record<string, string> = {
  MATH: '数学',
  CHINESE: '语文',
  ENGLISH: '英语',
  PHYSICS: '物理',
  CHEMISTRY: '化学',
  BIOLOGY: '生物',
  HISTORY: '历史',
  GEOGRAPHY: '地理',
  POLITICS: '道德与法治',
  OTHER: '其他',
};

export const GRADE_BAND_TEXT: Record<string, string> = {
  PRIMARY: '小学',
  JUNIOR_HIGH: '初中',
  SENIOR_HIGH: '高中',
  GENERAL: '全学段',
};

export function subjectText(subject: string): string {
  return SUBJECT_TEXT[subject] ?? subject;
}

export function gradeBandText(gradeBand: string): string {
  return GRADE_BAND_TEXT[gradeBand] ?? '全学段';
}
