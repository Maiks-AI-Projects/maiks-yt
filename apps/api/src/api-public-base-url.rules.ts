type ApiPublicBaseUrlEnvironment = {
  API_PUBLIC_BASE_URL?: string | undefined;
  NODE_ENV?: string | undefined;
};

const readProcessEnvironment = (): ApiPublicBaseUrlEnvironment => ({
  API_PUBLIC_BASE_URL: process.env.API_PUBLIC_BASE_URL,
  NODE_ENV: process.env.NODE_ENV
});

export const getApiPublicBaseUrl = (
  environment: ApiPublicBaseUrlEnvironment = readProcessEnvironment()
): string => {
  const configuredBaseUrl = environment.API_PUBLIC_BASE_URL?.trim();

  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/+$/u, "");
  }

  return environment.NODE_ENV === "production"
    ? "https://api.maiks.yt"
    : "http://localhost:3001";
};
