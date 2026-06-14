export const telemetryEventNames = [
  "auth.failure",
  "auth.suspicious-link",
  "security.rate-limit",
  "security.token-denied",
  "sponsor.impression",
  "sponsor.click",
  "system.health-failure"
] as const;

export type TelemetryEventName = typeof telemetryEventNames[number];

export type TelemetryDataClass =
  | "operational"
  | "security"
  | "sponsor-aggregate";

export type TelemetryEventDefinition = {
  dataClass: TelemetryDataClass;
  retentionDays: number;
  containsMessageContent: false;
  containsSensitiveProfileData: false;
};

export const telemetryEventDefinitions = {
  "auth.failure": {
    dataClass: "security",
    retentionDays: 30,
    containsMessageContent: false,
    containsSensitiveProfileData: false
  },
  "auth.suspicious-link": {
    dataClass: "security",
    retentionDays: 90,
    containsMessageContent: false,
    containsSensitiveProfileData: false
  },
  "security.rate-limit": {
    dataClass: "security",
    retentionDays: 30,
    containsMessageContent: false,
    containsSensitiveProfileData: false
  },
  "security.token-denied": {
    dataClass: "security",
    retentionDays: 30,
    containsMessageContent: false,
    containsSensitiveProfileData: false
  },
  "sponsor.impression": {
    dataClass: "sponsor-aggregate",
    retentionDays: 365,
    containsMessageContent: false,
    containsSensitiveProfileData: false
  },
  "sponsor.click": {
    dataClass: "sponsor-aggregate",
    retentionDays: 365,
    containsMessageContent: false,
    containsSensitiveProfileData: false
  },
  "system.health-failure": {
    dataClass: "operational",
    retentionDays: 30,
    containsMessageContent: false,
    containsSensitiveProfileData: false
  }
} satisfies Record<TelemetryEventName, TelemetryEventDefinition>;

export const isAllowedTelemetryEvent = (value: string): value is TelemetryEventName =>
  telemetryEventNames.includes(value as TelemetryEventName);
