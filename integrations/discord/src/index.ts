/**
 * Discord — Integration Descriptor
 */

import type { IntegrationDescriptor } from "@radarboard/integration-sdk/types";
import { Globe } from "lucide-react";
import { discordDataSources } from "./api/data-sources";

export const discordDescriptor: IntegrationDescriptor = {
  id: "discord",
  name: "Discord",
  description: "Server overview, member count, boost level, and recent messages from Discord.",
  icon: Globe,
  category: "communication",
  defaultStatusPageUrl: "https://discordstatus.com/",
  apiDocsUrl: "https://discord.com/developers/docs/reference",
  auth: {
    id: "discord",
    name: "Discord",
    type: "api_key",
    fields: [
      {
        key: "botToken",
        label: "Bot Token",
        type: "password",
        placeholder: "your-bot-token",
      },
      {
        key: "guildId",
        label: "Guild (Server) ID",
        type: "text",
        placeholder: "123456789012345678",
      },
    ],
    docsUrl: "https://discord.com/developers/docs/getting-started",
    testEndpoint: "/api/credentials/test",
  },
  dataSources: discordDataSources,
};
