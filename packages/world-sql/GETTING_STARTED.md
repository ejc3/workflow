# Getting Started with @workflow/world-sql

This guide shows you how to use the SQL-based workflow backend in your application.

## Quick Start

### 1. Choose Your Database

The package supports three databases:
- **PostgreSQL** - Production-ready, full RETURNING support
- **MySQL** - Production-ready, works with MySQL 8+
- **SQLite** - Development/testing, file-based

### 2. Start Your Database

#### Option A: PostgreSQL with Docker

```bash
docker run -d \
  --name workflow-postgres \
  -e POSTGRES_PASSWORD=workflow \
  -e POSTGRES_USER=workflow \
  -e POSTGRES_DB=workflow \
  -p 5432:5432 \
  postgres:15-alpine
```

Connection string: `postgres://workflow:workflow@localhost:5432/workflow`

#### Option B: MySQL with Docker

```bash
docker run -d \
  --name workflow-mysql \
  -e MYSQL_ROOT_PASSWORD=workflow \
  -e MYSQL_DATABASE=workflow \
  -e MYSQL_USER=workflow \
  -e MYSQL_PASSWORD=workflow \
  -p 3306:3306 \
  mysql:8
```

Connection string: `mysql://workflow:workflow@localhost:3306/workflow`

#### Option C: MySQL with Podman

```bash
# Start Podman machine (macOS/Windows)
podman machine start

# Run MySQL container
podman run -d \
  --name workflow-mysql \
  -e MYSQL_ROOT_PASSWORD=workflow \
  -e MYSQL_DATABASE=workflow \
  -e MYSQL_USER=workflow \
  -e MYSQL_PASSWORD=workflow \
  -p 3306:3306 \
  mysql:8
```

Connection string: `mysql://workflow:workflow@localhost:3306/workflow`

#### Option D: SQLite (No Container)

```bash
# Just use a file path
# Connection string: ./workflow.db
```

### 3. Set Up the Schema

#### For PostgreSQL

```bash
# Set environment variable
export DATABASE_URL="postgres://workflow:workflow@localhost:5432/workflow"

# Push schema using drizzle-kit
pnpm db:push
```

#### For MySQL

```typescript
// Use the helper script
import { setupMysqlSchema } from '@workflow/world-sql/test/helpers/setup-mysql';

await setupMysqlSchema('mysql://workflow:workflow@localhost:3306/workflow');
```

Or use the included setup script:

```bash
# Run the setup script
node scripts/setup-mysql.js

# Or with custom connection string
node scripts/setup-mysql.js mysql://user:pass@localhost:3306/mydb
```

#### For SQLite

```typescript
// Use the helper script
import { setupSqliteSchema } from '@workflow/world-sql/test/helpers/setup-sqlite';

await setupSqliteSchema('./workflow.db');
```

### 4. Use in Your Application

#### Basic Example

```typescript
import { createWorld } from '@workflow/world-sql';

// PostgreSQL
const world = await createWorld({
  databaseType: 'postgres',
  connectionString: 'postgres://workflow:workflow@localhost:5432/workflow',
});

// OR MySQL
const world = await createWorld({
  databaseType: 'mysql',
  connectionString: 'mysql://workflow:workflow@localhost:3306/workflow',
});

// OR SQLite
const world = await createWorld({
  databaseType: 'sqlite',
  connectionString: './workflow.db',
});

// Start the queue worker
await world.start();

// Create a workflow run
const run = await world.runs.create({
  deploymentId: 'dep_myapp',
  workflowName: 'my-workflow',
  input: [{ message: 'Hello, world!' }],
});

console.log('Created run:', run.runId);

// Get the run
const retrieved = await world.runs.get(run.runId);
console.log('Status:', retrieved.status);

// List runs
const { data: runs } = await world.runs.list({
  workflowName: 'my-workflow',
  pagination: { limit: 10 },
});
console.log('Found runs:', runs.length);
```

#### Environment Variables

Set these environment variables to avoid hardcoding connection strings:

```bash
# Database type (postgres, mysql, or sqlite)
export WORKFLOW_SQL_DATABASE_TYPE=mysql

# Connection string
export WORKFLOW_SQL_URL=mysql://workflow:workflow@localhost:3306/workflow

# Optional: Queue prefix for job names
export WORKFLOW_SQL_JOB_PREFIX=myapp

# Optional: Worker concurrency (default: 10)
export WORKFLOW_SQL_WORKER_CONCURRENCY=5
```

