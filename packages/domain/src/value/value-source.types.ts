export type ValueSourceType = "direct" | "platform" | "manual" | "affiliate" | "sponsor" | "internal";

export type ValueKind = "money" | "restricted-credit" | "non-monetary";

export type ValueSource = {
  id: string;
  key: string;
  label: string;
  provider: string;
  sourceType: ValueSourceType;
  valueKind: ValueKind;
  currencyCode?: string;
  payoutEligible: boolean;
  enabled: boolean;
};
