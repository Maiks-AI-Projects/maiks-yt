export const supportedLocales = ["en", "nl"] as const;

export type SupportedLocale = typeof supportedLocales[number];

export const defaultLocale: SupportedLocale = "en";

export const isSupportedLocale = (value: string): value is SupportedLocale =>
  supportedLocales.includes(value as SupportedLocale);

export const resolveLocale = (value: string | null | undefined): SupportedLocale =>
  value && isSupportedLocale(value.toLowerCase()) ? value.toLowerCase() as SupportedLocale : defaultLocale;

export const createDateFormatter = (
  locale: SupportedLocale,
  options: Intl.DateTimeFormatOptions = { dateStyle: "long" }
): Intl.DateTimeFormat => new Intl.DateTimeFormat(locale, options);

export const createCurrencyFormatter = (
  locale: SupportedLocale,
  currency: string
): Intl.NumberFormat => new Intl.NumberFormat(locale, {
  currency,
  style: "currency"
});
