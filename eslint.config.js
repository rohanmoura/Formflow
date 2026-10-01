import { globalIgnores } from "eslint/config";
import { nextConfig } from "@formflow/eslint-config/next";

export default [...nextConfig, globalIgnores(["**/.next/**", "**/dist/**", "**/node_modules/**", "**/next-env.d.ts"])];
