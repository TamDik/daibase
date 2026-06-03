import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist", "src-tauri/target"],
  },
  ...tseslint.configs.recommended,
  prettier,
);
