type BetterAuthOriginEnvironment = {
  AUTH_TRUSTED_ORIGINS?: string | undefined;
  BETTER_AUTH_TRUSTED_ORIGINS?: string | undefined;
  BETTER_AUTH_URL?: string | undefined;
  NODE_ENV?: string | undefined;
};

const developmentTrustedOrigins = [
  "http://localhost:3000",
  "http://localhost:3002",
  "http://localhost:3003",
  "https://web-dev.maiks.yt",
  "https://overlay-dev.maiks.yt",
  "https://control-dev.maiks.yt"
] as const;

const productionTrustedOrigins = [
  "https://maiks.yt",
  "https://www.maiks.yt",
  "https://control.maiks.yt",
  "https://overlay.maiks.yt"
] as const;

const dayInSeconds = 24 * 60 * 60;
export const betterAuthSessionPolicy = {
  expiresIn: 30 * dayInSeconds,
  updateAge: dayInSeconds
} as const;

const readProcessEnvironment = (): BetterAuthOriginEnvironment => ({
  AUTH_TRUSTED_ORIGINS: process.env.AUTH_TRUSTED_ORIGINS,
  BETTER_AUTH_TRUSTED_ORIGINS: process.env.BETTER_AUTH_TRUSTED_ORIGINS,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
  NODE_ENV: process.env.NODE_ENV
});

export const assertTrustedOriginEnvironment = (
  environment: BetterAuthOriginEnvironment = readProcessEnvironment()
): void => {
  if (
    environment.NODE_ENV === "production"
    && environment.BETTER_AUTH_TRUSTED_ORIGINS?.trim()
  ) {
    throw new Error(
      "BETTER_AUTH_TRUSTED_ORIGINS is not supported in production; use AUTH_TRUSTED_ORIGINS."
    );
  }
};

export const getTrustedOrigins = (
  environment: BetterAuthOriginEnvironment = readProcessEnvironment()
): string[] => {
  const configuredOrigins = environment.AUTH_TRUSTED_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (configuredOrigins?.length) {
    return [...new Set(configuredOrigins)];
  }

  return environment.NODE_ENV === "production"
    ? [...productionTrustedOrigins]
    : [...developmentTrustedOrigins];
};

export const getBetterAuthBaseUrl = (
  environment: BetterAuthOriginEnvironment = readProcessEnvironment()
): string => environment.BETTER_AUTH_URL?.trim()
  || (environment.NODE_ENV === "production" ? "https://api.maiks.yt" : "http://localhost:3001");
