import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export const baseConfig = tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [".next/**", "dist/**", "node_modules/**"]
  }
);
