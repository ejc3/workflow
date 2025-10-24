# @workflow/world-sql

An embedded worker/workflow system supporting **PostgreSQL**, **MySQL**, and **SQLite** for multi-host self-hosted solutions. This is a reference implementation - a production-ready solution might run workers in separate processes with a more robust queuing system.

> **Note**: This package was formerly known as `@workflow/world-postgres` and has been refactored to support multiple SQL databases.

## Quick Start

**Want to try it out right now?**

1. **Read the [Getting Started Guide](./GETTING_STARTED.md)** - Step-by-step instructions for starting MySQL, PostgreSQL, or SQLite
2. **Run the example script** - See a working demo in action:

   ```bash
   # Build the package first
   pnpm build

   # Try with SQLite (no container needed)
   node scripts/setup-sqlite.js
   node example.js sqlite

   # Or try with MySQL (container required)
   docker run -d --name workflow-mysql \
     -e MYSQL_ROOT_PASSWORD=workflow \
     -e MYSQL_DATABASE=workflow \
     -e MYSQL_USER=workflow \
     -e MYSQL_PASSWORD=workflow \
     -p 3306:3306 mysql:8
   node scripts/setup-mysql.js
   node example.js mysql
   ```

3. **Read the [Testing Guide](./TESTING.md)** - Learn how to run the comprehensive test suite

## Installation

```bash
npm install @workflow/world-sql
# or
pnpm add @workflow/world-sql
# or
yarn add @workflow/world-sql
```

### Database-Specific Dependencies

Install the appropriate database client for your chosen database:

**PostgreSQL:**
```bash
npm install postgres pg-boss
```

**MySQL:**
```bash
npm install mysql2
```

**SQLite:**
```bash
npm install better-sqlite3
```

## Usage

### Basic Setup

Configure the SQL world using the `WORKFLOW_TARGET_WORLD` environment variable:

```bash
export WORKFLOW_TARGET_WORLD="@workflow/world-sql"
```

### Configuration

Configure using environment variables:

**PostgreSQL:**
```bash
export WORKFLOW_SQL_DATABASE_TYPE="postgres"
export WORKFLOW_SQL_URL="postgres://username:password@localhost:5432/database"
export WORKFLOW_SQL_JOB_PREFIX="myapp"
export WORKFLOW_SQL_WORKER_CONCURRENCY="10"
```

**MySQL:**
```bash
export WORKFLOW_SQL_DATABASE_TYPE="mysql"
export WORKFLOW_SQL_URL="mysql://username:password@localhost:3306/database"
export WORKFLOW_SQL_JOB_PREFIX="myapp"
export WORKFLOW_SQL_WORKER_CONCURRENCY="10"
```

**SQLite:**
```bash
export WORKFLOW_SQL_DATABASE_TYPE="sqlite"
export WORKFLOW_SQL_URL="/path/to/database.db"  # or ":memory:" for in-memory
export WORKFLOW_SQL_JOB_PREFIX="myapp"
export WORKFLOW_SQL_WORKER_CONCURRENCY="10"
```

### Programmatic Usage

**PostgreSQL:**
```typescript
import { createWorld } from "@workflow/world-sql";

const world = await createWorld({
  databaseType: "postgres",
  connectionString: "postgres://username:password@localhost:5432/database",
  jobPrefix: "myapp", // optional
  queueConcurrency: 10, // optional
});

await world.start();
```

**MySQL:**
```typescript
import { createWorld } from "@workflow/world-sql";

const world = await createWorld({
  databaseType: "mysql",
  connectionString: "mysql://username:password@localhost:3306/database",
  jobPrefix: "myapp", // optional
  queueConcurrency: 10, // optional
});

await world.start();
```

**SQLite:**
```typescript
import { createWorld } from "@workflow/world-sql";

const world = await createWorld({
  databaseType: "sqlite",
  connectionString: "/path/to/database.db", // or ":memory:"
  jobPrefix: "myapp", // optional
  queueConcurrency: 10, // optional
});

await world.start();
```

### Auto-Detection

The database type can be auto-detected from the connection string:

```typescript
import { createWorld } from "@workflow/world-sql";

// Automatically detects PostgreSQL from the connection string
const world = await createWorld({
  connectionString: "postgres://localhost:5432/mydb",
});

await world.start();
```

## Configuration Options

| Option             | Type                                 | Default                                    | Description                                                     |
| ------------------ | ------------------------------------ | ------------------------------------------ | --------------------------------------------------------------- |
| `databaseType`     | `'postgres' \| 'mysql' \| 'sqlite'` | Auto-detected from `connectionString`      | The SQL database type to use                                    |
| `connectionString` | `string`                             | `process.env.WORKFLOW_SQL_URL`             | Database connection string or file path (for SQLite)            |
| `jobPrefix`        | `string`                             | `process.env.WORKFLOW_SQL_JOB_PREFIX`      | Optional prefix for queue job names                             |
| `queueConcurrency` | `number`                             | `10`                                       | Number of concurrent queue workers                              |

## Environment Variables

