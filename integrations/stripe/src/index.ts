/**
 * Stripe — Integration Descriptor
 */

import type { IntegrationDescriptor } from "@radarboard/integration-sdk/types";
import { Globe } from "lucide-react";
import { stripeDataSources } from "./api/data-sources";

export const stripeDescriptor: IntegrationDescriptor = {
  id: "stripe",
  name: "Stripe",
  description: "Revenue metrics, subscriptions, charges, and MRR from Stripe.",
  icon: Globe,
  category: "revenue",
  defaultStatusPageUrl: "https://status.stripe.com/",
  apiDocsUrl: "https://docs.stripe.com/api",
  auth: {
    id: "stripe",
    name: "Stripe",
    type: "api_key",
    fields: [
      {
        key: "secretKey",
        label: "Secret Key",
        type: "password",
        placeholder: "sk_...",
      },
    ],
    docsUrl: "https://docs.stripe.com/keys",
    testEndpoint: "/api/credentials/test",
  },
  capabilities: [{ id: "revenue", action: "data" }],
  dataSources: stripeDataSources,
};
