export const twitchChatReplyRequiredScopes = ["chat:read", "chat:edit"] as const;

export type TwitchChatReplyReadinessIssue =
  | "client_mismatch"
  | "invalid_access_token"
  | "missing_configuration"
  | "missing_scope"
  | "validation_unavailable";

export type TwitchChatReplyReadinessStatus = {
  issue: TwitchChatReplyReadinessIssue | null;
  state: "available" | "needs_setup" | "needs_attention" | "disabled";
};
