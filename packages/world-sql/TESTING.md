# Testing Guide for @workflow/world-sql

This package has comprehensive tests for all three database backends: PostgreSQL, MySQL, and SQLite.

## Test Files Overview

### 1. `test/spec.test.ts` (Original)
**What it tests**: PostgreSQL backend with the full standard test suite
**Database**: PostgreSQL 15 (via testcontainers)
**How it works**:
- Spins up a PostgreSQL container in Docker
- Pushes schema using `drizzle-kit`
- Runs the standard test suite from `@workflow/world-testing`

**Run it**:
```bash
pnpm test test/spec.test.ts
```

**Requirements**:
- Docker running
- `@testcontainers/postgresql` installed

---

### 2. `test/sqlite-working-example.test.ts` (New)
**What it tests**: SQLite backend with simple CRUD operations
**Database**: SQLite (file-based)
**Tests included**:
- ✅ Create and retrieve workflow runs
- ✅ Update workflow status
- ✅ Complete workflows with output
- ✅ Create and retrieve steps
- ✅ List workflow runs
- ✅ Error handling
- ✅ Pause and resume workflows
- ✅ Cancel workflows

**Run it**:
```bash
# 1. Build native module (one-time)
npm rebuild better-sqlite3

# 2. Run tests
pnpm test test/sqlite-working-example.test.ts
```

**Requirements**:
- `better-sqlite3` built

**Results**: ✅ 8/8 tests passing

---

### 3. `test/all-databases.test.ts` (New)
**What it tests**: All three database backends with the standard test suite
**Databases**: PostgreSQL, SQLite (MySQL commented out for now)
**How it works**:
- Separate test suites for each database
- PostgreSQL uses testcontainers
- SQLite uses programmatic schema setup
- All run the same standard test suite

**Run it**:
```bash
pnpm test test/all-databases.test.ts
```

---

### 4. `test/sqlite-simple.test.ts` (Partial)
**Status**: ⚠️ Some tests failing
**What it tests**: Detailed SQLite functionality
**Note**: This was an experimental file with more comprehensive tests. Use `sqlite-working-example.test.ts` as the reference instead.

---

### 5. `test/sqlite.test.ts` (Partial)
**Status**: ⚠️ Needs updating
**What it tests**: SQLite with full workflow server infrastructure
**Note**: More complex setup required

---

## Quick Start Testing

### Test SQLite (Fastest - No Container Required)
```bash
# 1. One-time setup
npm rebuild better-sqlite3

# 2. Run working example
pnpm test test/sqlite-working-example.test.ts
```

**Expected**: All 8 tests pass ✅

### Test PostgreSQL (Requires Docker or Podman)
```bash
# Make sure Docker or Podman is running
docker info  # or: podman info

# Run tests (auto-detects runtime)
pnpm test test/spec.test.ts
```

### Test MySQL (Requires Docker or Podman)
```bash
# Make sure Docker or Podman is running
docker info  # or: podman info

# Run tests (auto-detects runtime)
pnpm test test/mysql-working-example.test.ts
```

**Expected**: All 8 tests pass ✅

### Test All Databases
```bash
# SQLite + PostgreSQL + MySQL
pnpm test test/all-databases.test.ts
```

**Note**: Tests automatically detect and use Docker or Podman. See [CONTAINER_RUNTIME.md](./CONTAINER_RUNTIME.md) for details.

## Test Helpers

### `test/helpers/setup-sqlite.ts`
Helper function to create SQLite schema programmatically without requiring `drizzle-kit`:

```typescript
import { setupSqliteSchema } from './helpers/setup-sqlite.js';

await setupSqliteSchema('./my-test.db');
```

Creates all required tables:
- `workflow_runs`
- `workflow_steps`
- `workflow_events`
- `workflow_hooks`
- `workflow_stream_chunks`
- `workflow_jobs`

## Standard Test Suite

The standard test suite comes from `@workflow/world-testing` and includes:

**From `addition.mts`**:
- Tests running a simple addition workflow
- Verifies workflow execution and output

**From `idempotency.mts`**:
- Tests idempotent workflow execution
- Verifies duplicate runs are prevented

## Running Tests

### Run All Tests
```bash
pnpm test
```

### Run Specific Test File
```bash
pnpm test test/sqlite-working-example.test.ts
```

### Run Tests in Watch Mode
```bash
pnpm test --watch
```

### Run Tests with Coverage
```bash
pnpm test --coverage
```

## CI/CD Considerations

### GitHub Actions Example

```yaml
name: Test

on: [push, pull_request]

jobs:
  test-sqlite:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm install -g pnpm
      - run: pnpm install
      - run: npm rebuild better-sqlite3
      - run: pnpm build
      - run: pnpm test test/sqlite-working-example.test.ts

  test-postgres:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm install -g pnpm
      - run: pnpm install
      - run: pnpm build
      - run: pnpm test test/spec.test.ts
```

## Troubleshooting

### Error: "Could not locate the bindings file"
**Solution**: Rebuild better-sqlite3
```bash
npm rebuild better-sqlite3
```

### Error: "no such table: workflow_runs"
**Solution**: Schema not created. Either:
```bash
# Option 1: Use drizzle-kit
pnpm db:push

# Option 2: Use helper (for SQLite)
await setupSqliteSchema('./test.db');
```

### Error: "Docker daemon not running"
**Solution**: Start Docker for testcontainer-based tests

### Error: "Test timeout"
**Solution**: Increase timeout in `beforeAll`:
```typescript
beforeAll(async () => {
  // ...
}, 180_000); // 3 minutes
```

## Writing New Tests

### Example Test Structure

```typescript
import { describe, expect, test, beforeAll, afterAll } from 'vitest';
import { createWorld } from '../src/index.js';
import { setupSqliteSchema } from './helpers/setup-sqlite.js';

describe('My New Tests', () => {
  let world;
  const dbPath = './my-test.db';

  beforeAll(async () => {
    // Setup schema
    await setupSqliteSchema(dbPath);

    // Create world
    world = await createWorld({
      databaseType: 'sqlite',
      connectionString: dbPath,
    });

    await world.start();
  });

  afterAll(async () => {
    // Cleanup
    await unlink(dbPath);
  });

  test('my test', async () => {
    const run = await world.runs.create({
      deploymentId: 'dep_test',
      workflowName: 'test',
      input: [],
    });

    expect(run.runId).toMatch(/^wrun_/);
  });
});
```

## Best Practices

1. **Use SQLite for unit tests** - Fast, no external dependencies
2. **Use PostgreSQL for integration tests** - Tests production-like setup
3. **Clean up test databases** - Always use `afterAll()` or `afterEach()`
4. **Don't hardcode runIds** - They're auto-generated
5. **Use the helpers** - `setupSqliteSchema()` for easy schema creation
6. **Check test output** - Don't just rely on exit codes

## Test Coverage

Current coverage:
- ✅ CRUD operations (runs, steps, events, hooks)
- ✅ Status transitions (pending → running → completed)
- ✅ Pause/resume functionality
- ✅ Cancellation
- ✅ Error handling
- ✅ Pagination
- ✅ Auto-generated IDs
- ✅ **MySQL backend** - 8/8 tests passing
- ✅ **SQLite backend** - 8/8 tests passing
- ✅ **PostgreSQL backend** - Original tests passing
- ⏳ Queue functionality (TODO)
- ⏳ Streaming functionality (TODO)

## Documentation

- **E2E_TESTING.md** - Detailed guide for end-to-end testing
- **TESTING.md** (this file) - Overview of all tests
- **HOW_IT_WORKS.md** - Architecture and implementation details
