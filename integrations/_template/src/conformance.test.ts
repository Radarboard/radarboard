import { runIntegrationConformance } from "@radarboard/integration-sdk/conformance";
import { __INTEGRATION_CAMEL__Descriptor } from ".";

runIntegrationConformance([
  {
    ...__INTEGRATION_CAMEL__Descriptor,
    id: "integration-template",
  },
]);
