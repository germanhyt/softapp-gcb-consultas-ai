import type { NextConfig } from "next";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

/** Absolute app root so Turbopack does not infer the wrong directory on Windows. */
const appDir = resolve(dirname(fileURLToPath(import.meta.url)));

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: appDir,
  },
};

export default nextConfig;
