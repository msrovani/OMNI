import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@omni-grid/omni-bus": new URL("../omni-bus/src/index.ts", import.meta.url).pathname,
      "@omni-grid/omni-auth": new URL("../omni-auth/src/index.ts", import.meta.url).pathname,
      "@omni-grid/pde-engine": new URL("../pde-engine/src/index.ts", import.meta.url).pathname,
      "@omni-grid/asset-manager": new URL("../asset-manager/src/index.ts", import.meta.url).pathname,
      "@omni-grid/market-connect": new URL("../market-connect/src/index.ts", import.meta.url).pathname,
      "@omni-grid/omni-cloud": new URL("../omni-cloud/src/index.ts", import.meta.url).pathname,
      "@omni-grid/api-gateway": new URL("../api-gateway/src/index.ts", import.meta.url).pathname,
    },
  },
});
