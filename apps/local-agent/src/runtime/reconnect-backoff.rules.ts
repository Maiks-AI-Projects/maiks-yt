export type ReconnectBackoff = {
  baseMs: number;
  maxMs: number;
};

export function getReconnectDelayMs(
  attempt: number,
  policy: ReconnectBackoff,
  random: () => number = Math.random
): number {
  const boundedAttempt = Math.max(0, Math.min(attempt, 30));
  const ceiling = Math.min(policy.maxMs, policy.baseMs * (2 ** boundedAttempt));
  return Math.floor(Math.max(0, Math.min(1, random())) * ceiling);
}
