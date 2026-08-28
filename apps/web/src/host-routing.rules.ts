export const maiksPlaysHost = "plays.maiks.yt";

type HostRoutingInput = {
  hostHeader: string | null;
  pathname: string;
};

export type HostRoutingDecision =
  | { action: "next" }
  | { action: "rewrite"; pathname: "/plays" };

const hostLabelPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const portPattern = /^(?:[1-9][0-9]{0,4})$/;

export const normalizeHostHeader = (hostHeader: string | null): string | null => {
  const rawValue = hostHeader?.trim();

  if (!rawValue || /[\s/@\\,]/.test(rawValue)) {
    return null;
  }

  const lowerValue = rawValue.toLowerCase();

  if (lowerValue.startsWith("[") || lowerValue.includes("]")) {
    return null;
  }

  const segments = lowerValue.split(":");

  if (segments.length > 2) {
    return null;
  }

  const hostnameWithPossibleRootDot = segments[0];
  const port = segments[1];

  if (!hostnameWithPossibleRootDot) {
    return null;
  }

  if (port !== undefined) {
    if (!portPattern.test(port)) {
      return null;
    }

    const parsedPort = Number(port);

    if (!Number.isInteger(parsedPort) || parsedPort > 65535) {
      return null;
    }
  }

  const hostname = hostnameWithPossibleRootDot.endsWith(".")
    ? hostnameWithPossibleRootDot.slice(0, -1)
    : hostnameWithPossibleRootDot;

  if (!hostname || hostname.length > 253) {
    return null;
  }

  const labels = hostname.split(".");

  if (labels.length < 2 || labels.some((label) => !hostLabelPattern.test(label))) {
    return null;
  }

  return hostname;
};

export const getHostRoutingDecision = ({
  hostHeader,
  pathname
}: HostRoutingInput): HostRoutingDecision => {
  const hostname = normalizeHostHeader(hostHeader);

  if (hostname === maiksPlaysHost && pathname === "/") {
    return { action: "rewrite", pathname: "/plays" };
  }

  return { action: "next" };
};
