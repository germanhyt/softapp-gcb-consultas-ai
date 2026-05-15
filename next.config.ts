import type { NextConfig } from "next";
import { dirname } from "path";
import { fileURLToPath } from "url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
