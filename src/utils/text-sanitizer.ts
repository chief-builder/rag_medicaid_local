/**
 * Text sanitization utilities for handling invalid UTF-8 and special characters
 */

/**
 * Remove invalid UTF-8 sequences and problematic characters that cause PostgreSQL encoding errors
 */
export function sanitizeText(text: string): string {
  // Remove null bytes
  let sanitized = text.replace(/\0/g, '');

  // Remove other control characters except newlines and tabs
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Replace invalid UTF-8 surrogate pairs with replacement character
  sanitized = sanitized.replace(/[\uD800-\uDFFF]/g, '\uFFFD');

  // Remove private use area characters that may cause issues
  sanitized = sanitized.replace(/[\uE000-\uF8FF]/g, '');

  // Remove byte order marks
  sanitized = sanitized.replace(/[\uFEFF\uFFFE]/g, '');

  // Normalize unicode characters to NFC form
  sanitized = sanitized.normalize('NFC');

  // Replace multiple consecutive spaces with single space
  sanitized = sanitized.replace(/ +/g, ' ');

  // Replace multiple consecutive newlines with double newline
  sanitized = sanitized.replace(/\n{3,}/g, '\n\n');

  return sanitized.trim();
}

/**
 * Sanitize content for safe PostgreSQL insertion
 */
export function sanitizeForPostgres(text: string): string {
  let sanitized = sanitizeText(text);

  // Escape backslashes (PostgreSQL interprets them in certain contexts)
  // Note: Most drivers handle this, but being explicit helps with edge cases

  // Replace any remaining non-printable unicode with space
  sanitized = sanitized.replace(/[^\x20-\x7E\n\t\u00A0-\u00FF\u0100-\u017F\u0180-\u024F\u0250-\u02AF\u1E00-\u1EFF]/g, (char) => {
    // Keep common unicode ranges (Latin Extended, IPA, etc.)
    // Replace unusual characters with space
    const code = char.charCodeAt(0);
    if (code >= 0x0300 && code <= 0x036F) return char; // Combining diacriticals
    if (code >= 0x2000 && code <= 0x206F) return ' '; // General punctuation (some problematic)
    if (code >= 0x2070 && code <= 0x209F) return char; // Superscripts/subscripts
    if (code >= 0x20A0 && code <= 0x20CF) return char; // Currency symbols
    if (code >= 0x2100 && code <= 0x214F) return char; // Letterlike symbols
    if (code >= 0x2150 && code <= 0x218F) return char; // Number forms
    if (code >= 0x2190 && code <= 0x21FF) return char; // Arrows
    if (code >= 0x2200 && code <= 0x22FF) return char; // Mathematical operators
    if (code >= 0x2300 && code <= 0x23FF) return char; // Misc technical
    if (code >= 0x2500 && code <= 0x257F) return char; // Box drawing
    if (code >= 0x25A0 && code <= 0x25FF) return char; // Geometric shapes
    if (code >= 0x2600 && code <= 0x26FF) return char; // Misc symbols
    if (code >= 0x2700 && code <= 0x27BF) return char; // Dingbats
    return ' ';
  });

  return sanitized;
}
