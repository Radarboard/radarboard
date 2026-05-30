import sharedConfig from "../../packages/tsconfig/vitest.shared";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(sharedConfig, defineConfig({}));
