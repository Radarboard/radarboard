/**
 * PagerDuty — Integration Descriptor
 */

import type { IntegrationDescriptor } from "@radarboard/integration-sdk/types";
import { Globe } from "lucide-react";
import { pagerdutyDataSources } from "./api/data-sources";

export const pagerdutyDescriptor: IntegrationDescriptor = {
  id: "pagerduty",
  name: "PagerDuty",
  description: "Incident management, on-call schedules, and service health from PagerDuty.",
  icon: Globe,
  category: "monitoring",
  defaultStatusPageUrl: "https://status.pagerduty.com/",
  apiDocsUrl: "https://developer.pagerduty.com/api-reference",
  auth: {
    id: "pagerduty",
    name: "PagerDuty",
    type: "api_key",
    fields: [
      {
        key: "apiToken",
        label: "API Token",
        type: "password",
        placeholder: "u+...",
      },
    ],
    docsUrl: "https://support.pagerduty.com/main/docs/api-access-keys",
    testEndpoint: "/api/credentials/test",
  },
  dataSources: pagerdutyDataSources,
};
