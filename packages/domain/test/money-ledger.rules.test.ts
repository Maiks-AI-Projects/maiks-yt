import { describe, expect, it } from "vitest";

import {
  isValidMoneyLedgerTransactionInput,
  isValidMoneyRuleVersionInput
} from "../src/money/index.js";

const validRule = {
  ruleKind: "platform_fee",
  provider: "kofi",
  valueSource: "eur",
  appliesToDateBasis: "event_date",
  effectiveFrom: "2026-07-01T00:00:00.000Z",
  effectiveUntil: null,
  percentageBps: 1000,
  fixedAmountMinor: 35,
  fixedCurrency: "EUR",
  rulePayload: null,
  changeReason: "Ko-fi platform fee changed.",
  supersedesRuleId: null
} as const;

describe("money ledger rules", () => {
  it("accepts dated fee and split rule versions", () => {
    expect(isValidMoneyRuleVersionInput(validRule)).toBe(true);
    expect(isValidMoneyRuleVersionInput({
      ...validRule,
      ruleKind: "platform_split",
      provider: "youtube",
      effectiveUntil: "2026-12-01T00:00:00.000Z",
      fixedAmountMinor: null,
      fixedCurrency: null,
      rulePayload: {
        note: "Partner split estimate"
      }
    })).toBe(true);
  });

  it("rejects unsafe or ambiguous rule versions", () => {
    expect(isValidMoneyRuleVersionInput({
      ...validRule,
      percentageBps: 10_001
    })).toBe(false);
    expect(isValidMoneyRuleVersionInput({
      ...validRule,
      effectiveUntil: "2026-06-01T00:00:00.000Z"
    })).toBe(false);
    expect(isValidMoneyRuleVersionInput({
      ...validRule,
      fixedAmountMinor: 50,
      fixedCurrency: null
    })).toBe(false);
    expect(isValidMoneyRuleVersionInput({
      ...validRule,
      changeReason: ""
    })).toBe(false);
  });

  it("keeps basic ledger transaction validation intact", () => {
    expect(isValidMoneyLedgerTransactionInput({
      transactionType: "income",
      moneyMode: "real",
      sourceKind: "manual",
      sourceProvider: "manual",
      postingStatus: "draft",
      occurredAt: "2026-07-10T10:00:00.000Z",
      accountingAt: "2026-07-10T10:00:00.000Z",
      correctsTransactionId: null,
      correctionReason: null,
      notesPrivate: null,
      lines: [
        {
          lineKind: "gross_income",
          direction: "in",
          amountMinor: 1234,
          currency: "EUR",
          valueSource: "eur",
          isEstimate: false,
          categoryKey: "support",
          projectId: null,
          projectItemId: null,
          receiptReference: null,
          notesPrivate: null
        }
      ]
    })).toBe(true);
  });
});
