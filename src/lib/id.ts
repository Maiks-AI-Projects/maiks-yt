import { customAlphabet } from 'nanoid';

/**
 * Generates a unique, URL-friendly identifier for the Maiks.yt ecosystem.
 * Format: prefix + 12-character random string (e.g., "user_a1b2c3d4e5f6")
 */
export function getMaiksYtId(prefix: string = ''): string {
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const nanoid = customAlphabet(alphabet, 12);
  const id = nanoid();
  return prefix ? `${prefix}_${id}` : id;
}
