import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

function makeHttpsConfig(): { key: Buffer; cert: Buffer } | undefined {
  if (process.env.VITE_HTTP === "1") {
    return undefined;
  }

  const certFile =
    process.env.VITE_TLS_CERT ?? path.join(repoRoot, "hack/tls/server.crt");
  const keyFile =
    process.env.VITE_TLS_KEY ?? path.join(repoRoot, "hack/tls/server.key");
  if (!fs.existsSync(certFile) || !fs.existsSync(keyFile)) {
    return undefined;
  }

  return {
    key: fs.readFileSync(keyFile),
    cert: fs.readFileSync(certFile),
  };
}

export default defineConfig((_env) => {
  const devPort = Number(process.env.VITE_PORT || 3080);
  const proxyTarget = process.env.API_PROXY_TARGET || "https://127.0.0.1:3443";
  const https = makeHttpsConfig();
  return {
    plugins: [react()],
    server: {
      port: devPort,
      strictPort: true,
      https,
      hmr: {
        clientPort: devPort,
        protocol: https ? "wss" : "ws",
      },
      proxy: {
        "/api/v1": {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
        },
        "/openapi.json": {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
