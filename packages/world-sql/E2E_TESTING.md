# End-to-End Testing with world-sql

This guide shows you how to set up and run e2e tests for the `@workflow/world-sql` package with SQLite, MySQL, and PostgreSQL.

## Quick Start with SQLite

SQLite is the easiest to test with since it doesn't require external dependencies:

```bash
# 1. Build better-sqlite3 native module (one-time)
npm rebuild better-sqlite3

# 2. Run the tests
pnpm test test/sqlite-simple.test.ts
```

## Test Structure

### 1. Setup Schema Programmatically

For SQLite, you can create tables programmatically:

```typescript
import Database from 'better-sqlite3';

function setupSqliteSchema(dbPath: string): void {
  const db = new Database(dbPath);

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS workflow_runs (
      id TEXT PRIMARY KEY,
      deployment_id TEXT NOT NULL,
      status TEXT NOT NULL,
      name TEXT NOT NULL,
      input TEXT NOT NULL,
      output TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    -- Add other tables...
  `);

  db.close();
}
```

### 2. Create World Instance

```typescript
import { createWorld } from '@workflow/world-sql';

// For SQLite
const world = await createWorld({
  databaseType: 'sqlite',
  connectionString: './test.db',
});

await world.start();
```

### 3. Test CRUD Operations

```typescript
// Create a workflow run
const run = await world.runs.create({
  deploymentId: 'dep_test',
  workflowName: 'my-workflow',
  input: [{ foo: 'bar' }],
});

// The run ID is auto-generated
console.log(run.runId); // wrun_01K8ABDTWG495B7YC988518FAP

// Retrieve it
const retrieved = await world.runs.get(run.runId);

// Update it
const updated = await world.runs.update(run.runId, {
  status: 'completed',
  output: [{ result: 42 }],
});

// Cancel it
const cancelled = await world.runs.cancel(run.runId);
```

## Testing with MySQL

```typescript
import { MySQLContainer } from '@testcontainers/mysql';
import { createWorld } from '@workflow/world-sql';
import { execSync } from 'node:child_process';

// Start MySQL container
const container = await new MySQLContainer('mysql:8').start();
const connectionString = container.getConnectionString();

// Push schema
process.env.DATABASE_URL = connectionString;
execSync('pnpm db:push', { stdio: 'inherit' });

// Create world
const world = await createWorld({
  databaseType: 'mysql',
  connectionString,
});

await world.start();

// Run tests...

// Cleanup
await container.stop();
```

## Testing with PostgreSQL

```typescript
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { createWorld } from '@workflow/world-sql';
import { execSync } from 'node:child_process';

// Start PostgreSQL container
const container = await new PostgreSqlContainer('postgres:15-alpine').start();
const connectionString = container.getConnectionUri();

// Push schema
process.env.DATABASE_URL = connectionString;
execSync('pnpm db:push', { stdio: 'inherit' });

// Create world
const world = await createWorld({
  databaseType: 'postgres',
  connectionString,
});

await world.start();

// Run tests...

// Cleanup
await container.stop();
```

## Common Test Patterns

### Testing Queue Functionality

```typescript
// The queue starts automatically with world.start()
await world.start();

// Queue a message (used internally by the workflow runtime)
await world.queue('__wkf_workflow_:test-id', {
  type: 'workflow',
  id: 'wrun_123',
  deploymentId: 'dep_123',
}, {
  idempotencyKey: 'unique-key',
});
```

### Testing Streaming

```typescript
// Write to a stream
await world.writeToStream('stream_123', {
  data: Buffer.from('chunk 1'),
  eof: false,
});

// Read from stream
const stream = world.consumeStream('stream_123');
for await (const chunk of stream) {
  console.log(chunk.data.toString());
  if (chunk.eof) break;
}
```

### Testing Pagination

```typescript
// Create multiple runs
for (let i = 0; i < 10; i++) {
  await world.runs.create({
    deploymentId: 'dep_test',
    workflowName: 'test',
    input: [],
  });
}

// Paginate
const page1 = await world.runs.list({
  pagination: { limit: 3 },
});

console.log(page1.items.length); // 3
console.log(page1.nextCursor); // cursor for next page

const page2 = await world.runs.list({
  pagination: { limit: 3, cursor: page1.nextCursor },
});
```

## Cleanup

Always clean up test databases:

```typescript
import { unlink } from 'node:fs/promises';

afterEach(async () => {
  try {
    await unlink('./test.db');
    await unlink('./test.db-shm');
    await unlink('./test.db-wal');
  } catch {
    // Ignore if files don't exist
  }
});
```

## Running the Test Suite

The package includes a standard test suite from `@workflow/world-testing`:

```typescript
import { createTestSuite } from '@workflow/world-testing';
import { beforeAll } from 'vitest';

beforeAll(async () => {
  // Setup database and schema
  await setupSqliteSchema('./test.db');

  // Set environment variables
  process.env.WORKFLOW_SQL_DATABASE_TYPE = 'sqlite';
  process.env.WORKFLOW_SQL_URL = './test.db';
}, 120_000);

// Run standard tests
createTestSuite('./dist/index.js');
```

## Debugging Tips

### 1. Enable SQL Query Logging

For debugging, you can log SQL queries:

```typescript
import { drizzle } from 'drizzle-orm/better-sqlite3';

const db = drizzle(client, {
  schema,
  logger: {
    logQuery: (query) => console.log('SQL:', query),
  },
});
```

### 2. Inspect Database State

```bash
# For SQLite
sqlite3 test.db "SELECT * FROM workflow_runs;"

# For PostgreSQL
psql $DATABASE_URL -c "SELECT * FROM workflow_runs;"

# For MySQL
mysql -h localhost -u root -p -e "SELECT * FROM workflow_runs;"
```

### 3. Check Queue Status

```typescript
// For table-based queues (MySQL/SQLite)
const jobs = await world.drizzle
  .select()
  .from(schema.jobs)
  .where(eq(schema.jobs.status, 'pending'));

console.log(`Pending jobs: ${jobs.length}`);
```

## Example Test File

See `test/sqlite-simple.test.ts` for a complete working example with:
- Schema setup
- CRUD operations for runs, steps, events, and hooks
- Pagination testing
- Error handling
- Status transitions

## Important Notes

1. **Run IDs are auto-generated**: Don't provide `runId` in `create()` calls - it's generated automatically
2. **SQLite requires native module**: Run `npm rebuild better-sqlite3` after install
3. **Schema must exist**: Always push schema before running tests
4. **Clean up after tests**: Delete test databases in `afterEach()`
5. **Queue starts with world.start()**: Call `await world.start()` before testing queue functionality

## Troubleshooting

### Error: "Could not locate the bindings file"

```bash
npm rebuild better-sqlite3
```

### Error: "no such table: workflow_runs"

The schema hasn't been created. Either:
- Run `pnpm db:push`
- Or call `setupSqliteSchema()` in your test setup

### Error: "Run already exists"

The test database wasn't cleaned up. Add cleanup in `afterEach()`.

### Error: "Module not found: postgres"

Install the peer dependency:
```bash
pnpm add -D postgres pg-boss  # for PostgreSQL
pnpm add -D mysql2            # for MySQL
pnpm add -D better-sqlite3    # for SQLite
```
