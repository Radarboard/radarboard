/**
 * Resend — Integration Descriptor
 */

import type { IntegrationDescriptor } from "@radarboard/integration-sdk/types";
import { Globe } from "lucide-react";

export const resendDescriptor: IntegrationDescriptor = {
  id: "resend",
  name: "Resend",
  description: "Transactional email delivery for alert notifications via the Resend API.",
  icon: Globe,
  category: "communication",
  apiDocsUrl: "https://resend.com/docs/api-reference",
  auth: {
    id: "resend",
    name: "Resend",
    type: "api_key",
    fields: [
      {
        key: "apiKey",
        label: "API Key",
        type: "password",
        placeholder: "re_…",
        helpText: "Create an API key at resend.com/api-keys.",
      },
      {
        key: "fromEmail",
        label: "From Email",
        type: "text",
        placeholder: "alerts@yourdomain.com",
        helpText: "Sender address (must be verified in Resend).",
      },
      {
        key: "toEmail",
        label: "Default Recipient",
        type: "text",
        placeholder: "you@example.com",
        helpText: "Default recipient for alert emails.",
      },
    ],
    docsUrl: "https://resend.com/docs/api-reference",
    testEndpoint: "/api/credentials/test",
  },
};
