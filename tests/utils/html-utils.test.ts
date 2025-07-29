import { describe, it, expect } from 'vitest';
import { escapeHtml, escapeHtmlAttribute, sanitizeText, createSafeHtml, isHtmlSafe } from '../../src/utils/html-utils';

describe('HTML Utils', () => {
  describe('escapeHtml', () => {
    it('should escape basic HTML special characters', () => {
      const input = '<script>alert("xss")</script>';
      const expected = '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;';
      expect(escapeHtml(input)).toBe(expected);
    });

    it('should escape ampersands', () => {
      expect(escapeHtml('A & B')).toBe('A &amp; B');
    });

    it('should escape quotes', () => {
      expect(escapeHtml('He said "Hello"')).toBe('He said &quot;Hello&quot;');
      expect(escapeHtml("It's working")).toBe('It&#039;s working');
    });

    it('should handle non-string input', () => {
      expect(escapeHtml(123 as any)).toBe('123');
      expect(escapeHtml(null as any)).toBe('null');
      expect(escapeHtml(undefined as any)).toBe('undefined');
    });

    it('should return empty string unchanged', () => {
      expect(escapeHtml('')).toBe('');
    });
  });

  describe('escapeHtmlAttribute', () => {
    it('should escape attribute values', () => {
      const input = 'value"with\'quotes';
      const expected = 'value&quot;with&#x27;quotes';
      expect(escapeHtmlAttribute(input)).toBe(expected);
    });

    it('should escape angle brackets in attributes', () => {
      expect(escapeHtmlAttribute('<script>')).toBe('&lt;script&gt;');
    });
  });

  describe('sanitizeText', () => {
    it('should remove HTML tags completely', () => {
      const input = 'Hello <script>alert("xss")</script> World';
      const expected = 'Hello  World';
      expect(sanitizeText(input)).toBe(expected);
    });

    it('should escape remaining special characters', () => {
      const input = 'Hello & "World"';
      const expected = 'Hello &amp; &quot;World&quot;';
      expect(sanitizeText(input)).toBe(expected);
    });

    it('should handle complex HTML', () => {
      const input = '<div class="test">Content</div><script>evil()</script>';
      const expected = 'Content';
      expect(sanitizeText(input)).toBe(expected);
    });
  });

  describe('createSafeHtml', () => {
    it('should interpolate and escape values', () => {
      const template = '<div title="${title}">${content}</div>';
      const values = { title: 'My "Title"', content: '<script>alert("xss")</script>' };
      const expected = '<div title="My &quot;Title&quot;">&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;</div>';
      expect(createSafeHtml(template, values)).toBe(expected);
    });

    it('should handle missing values', () => {
      const template = 'Hello ${name}, welcome to ${site}!';
      const values = { name: 'John' };
      const expected = 'Hello John, welcome to !';
      expect(createSafeHtml(template, values)).toBe(expected);
    });

    it('should handle null and undefined values', () => {
      const template = '${a} ${b} ${c}';
      const values = { a: null, b: undefined, c: 'valid' };
      const expected = '  valid';
      expect(createSafeHtml(template, values)).toBe(expected);
    });
  });

  describe('isHtmlSafe', () => {
    it('should return true for safe content', () => {
      expect(isHtmlSafe('Hello World')).toBe(true);
      expect(isHtmlSafe('Task #1: Review documents')).toBe(true);
      expect(isHtmlSafe('Price: $10.99')).toBe(true);
    });

    it('should return false for script tags', () => {
      expect(isHtmlSafe('<script>alert("xss")</script>')).toBe(false);
      expect(isHtmlSafe('Hello <SCRIPT>alert("xss")</SCRIPT> World')).toBe(false);
    });

    it('should return false for dangerous tags', () => {
      expect(isHtmlSafe('<iframe src="evil.com"></iframe>')).toBe(false);
      expect(isHtmlSafe('<object data="evil.swf"></object>')).toBe(false);
      expect(isHtmlSafe('<embed src="evil.swf">')).toBe(false);
    });

    it('should return false for javascript: URLs', () => {
      expect(isHtmlSafe('javascript:alert("xss")')).toBe(false);
      expect(isHtmlSafe('JAVASCRIPT:alert("xss")')).toBe(false);
    });

    it('should return false for event handlers', () => {
      expect(isHtmlSafe('onclick="alert(\'xss\')"')).toBe(false);
      expect(isHtmlSafe('onload="evil()"')).toBe(false);
      expect(isHtmlSafe('onmouseover = "attack()"')).toBe(false);
    });

    it('should return false for non-string input', () => {
      expect(isHtmlSafe(123 as any)).toBe(false);
      expect(isHtmlSafe(null as any)).toBe(false);
      expect(isHtmlSafe(undefined as any)).toBe(false);
    });
  });
});