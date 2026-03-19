import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // DX-2: Prevent direct auth() imports in API routes — use withAuth/withAdmin HOCs instead.
  {
    files: ['src/app/api/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [{
          name: '@/lib/auth',
          importNames: ['auth'],
          message: 'API routes must use withAuth or withAdmin HOCs instead of calling auth() directly. See src/lib/api/withAuth.ts.',
        }],
      }],
    },
  },
]);

export default eslintConfig;