| Variable                               | Description                                        | Default                           |
| -------------------------------------- | -------------------------------------------------- | --------------------------------- |
| `WORKFLOW_TARGET_WORLD`                | Set to `"@workflow/world-sql"` to use this world   | -                                 |
| `WORKFLOW_SQL_DATABASE_TYPE`           | Database type: `postgres`, `mysql`, or `sqlite`    | Auto-detected                     |
| `WORKFLOW_SQL_URL`                     | Database connection string                         | (varies by database)              |
| `WORKFLOW_SQL_JOB_PREFIX`              | Prefix for queue job names                         | `workflow_`                       |
| `WORKFLOW_SQL_WORKER_CONCURRENCY`      | Number of concurrent workers                       | `10`                              |

**Backward Compatibility:**
The following environment variables are still supported for PostgreSQL:
- `WORKFLOW_POSTGRES_URL` → `WORKFLOW_SQL_URL`
- `WORKFLOW_POSTGRES_JOB_PREFIX` → `WORKFLOW_SQL_JOB_PREFIX`
- `WORKFLOW_POSTGRES_WORKER_CONCURRENCY` → `WORKFLOW_SQL_WORKER_CONCURRENCY`

## Database Setup

This package uses different components for each database:

### PostgreSQL
- **pg-boss**: For queue processing and job management (LISTEN/NOTIFY-based)
- **Drizzle ORM**: For database operations and schema management
- **postgres**: For PostgreSQL client connections
- **Real-time streaming**: Uses PostgreSQL's LISTEN/NOTIFY for instant updates

### MySQL
- **Drizzle ORM**: For database operations and schema management
- **mysql2**: For MySQL client connections
- **Table-based queue**: Polling-based queue implementation (200ms intervals)
- **Polling streaming**: Polling-based streaming (200ms intervals)

### SQLite
- **Drizzle ORM**: For database operations and schema management
- **better-sqlite3**: For SQLite client connections
- **Table-based queue**: Polling-based queue implementation (200ms intervals)
- **Polling streaming**: Polling-based streaming (200ms intervals)

Make sure your database is accessible and the user has sufficient permissions to create tables and manage jobs.

## Features

- **Multi-Database Support**: Choose between PostgreSQL, MySQL, or SQLite
- **Durable Storage**: Stores workflow runs, events, steps, hooks, and webhooks
- **Queue Processing**:
  - PostgreSQL: pg-boss for reliable real-time job processing
  - MySQL/SQLite: Polling-based table queue (200ms intervals)
- **Streaming**:
  - PostgreSQL: Real-time event streaming via LISTEN/NOTIFY
  - MySQL/SQLite: Polling-based streaming (200ms intervals)
- **Health Checks**: Built-in connection health monitoring
- **Configurable Concurrency**: Adjustable worker concurrency for queue processing
- **Auto-Detection**: Automatically detects database type from connection string

## Architecture

The package uses an adapter pattern to support multiple databases:

- **Adapters** (`src/adapters/`): Database-specific client implementations
- **Schemas** (`src/schema/`): Database-specific Drizzle schemas
- **Queue** (`src/queue/`): Queue implementations (pg-boss for PostgreSQL, table-based for MySQL/SQLite)
- **Streaming** (`src/streaming/`): Streaming implementations (LISTEN/NOTIFY for PostgreSQL, polling for MySQL/SQLite)

## Performance Considerations

### PostgreSQL
- Best performance with real-time LISTEN/NOTIFY
- Recommended for production workloads requiring low latency
- pg-boss provides robust job queue with minimal polling

### MySQL
- Good performance with polling-based queue and streaming
- 200ms polling interval provides reasonable responsiveness
- Suitable for most production workloads

### SQLite
- Good for development and single-process deployments
- Polling interval of 200ms
- **Not recommended** for multi-process scenarios due to table locking

## Development

For local development, you can use the included Docker Compose configuration for PostgreSQL:

```bash
# Start PostgreSQL database
docker-compose up -d

# Set environment variables for local development
export WORKFLOW_SQL_URL="postgres://world:world@localhost:5432/world"
export WORKFLOW_TARGET_WORLD="@workflow/world-sql"
```

## Migration from @workflow/world-postgres

If you're migrating from `@workflow/world-postgres`:

1. Update package name:
   ```bash
   npm uninstall @workflow/world-postgres
   npm install @workflow/world-sql postgres pg-boss
   ```

2. Update environment variables (optional, old ones still work):
   ```bash
   export WORKFLOW_TARGET_WORLD="@workflow/world-sql"
   # Old: WORKFLOW_POSTGRES_URL
   export WORKFLOW_SQL_URL="postgres://..."
   ```

3. Update import statements:
   ```typescript
   // Old
   import { createWorld } from "@workflow/world-postgres";

   // New
   import { createWorld } from "@workflow/world-sql";
   ```

4. Update `createWorld` call to be async (if not already):
   ```typescript
   // Old
   const world = createWorld({ ... });

   // New
   const world = await createWorld({ ... });
   ```

The API is otherwise backward compatible!
