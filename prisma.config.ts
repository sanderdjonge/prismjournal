// Prisma 7 Configuration File
// This replaces the `url` property that was previously in schema.prisma

import { defineConfig } from 'prisma/config';

export default defineConfig({
  datasource: {
    // Using direct process.env access - the env() function requires the var to exist at config load time
    url: process.env.DATABASE_URL || 'postgresql://prism_dev:prism_dev_password@localhost:5433/prism_journal_dev',
  },
});