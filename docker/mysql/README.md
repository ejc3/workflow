# Workflow MySQL Docker Image

Pre-configured MySQL 8.0 image with the workflow schema automatically initialized. No manual schema creation required.

## Quick Start

```bash
# Pull the latest image
docker pull ghcr.io/ejc3/workflow-mysql:latest

# Run the container
docker run -d --name workflow-mysql \
  -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_PASSWORD=workflow \
  -p 3306:3306 \
  ghcr.io/ejc3/workflow-mysql:latest
```

After the container starts, the workflow schema will be automatically created in the `workflow` database.

## Environment Variables

### Required

- `MYSQL_ROOT_PASSWORD` - Root user password (required for container startup)
- `MYSQL_PASSWORD` - Password for the workflow user (required)

### Optional

- `MYSQL_DATABASE` - Database name (default: `workflow`)
- `MYSQL_USER` - Database user (default: `workflow`)

## Image Tags

### Latest Production Image

```bash
ghcr.io/ejc3/workflow-mysql:latest
```

Always points to the most recent build from the `main` branch.

### Specific Commit

```bash
ghcr.io/ejc3/workflow-mysql:abc1234
```

Each commit to `main` is tagged with its short SHA (first 7 characters).

### Pull Request Testing

```bash
ghcr.io/ejc3/workflow-mysql:pr-123
```

Pull requests are tagged with `pr-<number>` for testing before merge.

## Usage with @workflow/world-sql

Once the container is running, configure your application:

### Environment Variables

```bash
export WORKFLOW_SQL_URL="mysql://workflow:workflow@localhost:3306/workflow"
export WORKFLOW_SQL_DATABASE_TYPE="mysql"
```

### Next.js Configuration

**`.env.local`:**
```bash
WORKFLOW_SQL_URL=mysql://workflow:workflow@localhost:3306/workflow
WORKFLOW_SQL_DATABASE_TYPE=mysql
```

### Node.js Application

```javascript
import { createWorld } from '@workflow/world-sql';

const world = createWorld({
  databaseType: 'mysql',
  connectionString: 'mysql://workflow:workflow@localhost:3306/workflow'
});

await world.start();
```

## Schema Details

The image automatically creates the following tables on first startup:

- `workflow_runs` - Workflow run state
- `workflow_events` - Event log for replay
- `workflow_steps` - Step execution state
- `workflow_hooks` - Webhook subscriptions
- `workflow_stream_chunks` - Streaming data chunks
- `workflow_jobs` - Job queue for workflow execution

## Custom Configuration

### Using Docker Compose

```yaml
version: '3.8'

services:
  mysql:
    image: ghcr.io/ejc3/workflow-mysql:latest
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_PASSWORD: workflow
    ports:
      - "3306:3306"
    volumes:
      - workflow-data:/var/lib/mysql

volumes:
  workflow-data:
```

### Persistent Data

Add a volume mount to persist data across container restarts:

```bash
docker run -d --name workflow-mysql \
  -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_PASSWORD=workflow \
  -p 3306:3306 \
  -v workflow-data:/var/lib/mysql \
  ghcr.io/ejc3/workflow-mysql:latest
```

### Custom Database Name

```bash
docker run -d --name workflow-mysql \
  -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=myapp \
  -e MYSQL_USER=myuser \
  -e MYSQL_PASSWORD=mypass \
  -p 3306:3306 \
  ghcr.io/ejc3/workflow-mysql:latest
```

## Health Check

Verify the database is ready:

```bash
docker exec workflow-mysql mysqladmin ping -h localhost -u workflow -pworkflow
```

Check that tables were created:

```bash
docker exec workflow-mysql mysql -u workflow -pworkflow workflow -e "SHOW TABLES;"
```

## Building Locally

```bash
cd docker/mysql
docker build -t workflow-mysql .
docker run -d --name workflow-mysql \
  -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_PASSWORD=workflow \
  -p 3306:3306 \
  workflow-mysql
```

## Troubleshooting

### Container exits immediately

Check logs for errors:
```bash
docker logs workflow-mysql
```

Common issues:
- Missing `MYSQL_ROOT_PASSWORD` or `MYSQL_PASSWORD`
- Port 3306 already in use

### Schema not created

The schema is only created on the **first startup** of a fresh database. If you're reusing a volume with an existing database, the init script won't run.

To reset:
```bash
docker stop workflow-mysql
docker rm workflow-mysql
docker volume rm workflow-data  # Remove existing data
# Then start fresh container
```

### Connection refused

Wait a few seconds for MySQL to finish initializing:
```bash
# Poll until ready
until docker exec workflow-mysql mysqladmin ping -h localhost -u workflow -pworkflow 2>/dev/null; do
  echo "Waiting for MySQL..."
  sleep 1
done
echo "MySQL is ready!"
```

## Platform Support

The image is built for multiple platforms:
- `linux/amd64` (x86_64)
- `linux/arm64` (Apple Silicon, ARM servers)

Docker automatically pulls the correct image for your platform.
