export type AppEnvironment = "development" | "test" | "production";

export type AppSurface = "web" | "api" | "overlay" | "control-panel";

export type RuntimeConfig = {
  environment: AppEnvironment;
  surface: AppSurface;
  publicBaseUrl: string;
};

export const createRuntimeConfig = (config: RuntimeConfig): RuntimeConfig => config;

export * from "./localization.config.js";
export * from "./telemetry.config.js";
