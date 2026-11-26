export function isMainlandPhone(value: string): boolean {
  return /^1\d{10}$/.test(value);
}

export function isHttpUrl(value: string): boolean {
  return /^https?:\/\/[^\s]+$/i.test(value.trim());
}

export function isGithubUrl(value: string): boolean {
  return isHttpUrl(value) && /(^|\.)github\.com$/i.test(getHostname(value));
}

function getHostname(value: string): string {
  try {
    return new URL(value).hostname;
  } catch {
    return '';
  }
}

export function formatDateTime(value: string | null): string {
  if (!value) return '刚刚';
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return '时间未知';
  const date = new Date(timestamp);
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
