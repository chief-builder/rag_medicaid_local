import { describe, it, expect } from 'vitest';
import { sanitizeText, sanitizeForPostgres } from './text-sanitizer.js';

describe('sanitizeText', () => {
  it('removes null bytes', () => {
    const input = 'hello\0world';
    expect(sanitizeText(input)).toBe('helloworld');
  });

  it('removes control characters except newlines and tabs', () => {
    const input = 'hello\x00\x01\x02world\ntest\ttab';
    expect(sanitizeText(input)).toBe('helloworld\ntest\ttab');
  });

  it('normalizes multiple spaces', () => {
    const input = 'hello   world';
    expect(sanitizeText(input)).toBe('hello world');
  });

  it('normalizes multiple newlines', () => {
    const input = 'hello\n\n\n\n\nworld';
    expect(sanitizeText(input)).toBe('hello\n\nworld');
  });

  it('handles empty string', () => {
    expect(sanitizeText('')).toBe('');
  });

  it('trims whitespace', () => {
    const input = '  hello world  ';
    expect(sanitizeText(input)).toBe('hello world');
  });

  it('removes byte order marks', () => {
    const input = '\uFEFFhello world';
    expect(sanitizeText(input)).toBe('hello world');
  });
});

describe('sanitizeForPostgres', () => {
  it('sanitizes text for PostgreSQL', () => {
    const input = 'hello\0world\x01test';
    const result = sanitizeForPostgres(input);
    expect(result).not.toContain('\0');
    expect(result).not.toContain('\x01');
  });

  it('preserves common unicode characters', () => {
    const input = 'Café résumé naïve';
    expect(sanitizeForPostgres(input)).toBe('Café résumé naïve');
  });

  it('preserves currency symbols', () => {
    const input = 'Price: $100 or €90';
    expect(sanitizeForPostgres(input)).toBe('Price: $100 or €90');
  });

  it('handles mixed content', () => {
    const input = 'Normal text\n\nWith paragraphs\n\nAnd $pecial chars';
    const result = sanitizeForPostgres(input);
    expect(result).toContain('Normal text');
    expect(result).toContain('With paragraphs');
    expect(result).toContain('$pecial chars');
  });
});