Then in your code:

```typescript
import { createWorld } from '@workflow/world-sql';

// Uses environment variables automatically
const world = await createWorld();
await world.start();
```

### 5. Try It Out

Use the included example script:

```bash
# With SQLite
node example.js sqlite

# With MySQL
node example.js mysql

# With PostgreSQL
node example.js postgres
```

Or create your own script:

```typescript
// my-example.ts
import { createWorld } from '@workflow/world-sql';

async function main() {
  console.log('🚀 Starting workflow backend...');

  const world = await createWorld({
    databaseType: 'mysql', // or 'postgres', 'sqlite'
    connectionString: 'mysql://workflow:workflow@localhost:3306/workflow',
  });

  await world.start();
  console.log('✅ Backend started');

  // Create a test run
  console.log('📝 Creating workflow run...');
  const run = await world.runs.create({
    deploymentId: 'dep_test',
    workflowName: 'hello-world',
    input: [{ message: 'Testing!' }],
  });

  console.log(`✅ Created run: ${run.runId}`);
  console.log(`   Status: ${run.status}`);
  console.log(`   Created: ${run.createdAt}`);

  // Update to running
  console.log('🏃 Updating to running...');
  const updated = await world.runs.update(run.runId, {
    status: 'running',
  });
  console.log(`✅ Status: ${updated.status}`);
  console.log(`   Started: ${updated.startedAt}`);

  // Complete with output
  console.log('✅ Completing workflow...');
  const completed = await world.runs.update(run.runId, {
    status: 'completed',
    output: [{ result: 'Success!' }],
  });
  console.log(`✅ Status: ${completed.status}`);
  console.log(`   Completed: ${completed.completedAt}`);
  console.log(`   Output:`, completed.output);

  // List all runs
  console.log('📋 Listing all runs...');
  const { data: runs, hasMore } = await world.runs.list({
    pagination: { limit: 10 }
  });
  console.log(`✅ Found ${runs.length} run(s)`);
  for (const r of runs) {
    console.log(`   - ${r.runId}: ${r.workflowName} (${r.status})`);
  }

  console.log('\n🎉 All done!');
  process.exit(0);
}

main().catch(console.error);
```

Run it (after building):

```bash
pnpm build
node my-example.js mysql  # or sqlite, postgres
```

## Container Management

### Check if MySQL is Running

```bash
# Docker
docker ps | grep workflow-mysql

# Podman
podman ps | grep workflow-mysql
```

### View MySQL Logs

```bash
# Docker
docker logs workflow-mysql

# Podman
podman logs workflow-mysql
```

### Connect to MySQL Shell

```bash
# Docker
docker exec -it workflow-mysql mysql -u workflow -pworkflow workflow

# Podman
podman exec -it workflow-mysql mysql -u workflow -pworkflow workflow
```

### Stop/Start Container

```bash
# Docker
docker stop workflow-mysql
docker start workflow-mysql
docker rm workflow-mysql  # Remove

# Podman
podman stop workflow-mysql
podman start workflow-mysql
podman rm workflow-mysql  # Remove
```

## Database-Specific Notes

### PostgreSQL
- ✅ Full `RETURNING` clause support
- ✅ `ON CONFLICT DO NOTHING` support
- Best for production deployments

### MySQL
- ⚠️ No `RETURNING` clause (we handle this automatically)
- ⚠️ No `ON CONFLICT DO NOTHING` (we check-then-insert)
- ✅ Works with MySQL 8+
- ✅ Fully tested with Podman and Docker

### SQLite
- ✅ Full `RETURNING` clause support
- ✅ `ON CONFLICT DO NOTHING` support
- ✅ No container needed
- Best for local development and testing
- Not recommended for production multi-process scenarios

## Troubleshooting

### "Connection refused" error

Make sure your container is running:

```bash
docker ps | grep workflow-mysql
podman ps | grep workflow-mysql
```

### "Access denied" error

Check your connection string credentials match the container setup.

### "Unknown database" error

For MySQL, make sure you created the database:

```sql
CREATE DATABASE workflow;
```

Or use `MYSQL_DATABASE` environment variable when starting container.

### "Table doesn't exist" error

You need to run the schema setup. See step 3 above.

## Next Steps

- Read [TESTING.md](./TESTING.md) to learn about running tests
- Read [HOW_IT_WORKS.md](./HOW_IT_WORKS.md) to understand the architecture
- Check [E2E_TESTING.md](./E2E_TESTING.md) for detailed testing guide
