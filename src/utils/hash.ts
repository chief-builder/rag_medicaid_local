import { createHash } from 'crypto';
import { readFile } from 'fs/promises';

/**
 * Generate MD5 hash of a string
 */
export function hashString(content: string): string {
  return createHash('md5').update(content).digest('hex');
}

/**
 * Generate MD5 hash of a file
 */
export async function hashFile(filepath: string): Promise<string> {
  const content = await readFile(filepath);
  return createHash('md5').update(content).digest('hex');
}

/**
 * Generate a short hash suitable for IDs
 */
export function shortHash(content: string, length: number = 8): string {
  return hashString(content).substring(0, length);
}
