import 'dotenv/config';
import { defineConfig } from 'prisma/config';

const schemaOnlyUrl =
  'postgresql://schema-validation:local-only@localhost:5432/budstar';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? schemaOnlyUrl,
  },
});
