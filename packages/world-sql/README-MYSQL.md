# MySQL Setup Guide for world-sql

This guide explains how to use the `@workflow/world-sql` package with MySQL as your workflow backend.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [MySQL Compatibility](#mysql-compatibility)
- [Docker Setup](#docker-setup)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Architecture Details](#architecture-details)

## Overview

The `@workflow/world-sql` package provides a SQL-based workflow backend that supports three database types:

- **PostgreSQL** - Full support with native RETURNING clauses
- **SQLite** - Full support with native RETURNING clauses
- **MySQL** - Full support with compatibility layer for RETURNING

This package uses [Drizzle ORM](https://orm.drizzle.team/) for database operations and implements a table-based queue for MySQL and SQLite (PostgreSQL uses pg-boss).

## Quick Start

### Option 1: Pre-built Docker Image (Recommended)

Use the official workflow-mysql image with pre-initialized schema:

```bash
docker pull ghcr.io/ejc3/workflow-mysql:latest

docker run -d --name workflow-mysql \
  -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_PASSWORD=workflow \
  -p 3306:3306 \
  ghcr.io/ejc3/workflow-mysql:latest
```

The schema is automatically created on first startup. See [docker/mysql/README.md](../../docker/mysql/README.md) for full documentation.

### Option 2: Manual MySQL Setup

Using vanilla MySQL image (requires manual schema creation):

```bash
docker run -d --name workflow-mysql \
  -e MYSQL_ROOT_PASSWORD=workflow \
  -e MYSQL_DATABASE=workflow \
  -e MYSQL_USER=workflow \
  -e MYSQL_PASSWORD=workflow \
  -p 3306:3306 \
  mysql:8.0
```

Wait for MySQL to be ready:

```bash
# Wait for MySQL to accept connections
for i in {1..30}; do
  docker exec workflow-mysql mysqladmin ping -h localhost -pworkflow 2>/dev/null && break
  sleep 1
done
```

**If using Option 2, you must manually create the schema (see Step 3 below).**

### 2. Configure Environment Variables

Create or update your `.env.local` file:

```bash
# Database configuration
WORKFLOW_SQL_DATABASE_TYPE=mysql
WORKFLOW_SQL_URL=mysql://workflow:workflow@localhost:3306/workflow

# Optional: Queue configuration
WORKFLOW_SQL_JOB_PREFIX=workflow_job
WORKFLOW_SQL_WORKER_CONCURRENCY=10
```

### 3. Create Database Schema

**IMPORTANT for Option 2 only**: If you're using the pre-built Docker image (Option 1), skip this step - the schema is already initialized.

If you're using Option 2 (manual MySQL setup), the schema must be created manually before starting your application. The world-sql package does NOT automatically create tables.

**Using the provided schema file:**

```bash
# With Docker/Podman:
podman exec -i workflow-mysql mysql -u workflow -pworkflow workflow < packages/world-sql/schema-mysql.sql

# Direct MySQL CLI:
mysql -h localhost -P 3306 -u workflow -pworkflow workflow < packages/world-sql/schema-mysql.sql
```

**Or run the following SQL to create the required tables manually:**

```sql
CREATE TABLE IF NOT EXISTS workflow_runs (
  id VARCHAR(255) PRIMARY KEY,
  deployment_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  execution_context JSON,
  input JSON NOT NULL,
  output JSON,
  error TEXT,
  error_code VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  started_at TIMESTAMP,
  INDEX workflow_name_idx(name),
  INDEX status_idx(status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS workflow_events (
  id VARCHAR(255) PRIMARY KEY,
  type VARCHAR(255) NOT NULL,
  correlation_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  run_id VARCHAR(255) NOT NULL,
  payload JSON,
  INDEX run_fk_idx(run_id),
  INDEX correlation_id_fk_idx(correlation_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS workflow_steps (
  run_id VARCHAR(255) NOT NULL,
  step_id VARCHAR(255) PRIMARY KEY,
  step_name VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL,
  input JSON NOT NULL,
  output JSON,
  error TEXT,
  error_code VARCHAR(255),
  attempt INT NOT NULL,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  INDEX run_fk_idx(run_id),
  INDEX status_idx(status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS workflow_hooks (
  run_id VARCHAR(255) NOT NULL,
  hook_id VARCHAR(255) PRIMARY KEY,
  token VARCHAR(255) NOT NULL,
  owner_id VARCHAR(255) NOT NULL,
  project_id VARCHAR(255) NOT NULL,
  environment VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  metadata JSON,
  INDEX run_fk_idx(run_id),
  INDEX token_idx(token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS workflow_stream_chunks (
  id VARCHAR(255) NOT NULL,
  stream_id VARCHAR(255) NOT NULL,
  data BLOB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  eof BOOLEAN NOT NULL,
  PRIMARY KEY (stream_id, id),
  INDEX stream_idx(stream_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS workflow_jobs (
  id VARCHAR(255) PRIMARY KEY,
  queue_name VARCHAR(255) NOT NULL,
  payload JSON NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  locked_until TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  scheduled_for TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  idempotency_key VARCHAR(255),
  error TEXT,
  INDEX queue_name_idx(queue_name),
  INDEX status_idx(status),
  INDEX scheduled_idx(scheduled_for),
  INDEX idempotency_idx(idempotency_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

The schema includes:
- `workflow_runs` - Workflow run state
- `workflow_events` - Event log for replay
- `workflow_hooks` - Webhook subscriptions
- `workflow_steps` - Step execution state
- `workflow_stream_chunks` - Streaming data chunks
- `workflow_jobs` - Job queue for MySQL

### 4. Start Your Application

For Next.js with Turbopack:

```bash
cd workbench/nextjs-turbopack
pnpm dev
```

The workflow system will:
1. Connect to MySQL
2. Start the queue worker
3. Begin processing workflows

### 5. Test the Workflow

Run the test script:

```bash
cd workbench/nextjs-turbopack
node test-workflow.mjs
```

Expected output:

```
🚀 Starting addTenWorkflow with input: 42
✅ Workflow started: { runId: 'wrun_...', status: 'pending' }
⏳ Checking status (attempt 1)...
🎉 Workflow completed!
   Input:  42
   Output: 52
   Expected: 52 (42 + 2 + 3 + 5)
   ✅ Test PASSED
```

## Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `WORKFLOW_SQL_DATABASE_TYPE` | Database type: `mysql`, `postgres`, or `sqlite` | `postgres` | No |
| `WORKFLOW_SQL_URL` | Database connection string | `postgres://world:world@localhost:5432/world` | No |
| `WORKFLOW_SQL_JOB_PREFIX` | Prefix for queue job names | (none) | No |
| `WORKFLOW_SQL_WORKER_CONCURRENCY` | Number of concurrent queue workers | `10` | No |

### Connection String Formats

**MySQL:**
```
mysql://user:password@host:port/database
```

**PostgreSQL:**
```
postgres://user:password@host:port/database
postgresql://user:password@host:port/database
```

**SQLite:**
```
file:./workflow.db
:memory:
```

### Programmatic Configuration

```typescript
import { createWorld } from '@workflow/world-sql';

const world = createWorld({
  databaseType: 'mysql',
  connectionString: 'mysql://workflow:workflow@localhost:3306/workflow',
  jobPrefix: 'my_app',
  queueConcurrency: 10,
});

// Start the world (connects to DB and starts queue worker)
await world.start();
```

## MySQL Compatibility

MySQL lacks the `RETURNING` clause that PostgreSQL and SQLite support. The world-sql package handles this transparently using a compatibility layer.

### INSERT Operations

**PostgreSQL/SQLite:**
```sql
INSERT INTO runs (...) VALUES (...) RETURNING *;
```

**MySQL (compatibility layer):**
```sql
INSERT INTO runs (...) VALUES (...);
SELECT * FROM runs WHERE run_id = ?;
```

### UPDATE Operations

**PostgreSQL/SQLite:**
```sql
UPDATE runs SET status = 'completed' WHERE run_id = ? RETURNING *;
```

**MySQL (compatibility layer):**
```sql
UPDATE runs SET status = 'completed' WHERE run_id = ?;
SELECT * FROM runs WHERE run_id = ?;
```

### DELETE Operations

**PostgreSQL/SQLite:**
```sql
DELETE FROM hooks WHERE hook_id = ? RETURNING *;
```

**MySQL (compatibility layer):**
```sql
SELECT * FROM hooks WHERE hook_id = ?;
DELETE FROM hooks WHERE hook_id = ?;
```

### Conflict Handling

MySQL duplicate key errors (errno 1062) are caught and handled gracefully:

```typescript
try {
  await drizzle.insert(table).values(values);
} catch (error) {
  if (error.errno === 1062 && onConflict === 'doNothing') {
    // Expected duplicate - fetch existing row
    return await drizzle.select().from(table).where(...);
  }
  throw error;
}
```

## Docker Setup

### MySQL with Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    container_name: workflow-mysql
    environment:
      MYSQL_ROOT_PASSWORD: workflow
      MYSQL_DATABASE: workflow
      MYSQL_USER: workflow
      MYSQL_PASSWORD: workflow
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-pworkflow"]
      interval: 5s
      timeout: 3s
      retries: 10

  # Your application service
  app:
    build: .
    depends_on:
      mysql:
        condition: service_healthy
    environment:
      WORKFLOW_SQL_DATABASE_TYPE: mysql
      WORKFLOW_SQL_URL: mysql://workflow:workflow@mysql:3306/workflow
    ports:
      - "3000:3000"

volumes:
  mysql_data:
```

Start the services:

```bash
docker-compose up -d
```

### Podman Setup

If using Podman instead of Docker:

```bash
podman run -d \
  --name workflow-mysql \
  -e MYSQL_ROOT_PASSWORD=workflow \
  -e MYSQL_DATABASE=workflow \
  -e MYSQL_USER=workflow \
  -e MYSQL_PASSWORD=workflow \
  -p 3306:3306 \
  mysql:8.0

# Wait for ready
for i in {1..30}; do
  podman exec workflow-mysql mysqladmin ping -h localhost -pworkflow 2>/dev/null && break
  sleep 1
done

# Set environment variables
export WORKFLOW_SQL_DATABASE_TYPE=mysql
export WORKFLOW_SQL_URL=mysql://workflow:workflow@localhost:3306/workflow
```

## Testing

### Health Check Endpoint

A health check endpoint is available at `/api/health` that provides system status information:

```bash
curl http://localhost:3000/api/health
```

**Example healthy response** (HTTP 200):
```json
{
  "status": "healthy",
  "timestamp": "2025-10-24T09:22:41.794Z",
  "responseTime": "11ms",
  "database": {
    "type": "mysql",
    "healthy": true,
    "message": "mysql connection is healthy"
  },
  "storage": {
    "healthy": true
  },
  "environment": {
    "ownerId": "mysql",
    "projectId": "mysql"
  },
  "checks": {
    "connection": "pass",
    "storage": "pass"
  }
}
```

**Example unhealthy response** (HTTP 503):
```json
{
  "status": "unhealthy",
  "timestamp": "2025-10-24T09:22:41.794Z",
  "responseTime": "11ms",
  "database": {
    "type": "mysql",
    "healthy": true,
    "message": "mysql connection is healthy"
  },
  "storage": {
    "healthy": false,
    "error": "Table 'workflow.workflow_runs' doesn't exist"
  },
  "checks": {
    "connection": "pass",
    "storage": "fail"
  }
}
```

### End-to-End Test

The test script starts a workflow, polls for completion, and validates the output:

```bash
cd workbench/nextjs-turbopack
node test-workflow.mjs
```

**Note on Cold Start Performance:**

The first test run after starting the dev server will be significantly slower than subsequent runs:

- **First run:** 3-5 minutes (Next.js route compilation, MySQL connection pool initialization, workflow compilation)
- **Subsequent runs:** 5-10 seconds (warm cache, established connections)

This is expected behavior. If a test appears stuck but the dev server shows POST requests completing successfully, be patient - it's likely just experiencing the cold start delay

### Manual Testing with curl

Start a workflow:

```bash
curl -X POST 'http://localhost:3000/api/trigger?workflowFn=addTenWorkflow&args=42'
```

Response:
```json
{
  "runId": "wrun_01K8APMKBN60B6R806HCN5S5MQ",
  "status": "pending",
  "workflowName": "workflows/99_e2e.ts/addTenWorkflow",
  "input": [42],
  "createdAt": "2025-10-24T08:48:00.000Z"
}
```

Check status:

```bash
curl 'http://localhost:3000/api/trigger?runId=wrun_01K8APMKBN60B6R806HCN5S5MQ'
```

If still running (HTTP 202):
```json
{
  "name": "WorkflowRunNotCompletedError",
  "message": "Workflow run has not completed yet"
}
```

If completed (HTTP 200):
```json
52
```

### Verify Database State

Connect to MySQL:

```bash
docker exec -it workflow-mysql mysql -u workflow -pworkflow workflow
```

Check tables:

```sql
-- View all runs
SELECT run_id, workflow_name, status, created_at, completed_at
FROM runs
ORDER BY created_at DESC
LIMIT 10;

-- View events for a run
SELECT event_id, event_type, created_at
FROM events
WHERE run_id = 'wrun_01K8APMKBN60B6R806HCN5S5MQ'
ORDER BY created_at;

-- View queue jobs
SELECT id, run_id, workflow_name, status, attempts, created_at
FROM queue_jobs
ORDER BY created_at DESC
LIMIT 10;

-- View active steps
SELECT step_id, step_name, status, attempt, started_at
FROM steps
WHERE status IN ('pending', 'running')
ORDER BY created_at;
```

## Troubleshooting

### Connection Refused

**Problem:** `ECONNREFUSED 127.0.0.1:3306`

**Solution:** Make sure MySQL is running:

```bash
docker ps | grep workflow-mysql
# OR
podman ps | grep workflow-mysql
```

Start if not running:

```bash
docker start workflow-mysql
# OR
podman start workflow-mysql
```

### Authentication Failed

**Problem:** `ER_ACCESS_DENIED_ERROR: Access denied for user 'workflow'@'localhost'`

**Solution:** Check connection string format:

```bash
# Correct format
mysql://workflow:workflow@localhost:3306/workflow

# Common mistakes
mysql://workflow@localhost:3306/workflow  # Missing password
mysql://localhost:3306/workflow           # Missing user and password
```

### ".returning is not a function" Error

**Problem:** `TypeError: drizzle.insert(...).values(...).returning is not a function`

**Solution:** This means you're running an old build. Rebuild the package:

```bash
cd /Users/ejcampbell/src/workflow/packages/world-sql
rm -rf dist
pnpm build

# Clear Next.js cache
cd /Users/ejcampbell/src/workflow/workbench/nextjs-turbopack
rm -rf .next
pnpm dev
```

### Database Not Ready

**Problem:** Workflow fails immediately after starting MySQL

**Solution:** Wait for MySQL to be fully ready:

```bash
# Check if MySQL is accepting connections
docker exec workflow-mysql mysqladmin ping -h localhost -pworkflow

# Wait loop (retry up to 30 times)
for i in {1..30}; do
  docker exec workflow-mysql mysqladmin ping -h localhost -pworkflow 2>/dev/null && break
  echo "Waiting for MySQL... ($i/30)"
  sleep 1
done
```

### Queue Not Processing Jobs

**Problem:** Workflow stuck in "pending" status

**Check:** Queue worker logs:

```bash
# Look for queue-related errors in dev server output
grep -i "queue" /tmp/nextjs-worldsql-SUCCESS.log
```

**Solution:** Make sure `world.start()` was called:

```typescript
// In instrumentation.ts or similar
const world = createWorld({ databaseType: 'mysql', ... });
await world.start();  // IMPORTANT: This starts the queue worker
```

### Duplicate Key Errors

**Problem:** `ER_DUP_ENTRY: Duplicate entry 'wrun_...' for key 'PRIMARY'`

**Explanation:** This is expected for idempotent operations (e.g., step creation).

**Verification:** Check if the code uses `onConflict: 'doNothing'`:

```typescript
// This is correct - duplicates are handled
await insertAndReturn(
  dbType,
  drizzle,
  steps,
  { stepId: 'step_123', ... },
  steps.stepId,
  'step_123',
  'doNothing'  // ← Handles duplicates gracefully
);
```

## Architecture Details

### Helper Functions

The MySQL compatibility layer uses helper functions in `src/storage.ts`:

#### insertAndReturn()

Handles INSERT operations with MySQL compatibility:

```typescript
async function insertAndReturn<T>(
  dbType: DatabaseType,
  drizzle: any,
  table: any,
  values: Record<string, any>,
  primaryKeyColumn: any,
  primaryKeyValue: string,
  onConflict?: 'doNothing' | 'doUpdate'
): Promise<T[]>
```

**Parameters:**
- `dbType` - Database type (`'mysql'`, `'postgres'`, `'sqlite'`)
- `drizzle` - Drizzle ORM instance
- `table` - Table schema object
- `values` - Values to insert
- `primaryKeyColumn` - Primary key column (for SELECT after INSERT)
- `primaryKeyValue` - Primary key value (for SELECT after INSERT)
- `onConflict` - How to handle duplicates

**Behavior:**
- **MySQL:** INSERT with try-catch for errno 1062, then SELECT by primary key
- **SQLite/PostgreSQL:** INSERT...RETURNING with optional onConflictDoNothing()

#### updateAndReturn()

Handles UPDATE operations with MySQL compatibility:

```typescript
async function updateAndReturn<T>(
  dbType: DatabaseType,
  drizzle: any,
  table: any,
  updates: Record<string, any>,
  where: any,
  primaryKeyColumn: any,
  primaryKeyValue: string
): Promise<T[]>
```

**Parameters:**
- `dbType` - Database type
- `drizzle` - Drizzle ORM instance
- `table` - Table schema object
- `updates` - Values to update
- `where` - WHERE clause condition
- `primaryKeyColumn` - Primary key column (for SELECT after UPDATE)
- `primaryKeyValue` - Primary key value (for SELECT after UPDATE)

**Behavior:**
- **MySQL:** UPDATE with original WHERE clause, then SELECT by primary key
- **SQLite/PostgreSQL:** UPDATE...RETURNING

**Important:** For MySQL, we SELECT using the primary key, not the original WHERE clause, because the WHERE clause might include conditions on fields that were just updated.

### Storage Layer

The storage layer (`src/storage.ts`) provides CRUD operations for:

1. **Runs** - Workflow execution state
   - `create()` - Start a new run
   - `get()` - Fetch run by ID
   - `update()` - Update run status/output
   - `cancel()` - Cancel a running workflow
   - `pause()` / `resume()` - Pause/resume execution
   - `list()` - List runs with pagination

2. **Events** - Event log for deterministic replay
   - `create()` - Log an event
   - `list()` - List events for a run
   - `listByCorrelationId()` - List events by correlation ID

3. **Hooks** - Webhook subscriptions
   - `create()` - Register a webhook
   - `get()` - Get hook by ID
   - `getByToken()` - Get hook by token
   - `dispose()` - Delete a webhook
   - `list()` - List hooks for a run

4. **Steps** - Step execution state
   - `create()` - Create a step record
   - `get()` - Get step by ID
   - `update()` - Update step status/output
   - `list()` - List steps for a run

### Queue Layer

The queue layer differs by database type:

#### PostgreSQL

Uses [pg-boss](https://github.com/timgit/pg-boss) for robust job queue with advisory locks:

```typescript
const boss = new PgBoss({
  connectionString,
  schema: 'workflow',
  ...
});

await boss.start();
await boss.work('workflow-runs', async (job) => {
  // Process workflow
});
```

#### MySQL and SQLite

Uses table-based queue (`src/queue/table-queue.ts`) with polling:

```typescript
const queue = createTableQueue(dbType, adapter, schema, {
  jobPrefix: 'workflow_job',
  queueConcurrency: 10,
});

await queue.start(); // Starts polling worker
```

**Queue Schema:**

```sql
CREATE TABLE queue_jobs (
  id VARCHAR(255) PRIMARY KEY,
  run_id VARCHAR(255) NOT NULL,
  workflow_name VARCHAR(500) NOT NULL,
  status ENUM('pending', 'processing', 'completed', 'failed'),
  locked_until TIMESTAMP NULL,
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 5,
  data JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_status_locked (status, locked_until)
);
```

**Polling Logic:**

1. Every 1 second, query for pending jobs
2. Try to lock job with UPDATE + rowsAffected check (MySQL) or UPDATE...RETURNING (SQLite)
3. If locked, process the job
4. Update status to completed/failed
5. Retry failed jobs up to max_attempts

### Database Schema

All tables use consistent patterns:

**Primary Keys:**
- Runs: `wrun_<ULID>` (e.g., `wrun_01K8APMKBN60B6R806HCN5S5MQ`)
- Events: `wevt_<ULID>`
- Steps: `wstp_<ULID>`
- Hooks: `whook_<ULID>`
- Jobs: `<jobPrefix>_<ULID>` (queue only)

**Timestamps:**
- `created_at` - When record was created (auto-set)
- `started_at` - When execution started (set on first 'running' transition)
- `completed_at` - When execution finished (set on 'completed'/'failed'/'cancelled')

**Status Fields:**
- Runs: `pending` → `running` → `completed`/`failed`/`cancelled`
- Steps: `pending` → `running` → `completed`/`failed`
- Jobs: `pending` → `processing` → `completed`/`failed`

### Type Safety

The package uses TypeScript with strict types from `@workflow/world`:

```typescript
import type { Storage, QueueAdapter, DatabaseAdapter } from '@workflow/world';

export function createRunsStorage(
  adapter: DatabaseAdapter,
  schema: any,
  dbType: DatabaseType
): Storage['runs'] {
  // Implementation
}
```

This ensures type compatibility across all world backend implementations (`world-sql`, `world-embedded`, `world-vercel`).

## Performance Considerations

### Connection Pooling

MySQL connections use pooling by default via Drizzle:

```typescript
const adapter = createAdapter('mysql', connectionString, schema);
// Creates a connection pool with sensible defaults
```

For production, consider tuning pool settings in `src/adapters/mysql.ts`:

```typescript
const pool = mysql.createPool({
  uri: connectionString,
  connectionLimit: 10,        // Max connections
  queueLimit: 0,              // Unlimited queue
  waitForConnections: true,   // Wait for available connection
});
```

### Query Performance

Ensure indexes are created for common queries:

```sql
-- Already included in schema
CREATE INDEX idx_runs_status ON runs(status);
CREATE INDEX idx_runs_workflow_name ON runs(workflow_name);
CREATE INDEX idx_events_run_id ON events(run_id);
CREATE INDEX idx_events_correlation_id ON events(correlation_id);
CREATE INDEX idx_steps_run_id ON steps(run_id);
CREATE INDEX idx_hooks_run_id ON hooks(run_id);
CREATE INDEX idx_queue_jobs_status ON queue_jobs(status, locked_until);
```

### Queue Concurrency

Adjust `queueConcurrency` based on your workload:

- **Low (1-5):** For workflows with high resource usage per job
- **Medium (10-20):** Default for most applications
- **High (50+):** For lightweight workflows with I/O wait time

```typescript
const world = createWorld({
  databaseType: 'mysql',
  connectionString: '...',
  queueConcurrency: 20,  // Process up to 20 jobs concurrently
});
```

## Migration from PostgreSQL

If you're migrating from PostgreSQL to MySQL:

1. **Export data from PostgreSQL:**

```bash
pg_dump -h localhost -U world -d world --data-only --inserts > export.sql
```

2. **Convert to MySQL format:**

```bash
# Replace PostgreSQL-specific syntax
sed -i '' 's/::jsonb//g' export.sql
sed -i '' 's/::json//g' export.sql
sed -i '' "s/'/\\\'/g" export.sql
```

3. **Import to MySQL:**

```bash
docker exec -i workflow-mysql mysql -u workflow -pworkflow workflow < export.sql
```

4. **Update connection string:**

```bash
# Old
WORKFLOW_SQL_URL=postgres://world:world@localhost:5432/world

# New
WORKFLOW_SQL_DATABASE_TYPE=mysql
WORKFLOW_SQL_URL=mysql://workflow:workflow@localhost:3306/workflow
```

## Next Steps

- Read the main [README.md](./README.md) for general world-sql documentation
- Check out [example workflows](../../workbench/nextjs-turbopack/workflows/)
- Learn about [workflow patterns](../../packages/core/README.md)
- See [deployment guide](../../docs/deployment.md) for production setup

## Support

For issues or questions:

- File an issue: https://github.com/anthropics/workflow-sdk/issues
- Check existing issues for MySQL: https://github.com/anthropics/workflow-sdk/labels/mysql
