import type { IconType } from "react-icons";
import { SiDiscord, SiGithub, SiGoogle, SiTwitch } from "react-icons/si";

import type { OAuthProviderId, ProfileVisibility } from "./account.types";

export type ProviderDefinition = {
  id: OAuthProviderId;
  label: string;
  Icon: IconType;
  description: string;
};

export const providerDefinitions: readonly ProviderDefinition[] = [
  { id: "google", label: "Google", Icon: SiGoogle, description: "Google account and YouTube identity" },
  { id: "twitch", label: "Twitch", Icon: SiTwitch, description: "Streaming identity and chat" },
  { id: "discord", label: "Discord", Icon: SiDiscord, description: "Community identity and roles" },
  { id: "github", label: "GitHub", Icon: SiGithub, description: "Projects and contributions" }
];

export const profileVisibilityOptions: ReadonlyArray<{
  value: ProfileVisibility;
  label: string;
  description: string;
}> = [
  {
    value: "private",
    label: "Private",
    description: "People can find your account name, but your profile details stay hidden."
  },
  {
    value: "minimal",
    label: "Limited",
    description: "Show a basic profile without exposing connected accounts."
  },
  {
    value: "public",
    label: "Public",
    description: "Allow the profile information you choose to publish to be visible."
  }
];
