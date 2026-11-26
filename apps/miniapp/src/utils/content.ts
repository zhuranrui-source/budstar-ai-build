export function resolveApiContentUrl(
  contentUrl: string,
  apiBaseUrl: string,
): string {
  const value = contentUrl.trim();
  if (/^https?:\/\//i.test(value)) return value;

  const origin = apiBaseUrl.match(/^(https?:\/\/[^/]+)/i)?.[1] ?? '';
  if (value.startsWith('/')) return `${origin}${value}`;
  return `${apiBaseUrl.replace(/\/$/, '')}/${value.replace(/^\//, '')}`;
}

export function isSecureWebViewUrl(url: string): boolean {
  return /^https:\/\//i.test(url);
}

export function sanitizeRichTextHtml(html: string): string {
  return html
    .replace(/<(script|iframe|object|embed)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(script|iframe|object|embed)[^>]*\/?>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript\s*:/gi, '');
}
