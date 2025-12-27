import { describe, it, expect } from 'vitest';
import { hashString, shortHash } from './hash.js';

describe('hashString', () => {
  it('should generate consistent MD5 hash', () => {
    const content = 'Hello, World!';
    const hash1 = hashString(content);
    const hash2 = hashString(content);

    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{32}$/);
  });

  it('should generate different hashes for different content', () => {
    const hash1 = hashString('Hello');
    const hash2 = hashString('World');

    expect(hash1).not.toBe(hash2);
  });

  it('should handle empty string', () => {
    const hash = hashString('');
    expect(hash).toMatch(/^[a-f0-9]{32}$/);
  });

  it('should handle unicode characters', () => {
    const hash = hashString('Hello 世界 🌍');
    expect(hash).toMatch(/^[a-f0-9]{32}$/);
  });

  it('should be case sensitive', () => {
    const hash1 = hashString('Hello');
    const hash2 = hashString('hello');

    expect(hash1).not.toBe(hash2);
  });
});

describe('shortHash', () => {
  it('should generate hash of specified length', () => {
    const hash = shortHash('test content', 8);
    expect(hash.length).toBe(8);
  });

  it('should use default length of 8', () => {
    const hash = shortHash('test content');
    expect(hash.length).toBe(8);
  });

  it('should generate consistent short hash', () => {
    const hash1 = shortHash('test');
    const hash2 = shortHash('test');

    expect(hash1).toBe(hash2);
  });

  it('should handle custom length', () => {
    const hash = shortHash('test content', 16);
    expect(hash.length).toBe(16);
  });
});
