import type { LinkedAccount } from "./linked-account.types.js";

export function canDisableLoginForLinkedAccount(accounts: readonly LinkedAccount[], accountId: string): boolean {
  const target = accounts.find((account) => account.id === accountId);

  if (!target?.allowLogin || !target.capabilities.includes("login")) {
    return true;
  }

  return accounts.some((account) => account.id !== accountId && account.allowLogin && account.capabilities.includes("login"));
}
