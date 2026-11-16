import type { TrackerErrorContext } from '../types/core';

export class ErrorHandler {
  constructor(
    private readonly onError?: (
      error: unknown,
      context: TrackerErrorContext,
    ) => void,
  ) {}

  report(
    error: unknown,
    trackerId: string,
    operation: TrackerErrorContext['operation'],
    topic?: string,
  ): void {
    try {
      this.onError?.(error, {
        trackerId,
        operation,
        ...(topic !== undefined ? { topic } : {}),
        timestamp: Date.now(),
      });
    } catch {}
  }
}
