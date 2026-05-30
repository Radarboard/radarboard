import { runPluginConformance } from "@radarboard/plugin-sdk/conformance";
import { __PLUGIN_CAMEL__Descriptor } from ".";

runPluginConformance([
  {
    ...__PLUGIN_CAMEL__Descriptor,
    id: "plugin-template",
  },
]);
