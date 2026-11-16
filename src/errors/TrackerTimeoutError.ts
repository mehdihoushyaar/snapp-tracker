import { ERROR_CODE } from '../constants/errors';

export class TrackerTimeoutError extends Error {
  readonly code = ERROR_CODE.TRACKER_TIMEOUT;

  constructor(
    readonly trackerId: string,
    readonly timeoutMs: number,
    operation: string,
  ) {
    super(`Tracker "${trackerId}" timed out during ${operation} after ${timeoutMs}ms.`);
    this.name = 'TrackerTimeoutError';
  }
}
