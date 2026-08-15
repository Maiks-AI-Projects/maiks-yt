export type CommunityRule = {
  title: string;
  description: string;
};

export const communityRules: readonly CommunityRule[] = [
  {
    title: "Treat people like people",
    description:
      "No harassment, threats, hate, targeted insults, encouragement of self-harm, or attempts to make someone feel unsafe."
  },
  {
    title: "Keep shared spaces usable",
    description:
      "No spam, raids, repeated disruption, impersonation, or deliberate attempts to derail streams, chats, overlays, or community tools."
  },
  {
    title: "Use identity features honestly",
    description:
      "No offensive names or avatars, malicious account linking, fake claims, or impersonation of Michael, helpers, platforms, sponsors, or other viewers."
  },
  {
    title: "Do not abuse support systems",
    description:
      "No fake donation claims, chargeback abuse, fraud attempts, or pressure around private support. Money never buys permission to harm others."
  },
  {
    title: "Keep private information private",
    description:
      "No doxxing, credential sharing, posting private messages, or attempts to expose hidden account, moderation, or administration data."
  },
  {
    title: "Respect platform and legal boundaries",
    description:
      "Serious threats, stalking, fraud, exploitation, or other severe abuse may be reported to the relevant platform or authorities."
  }
] as const;

export const moderationSteps = [
  {
    label: "Context",
    title: "Note",
    description: "Internal context for reviewers, with no automatic penalty."
  },
  {
    label: "Clear request",
    title: "Warning",
    description: "A human-reviewed explanation of what crossed the line and what needs to change."
  },
  {
    label: "Escalation",
    title: "Strike",
    description: "A reviewed response to repeated or serious behaviour, tied to a rule and supporting context."
  },
  {
    label: "Immediate safety",
    title: "Restriction",
    description: "A temporary mute, visibility hold, or access limit when a shared space needs protection."
  },
  {
    label: "Owner decision",
    title: "Ban",
    description: "Reserved for severe or repeated abuse after review, except when immediate safety requires urgent action."
  }
] as const;
