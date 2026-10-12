import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Imagen chica para Docker (node .next/standalone/server.js) cuando se despliegue.
  output: "standalone",
};

export default nextConfig;
