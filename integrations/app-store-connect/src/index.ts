/**
 * App Store Connect — Integration Descriptor
 */

import type { IntegrationDescriptor } from "@radarboard/integration-sdk/types";
import { Globe } from "lucide-react";
import { appStoreConnectDataSources } from "./api/data-sources";

export const appStoreConnectDescriptor: IntegrationDescriptor = {
  id: "app-store-connect",
  name: "App Store Connect",
  description:
    "App info, customer reviews, and version history via the App Store Connect REST API v1.",
  icon: Globe,
  category: "revenue",
  apiDocsUrl: "https://developer.apple.com/documentation/appstoreconnectapi",
  auth: {
    id: "app-store-connect",
    name: "App Store Connect",
    type: "api_key",
    fields: [
      { key: "keyId", label: "Key ID", type: "text", placeholder: "" },
      { key: "issuerId", label: "Issuer ID", type: "text", placeholder: "" },
      {
        key: "privateKey",
        label: "Private Key (.p8)",
        type: "file",
        accept: ".p8,.pem",
      },
    ],
    testEndpoint: "/api/credentials/test",
    docsUrl:
      "https://developer.apple.com/documentation/appstoreconnectapi/creating_api_keys_for_app_store_connect_api",
  },
  capabilities: [{ id: "app-reviews", action: "data" }],
  dataSources: appStoreConnectDataSources,
};

export { appStoreConnectDataSources } from "./api/data-sources";
