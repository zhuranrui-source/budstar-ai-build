import { describe, expect, it } from 'vitest';
import {
  isSecureWebViewUrl,
  resolveApiContentUrl,
  sanitizeRichTextHtml,
} from './content';

describe('subject chapter content helpers', () => {
  it('resolves absolute API paths without duplicating the api prefix', () => {
    expect(
      resolveApiContentUrl(
        '/api/static/subject-courses?path=math/chapter.html',
        'https://api.example.com/api',
      ),
    ).toBe(
      'https://api.example.com/api/static/subject-courses?path=math/chapter.html',
    );
  });

  it('preserves absolute URLs and resolves relative paths', () => {
    expect(
      resolveApiContentUrl(
        'https://cdn.example.com/lab.html',
        'https://api.example.com/api',
      ),
    ).toBe('https://cdn.example.com/lab.html');
    expect(
      resolveApiContentUrl('static/lab.html', 'https://api.example.com/api'),
    ).toBe('https://api.example.com/api/static/lab.html');
  });

  it('only permits HTTPS content in a production web-view', () => {
    expect(isSecureWebViewUrl('https://cdn.example.com/lab.html')).toBe(true);
    expect(isSecureWebViewUrl('http://localhost:3001/lab.html')).toBe(false);
  });

  it('removes executable markup from rich text fallbacks', () => {
    const input =
      '<h2 onclick="run()">实验</h2><script>alert(1)</script><a href="javascript:run()">继续</a>';
    const result = sanitizeRichTextHtml(input);
    expect(result).toContain('<h2>实验</h2>');
    expect(result).not.toContain('script');
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('javascript:');
  });
});
