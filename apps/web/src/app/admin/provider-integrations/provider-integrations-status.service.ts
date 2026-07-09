import type {
  LoadState,
  ProviderCapabilityState,
  ProviderIntegrationState
} from "./provider-integrations-status.types";

export const stateLabels: Record<ProviderIntegrationState, string> = {
  configured: "Configured",
  missing: "Missing",
  invalid: "Invalid",
  disabled: "Disabled",
  error: "Error"
};

export const capabilityStateLabels: Record<ProviderCapabilityState, string> = {
  available: "Available",
  configured: "Configured",
  missing: "Missing",
  not_enabled: "Not enabled",
  gated: "Gated"
};

export const formatDate = (value: string): string =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));

export const getFailureMessage = (response: Response, reason?: string): string => {
  if (response.status === 401 || reason === "not_authenticated") {
    return "Sign in before opening provider integration status.";
  }

  if (
    response.status === 403
    || reason === "provider_integrations_forbidden"
    || reason === "provider_integrations_user_unlinked"
  ) {
    return "Your account does not have owner access to provider integration status.";
  }

  return `Provider integration status request failed with ${response.status}.`;
};

export const getLoadStateForFailure = (response: Response, reason?: string): LoadState => {
  if (response.status === 401 || reason === "not_authenticated") {
    return "signed-out";
  }

  if (
    response.status === 403
    || reason === "provider_integrations_forbidden"
    || reason === "provider_integrations_user_unlinked"
  ) {
    return "forbidden";
  }

  return "failed";
};

export const parseJson = async <ResponseBody,>(response: Response): Promise<ResponseBody | null> => {
  try {
    return await response.json() as ResponseBody;
  } catch {
    return null;
  }
};
