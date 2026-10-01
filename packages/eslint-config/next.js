import pluginNext from "@next/eslint-plugin-next";
import { baseConfig } from "./base.js";

export const nextConfig = [
  ...baseConfig,
  {
    plugins: { "@next/next": pluginNext },
    rules: {
      ...pluginNext.configs.recommended.rules,
      ...pluginNext.configs["core-web-vitals"].rules
    }
  }
];
