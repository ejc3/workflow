import { defineConfig } from 'drizzle-kit';

// Determine database type and schema path from environment
const dbType =
  process.env.WORKFLOW_SQL_DATABASE_TYPE ||
  (process.env.DATABASE_URL?.startsWith('mysql')
    ? 'mysql'
    : process.env.DATABASE_URL?.startsWith('postgres')
      ? 'postgres'
      : 'sqlite');

const dialectMap = {
  mysql: 'mysql' as const,
  postgres: 'postgresql' as const,
  sqlite: 'sqlite' as const,
};

const schemaMap = {
  mysql: './src/schema/mysql.ts',
  postgres: './src/schema/postgres.ts',
  sqlite: './src/schema/sqlite.ts',
};

export default defineConfig({
  dialect: dialectMap[dbType],
  dbCredentials: {
    url:
      process.env.DATABASE_URL || 'postgres://world:world@localhost:5432/world',
  },
  schema: schemaMap[dbType],
  out: './drizzle',
});
