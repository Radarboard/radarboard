import { runIntegrationConformance } from "@radarboard/integration-sdk/conformance";
import { describe } from "vitest";
import { stripeDescriptor } from "./index";

describe("stripe integration conformance", () => {
  runIntegrationConformance([stripeDescriptor]);
});
