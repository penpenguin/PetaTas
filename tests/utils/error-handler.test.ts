import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ErrorHandler, handleStorageError, handleClipboardError, ErrorSeverity } from '../../src/utils/error-handler';

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;
  let consoleLogSpy: any;
  let consoleWarnSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    errorHandler = ErrorHandler.getInstance();
    errorHandler.clearErrorLog();
    
    // Mock console methods
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('handleError', () => {
    it('should log errors with appropriate console method based on severity', () => {
      const context = { module: 'test', operation: 'testOp' };
      
      errorHandler.handleError(new Error('Low severity'), 'low', context);
      expect(consoleLogSpy).toHaveBeenCalled();
      
      errorHandler.handleError(new Error('Medium severity'), 'medium', context);
      expect(consoleWarnSpy).toHaveBeenCalled();
      
      errorHandler.handleError(new Error('High severity'), 'high', context);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should normalize non-Error objects', () => {
      const context = { module: 'test', operation: 'testOp' };
      
      errorHandler.handleError('string error', 'medium', context);
      errorHandler.handleError({ message: 'object error' }, 'medium', context);
      
      const stats = errorHandler.getErrorStats();
      expect(stats.total).toBe(2);
    });

    it('should store errors in log', () => {
      const context = { module: 'test', operation: 'testOp' };
      const error = new Error('Test error');
      
      errorHandler.handleError(error, 'medium', context);
      
      const stats = errorHandler.getErrorStats();
      expect(stats.total).toBe(1);
      expect(stats.bySeverity.medium).toBe(1);
      expect(stats.recent[0].error.message).toBe('Test error');
    });
  });

    it('should dispatch error-notification events with provided user message', () => {
      const context = { module: 'ui', operation: 'showToast' };
      const listener = vi.fn<(event: Event) => void>();
      document.addEventListener('error-notification', listener);

      errorHandler.handleError(new Error('Notify'), 'high', context, 'Display this');

      expect(listener).toHaveBeenCalledTimes(1);
      const evt = listener.mock.calls[0][0] as CustomEvent<{ message?: string; severity?: string; timestamp: number }>;
      expect(evt.detail.message).toBe('Display this');
      expect(evt.detail.severity).toBe('high');
      expect(evt.detail.timestamp).toBeInstanceOf(Date);

      document.removeEventListener('error-notification', listener);
    });

  describe('handleStorageError', () => {
    it('should handle throttling errors with low severity', () => {
      const context = { module: 'storage', operation: 'save' };
      const error = new Error('Write operation replaced by newer write');
      
      handleStorageError(error, context);
      
      const stats = errorHandler.getErrorStats();
      expect(stats.bySeverity.low).toBe(1);
    });

    it('should handle quota exceeded errors with high severity', () => {
      const context = { module: 'storage', operation: 'save' };
      const error = new Error('QUOTA_BYTES_PER_ITEM exceeded');
      
      handleStorageError(error, context);
      
      const stats = errorHandler.getErrorStats();
      expect(stats.bySeverity.high).toBe(1);
    });

    it('should handle rate limit errors with medium severity', () => {
      const context = { module: 'storage', operation: 'save' };
      const error = new Error('MAX_WRITE_OPERATIONS_PER_MINUTE exceeded');
      
      handleStorageError(error, context);
      
      const stats = errorHandler.getErrorStats();
      expect(stats.bySeverity.medium).toBe(1);
    });

    it('should handle general storage errors with medium severity', () => {
      const context = { module: 'storage', operation: 'save' };
      const error = new Error('General storage error');
      
      handleStorageError(error, context);
      
      const stats = errorHandler.getErrorStats();
      expect(stats.bySeverity.medium).toBe(1);
    });
  });

  describe('handleClipboardError', () => {
    it('should handle NotAllowedError with high severity', () => {
      const context = { module: 'clipboard', operation: 'read' };
      const error = new Error('Permission denied');
      error.name = 'NotAllowedError';
      
      handleClipboardError(error, context, 'read');
      
      const stats = errorHandler.getErrorStats();
      expect(stats.bySeverity.high).toBe(1);
    });

    it('should handle general clipboard errors with medium severity', () => {
      const context = { module: 'clipboard', operation: 'write' };
      const error = new Error('Clipboard write failed');
      
      handleClipboardError(error, context, 'write');
      
      const stats = errorHandler.getErrorStats();
      expect(stats.bySeverity.medium).toBe(1);
    });
  });

  describe('getErrorStats', () => {
    it('should return correct statistics', () => {
      const context = { module: 'test', operation: 'testOp' };
      
      // Add errors of different severities
      errorHandler.handleError(new Error('Low 1'), 'low', context);
      errorHandler.handleError(new Error('Low 2'), 'low', context);
      errorHandler.handleError(new Error('Medium 1'), 'medium', context);
      errorHandler.handleError(new Error('High 1'), 'high', context);
      
      const stats = errorHandler.getErrorStats();
      
      expect(stats.total).toBe(4);
      expect(stats.bySeverity.low).toBe(2);
      expect(stats.bySeverity.medium).toBe(1);
      expect(stats.bySeverity.high).toBe(1);
      expect(stats.bySeverity.critical).toBe(0);
      expect(stats.recent.length).toBe(4);
    });

    it('should limit recent errors to 10', () => {
      const context = { module: 'test', operation: 'testOp' };
      
      // Add 15 errors
      for (let i = 0; i < 15; i++) {
        errorHandler.handleError(new Error(`Error ${i}`), 'low', context);
      }
      
      const stats = errorHandler.getErrorStats();
      
      expect(stats.total).toBe(15);
      expect(stats.recent.length).toBe(10);
      // Should have the most recent errors
      expect(stats.recent[9].error.message).toBe('Error 14');
    });
  });

  describe('clearErrorLog', () => {
    it('should clear the error log', () => {
      const context = { module: 'test', operation: 'testOp' };
      
      errorHandler.handleError(new Error('Test'), 'medium', context);
      expect(errorHandler.getErrorStats().total).toBe(1);
      
      errorHandler.clearErrorLog();
      expect(errorHandler.getErrorStats().total).toBe(0);
    });
  });
});