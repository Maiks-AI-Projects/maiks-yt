import { google } from "googleapis";

import { createYouTubeWarningMessage } from "./youtube-chat-warning.rules.js";
import type {
  YouTubeChatWarningContextResolver,
  YouTubeChatWarningDeliveryResult,
  YouTubeChatWarningInput,
  YouTubeChatWarningInsert
} from "./youtube-chat-warning.types.js";
import type { YouTubeLiveChatContext } from "./youtube-live-chat-intake.types.js";
import { hasYouTubeLiveChatWriteScope } from "./youtube-owner-oauth.rules.js";

type YouTubeChatWarningDeliveryOptions = {
  contextResolver: YouTubeChatWarningContextResolver;
  insertMessage?: YouTubeChatWarningInsert;
};

const createYouTubeClient = (context: YouTubeLiveChatContext) => {
  const client = new google.auth.OAuth2(
    context.config.clientId,
    context.config.clientSecret,
    context.config.redirectUri
  );

  client.setCredentials({
    ...(context.credential.accessToken ? { access_token: context.credential.accessToken } : {}),
    refresh_token: context.credential.refreshToken,
    ...(context.credential.accessTokenExpiresAt ? { expiry_date: context.credential.accessTokenExpiresAt.getTime() } : {})
  });

  return google.youtube({
    auth: client,
    version: "v3"
  });
};

const defaultInsertMessage: YouTubeChatWarningInsert = async ({ context, liveChatId, text }) => {
  const youtube = createYouTubeClient(context);
  const response = await youtube.liveChatMessages.insert({
    part: ["snippet"],
    requestBody: {
      snippet: {
        liveChatId,
        textMessageDetails: {
          messageText: text
        },
        type: "textMessageEvent"
      }
    }
  });

  return {
    id: response.data.id ?? null
  };
};

export class YouTubeChatWarningDeliveryService {
  private readonly contextResolver: YouTubeChatWarningContextResolver;
  private readonly insertMessage: YouTubeChatWarningInsert;

  public constructor(options: YouTubeChatWarningDeliveryOptions) {
    this.contextResolver = options.contextResolver;
    this.insertMessage = options.insertMessage ?? defaultInsertMessage;
  }

  public async sendWarning(input: YouTubeChatWarningInput): Promise<YouTubeChatWarningDeliveryResult> {
    const warningMessage = createYouTubeWarningMessage(input);
    const liveChatId = input.liveChatId?.trim() ?? "";

    if (!liveChatId) {
      return {
        ok: false,
        providerAction: false,
        providerMessage: warningMessage.content,
        providerMessageId: null,
        providerMessageSent: false,
        reason: "youtube_warning_live_chat_missing"
      };
    }

    const context = await this.contextResolver();

    if (!context) {
      return {
        ok: false,
        providerAction: false,
        providerMessage: warningMessage.content,
        providerMessageId: null,
        providerMessageSent: false,
        reason: "youtube_warning_context_missing"
      };
    }

    if (!hasYouTubeLiveChatWriteScope(context.credential.scopes ?? [])) {
      return {
        ok: false,
        providerAction: false,
        providerMessage: warningMessage.content,
        providerMessageId: null,
        providerMessageSent: false,
        reason: "youtube_warning_scope_missing"
      };
    }

    try {
      const inserted = await this.insertMessage({
        context,
        liveChatId,
        text: warningMessage.content
      });

      return {
        ok: true,
        providerAction: true,
        providerMessage: warningMessage.content,
        providerMessageId: inserted.id ?? `youtube-warning-${Date.now()}`,
        providerMessageSent: true
      };
    } catch {
      return {
        ok: false,
        providerAction: true,
        providerMessage: warningMessage.content,
        providerMessageId: "youtube-warning-unavailable",
        providerMessageSent: false,
        reason: "youtube_warning_unavailable"
      };
    }
  }
}
