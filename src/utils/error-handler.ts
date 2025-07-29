// Centralized error handling for PetaTas Chrome Extension
// Provides consistent error logging, user notifications, and recovery patterns

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ErrorContext {
  module: string;
  operation: string;
  userId?: string;
  taskId?: string;
  additionalData?: Record<string, unknown>;
}

export interface ErrorInfo {
  error: Error;
  severity: ErrorSeverity;
  context: ErrorContext;
  timestamp: Date;
  shouldNotifyUser: boolean;
  userMessage?: string;
}

/**
 * Centralized error handler that provides consistent logging and user notification
 */
export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorLog: ErrorInfo[] = [];
  private maxLogSize = 100; // Keep last 100 errors

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Handle an error with context and user notification
   */
  handleError(
    error: Error | unknown,
    severity: ErrorSeverity,
    context: ErrorContext,
    userMessage?: string
  ): void {
    const errorInfo: ErrorInfo = {
      error: this.normalizeError(error),
      severity,
      context,
      timestamp: new Date(),
      shouldNotifyUser: severity === 'high' || severity === 'critical',
      userMessage: userMessage || this.getDefaultUserMessage(severity)
    };

    // Log the error
    this.logError(errorInfo);

    // Store in local error log
    this.addToErrorLog(errorInfo);

    // Notify user if appropriate
    if (errorInfo.shouldNotifyUser && userMessage) {
      this.notifyUser(errorInfo);
    }
  }

  /**
   * Handle storage-related errors with specific patterns
   */
  handleStorageError(
    error: Error | unknown,
    context: ErrorContext,
    userMessage?: string
  ): void {
    const normalizedError = this.normalizeError(error);
    
    // Check for specific storage error types
    if (normalizedError.message.includes('Write operation replaced by newer write')) {
      // This is expected throttling behavior - log at low severity without user notification
      this.handleError(normalizedError, 'low', context);
      return;
    }

    if (normalizedError.message.includes('QUOTA_BYTES_PER_ITEM') || 
        normalizedError.message.includes('Data size')) {
      // Storage quota exceeded - high severity with user notification
      this.handleError(
        normalizedError, 
        'high', 
        context, 
        userMessage || 'Storage quota exceeded. Please delete some tasks to continue.'
      );
      return;
    }

    if (normalizedError.message.includes('MAX_WRITE_OPERATIONS_PER_MINUTE')) {
      // Rate limit exceeded - medium severity with user notification
      this.handleError(
        normalizedError, 
        'medium', 
        context, 
        userMessage || 'Too many changes too quickly. Please wait a moment before making more changes.'
      );
      return;
    }

    // General storage error
    this.handleError(
      normalizedError, 
      'medium', 
      context, 
      userMessage || 'Failed to save data. Please try again.'
    );
  }

  /**
   * Handle network/API related errors
   */
  handleNetworkError(
    error: Error | unknown,
    context: ErrorContext,
    userMessage?: string
  ): void {
    const normalizedError = this.normalizeError(error);
    
    if (normalizedError.name === 'NotAllowedError') {
      this.handleError(
        normalizedError, 
        'high', 
        context, 
        userMessage || 'Permission denied. Please check your browser settings.'
      );
      return;
    }

    this.handleError(
      normalizedError, 
      'medium', 
      context, 
      userMessage || 'Network operation failed. Please check your connection and try again.'
    );
  }

  /**
   * Handle clipboard operation errors
   */
  handleClipboardError(
    error: Error | unknown,
    context: ErrorContext,
    operation: 'read' | 'write'
  ): void {
    const normalizedError = this.normalizeError(error);
    
    if (normalizedError.name === 'NotAllowedError') {
      const message = operation === 'read' 
        ? 'Clipboard access denied. Please allow clipboard permissions.' 
        : 'Cannot copy to clipboard. Please allow clipboard permissions.';
      
      this.handleError(normalizedError, 'high', context, message);
      return;
    }

    const message = operation === 'read'
      ? 'Failed to read from clipboard. Please try again.'
      : 'Failed to copy to clipboard. Please try again.';
    
    this.handleError(normalizedError, 'medium', context, message);
  }

  /**
   * Get error statistics for debugging
   */
  getErrorStats(): { total: number; bySeverity: Record<ErrorSeverity, number>; recent: ErrorInfo[] } {
    const bySeverity: Record<ErrorSeverity, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };

    this.errorLog.forEach(errorInfo => {
      bySeverity[errorInfo.severity]++;
    });

    const recent = this.errorLog.slice(-10); // Last 10 errors

    return {
      total: this.errorLog.length,
      bySeverity,
      recent
    };
  }

  /**
   * Clear error log (useful for testing)
   */
  clearErrorLog(): void {
    this.errorLog = [];
  }

  private normalizeError(error: Error | unknown): Error {
    if (error instanceof Error) {
      return error;
    }
    
    if (typeof error === 'string') {
      return new Error(error);
    }
    
    return new Error(`Unknown error: ${JSON.stringify(error)}`);
  }

  private logError(errorInfo: ErrorInfo): void {
    const logLevel = this.getLogLevel(errorInfo.severity);
    const message = `[${errorInfo.context.module}:${errorInfo.context.operation}] ${errorInfo.error.message}`;
    
    if (logLevel === 'error') {
      console.error(message, {
        error: errorInfo.error,
        context: errorInfo.context,
        timestamp: errorInfo.timestamp
      });
    } else if (logLevel === 'warn') {
      console.warn(message, {
        error: errorInfo.error,
        context: errorInfo.context,
        timestamp: errorInfo.timestamp
      });
    } else {
      console.log(message, {
        error: errorInfo.error,
        context: errorInfo.context,
        timestamp: errorInfo.timestamp
      });
    }
  }

  private getLogLevel(severity: ErrorSeverity): 'log' | 'warn' | 'error' {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'error';
      case 'medium':
        return 'warn';
      case 'low':
      default:
        return 'log';
    }
  }

  private getDefaultUserMessage(severity: ErrorSeverity): string {
    switch (severity) {
      case 'critical':
        return 'A critical error occurred. Please refresh the page and try again.';
      case 'high':
        return 'An error occurred. Please try again.';
      case 'medium':
        return 'Operation failed. Please try again.';
      case 'low':
      default:
        return '';
    }
  }

  private addToErrorLog(errorInfo: ErrorInfo): void {
    this.errorLog.push(errorInfo);
    
    // Keep log size manageable
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(-this.maxLogSize);
    }
  }

  private notifyUser(errorInfo: ErrorInfo): void {
    // This would integrate with the application's toast notification system
    // For now, we'll just dispatch a custom event that the UI can listen for
    const event = new CustomEvent('error-notification', {
      detail: {
        message: errorInfo.userMessage,
        severity: errorInfo.severity,
        timestamp: errorInfo.timestamp
      }
    });
    
    if (typeof document !== 'undefined') {
      document.dispatchEvent(event);
    }
  }
}

// Convenience functions for common error handling patterns
export const errorHandler = ErrorHandler.getInstance();

export function handleStorageError(error: unknown, context: ErrorContext, userMessage?: string): void {
  errorHandler.handleStorageError(error, context, userMessage);
}

export function handleClipboardError(error: unknown, context: ErrorContext, operation: 'read' | 'write'): void {
  errorHandler.handleClipboardError(error, context, operation);
}

export function handleNetworkError(error: unknown, context: ErrorContext, userMessage?: string): void {
  errorHandler.handleNetworkError(error, context, userMessage);
}

export function handleGeneralError(error: unknown, severity: ErrorSeverity, context: ErrorContext, userMessage?: string): void {
  errorHandler.handleError(error, severity, context, userMessage);
}