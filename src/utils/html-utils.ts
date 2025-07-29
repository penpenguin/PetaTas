// HTML utility functions for PetaTas
// Provides centralized HTML escaping and sanitization functions

/**
 * Escapes HTML special characters to prevent XSS attacks
 * @param unsafe - The potentially unsafe string to escape
 * @returns The escaped string safe for HTML insertion
 */
export function escapeHtml(unsafe: string): string {
  if (typeof unsafe !== 'string') {
    return String(unsafe);
  }
  
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Escapes HTML attributes to prevent attribute injection
 * @param unsafe - The potentially unsafe attribute value
 * @returns The escaped attribute value
 */
export function escapeHtmlAttribute(unsafe: string): string {
  if (typeof unsafe !== 'string') {
    return String(unsafe);
  }
  
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Sanitizes text content by removing or escaping potentially dangerous content
 * @param text - The text to sanitize
 * @returns The sanitized text
 */
export function sanitizeText(text: string): string {
  if (typeof text !== 'string') {
    return String(text);
  }
  
  // Remove any HTML tags and their content for script/style tags
  const withoutDangerousTags = text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  
  // Remove other HTML tags but preserve their text content
  const withoutTags = withoutDangerousTags.replace(/<[^>]*>/g, '');
  
  // Escape any remaining special characters
  return escapeHtml(withoutTags);
}

/**
 * Creates a safe HTML template with escaped interpolated values
 * @param template - The HTML template with ${} placeholders
 * @param values - Object containing values to interpolate
 * @returns Safe HTML string with escaped values
 */
export function createSafeHtml(template: string, values: Record<string, unknown>): string {
  return template.replace(/\$\{(\w+)\}/g, (_, key) => {
    const value = values[key];
    if (value === undefined || value === null) {
      return '';
    }
    return escapeHtml(String(value));
  });
}

/**
 * Validates that a string contains only safe characters for use in HTML
 * @param input - The input to validate
 * @returns True if the input is safe, false otherwise
 */
export function isHtmlSafe(input: string): boolean {
  if (typeof input !== 'string') {
    return false;
  }
  
  // Check for potentially dangerous patterns
  const dangerousPatterns = [
    /<script/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /javascript:/i,
    /vbscript:/i,
    /on\w+\s*=/i, // Event handlers like onclick=
  ];
  
  return !dangerousPatterns.some(pattern => pattern.test(input));
}