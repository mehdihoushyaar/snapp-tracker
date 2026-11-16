import { TrackerTimeoutError } from '../errors/TrackerTimeoutError';

export async function withTimeout<T>(
  action: () => T | Promise<T>,
  ms: number,
  trackerId: string,
  operation: string,
): Promise<T> {
  if (ms <= 0) return action();

  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TrackerTimeoutError(trackerId, ms, operation)), ms);
  });

  try {
    return await Promise.race([Promise.resolve().then(action), timeout]);
  } finally {
    clearTimeout(timer!);
  }
}
