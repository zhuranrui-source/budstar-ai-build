export function maskPhone(phone: string): string {
  const normalized = phone.trim();
  if (normalized.length < 7) {
    return '***';
  }

  return `${normalized.slice(0, 3)}****${normalized.slice(-4)}`;
}
