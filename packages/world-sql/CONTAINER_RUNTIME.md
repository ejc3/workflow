# Container Runtime Support (Docker or Podman)

All testcontainer-based tests work with **both Docker and Podman**. The runtime is automatically detected.

## Quick Start

### With Docker

```bash
# Make sure Docker is running
docker info

# Run tests
pnpm test test/mysql-working-example.test.ts
pnpm test test/spec.test.ts
```

### With Podman

```bash
# Install Podman
# macOS: brew install podman
# Linux: dnf install podman / apt install podman

# Start Podman machine (macOS/Windows only)
podman machine init
podman machine start

# Run tests (automatically uses Podman)
pnpm test test/mysql-working-example.test.ts
pnpm test test/spec.test.ts
```

## How It Works

The test helper `test/helpers/container-runtime.ts` automatically:

1. **Detects available runtime**:
   - Tries `docker info` first
   - Falls back to `podman info` if Docker unavailable
   - Fails with helpful message if neither available

2. **Configures testcontainers**:
   - For Docker: Uses default configuration
   - For Podman: Sets `DOCKER_HOST` and `TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE`

3. **Handles Podman specifics**:
   - Starts Podman machine on macOS/Windows if needed
   - Disables Ryuk (cleanup container) for better Podman compatibility
   - Configures correct socket paths per OS

## Runtime Detection

### Automatic

```typescript
import { setupContainerRuntime } from './helpers/container-runtime.js';

beforeAll(async () => {
  const runtime = await setupContainerRuntime();
  console.log(`Using: ${runtime}`); // 'docker' or 'podman'
});
```

### Manual Override

Force a specific runtime:

```bash
# Force Podman
export TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE=/run/user/1000/podman/podman.sock

# Run tests
pnpm test
```

## Platform-Specific Podman Sockets

The helper automatically finds the correct Podman socket:

### macOS
```
~/.local/share/containers/podman/machine/podman.sock
```

### Linux (rootless)
```
/run/user/$(id -u)/podman/podman.sock
```

### Linux (root)
```
/run/podman/podman.sock
```

### Windows
```
//./pipe/podman-machine-default
```

## Installing Podman

### macOS
```bash
brew install podman
podman machine init
podman machine start
```

### Linux (Fedora/RHEL)
```bash
sudo dnf install podman
```

### Linux (Debian/Ubuntu)
```bash
sudo apt install podman
```

### Windows
Download from: https://podman.io/getting-started/installation

## Tests That Use Containers

All these tests work with Docker or Podman:

- `test/spec.test.ts` - PostgreSQL backend
- `test/mysql-working-example.test.ts` - MySQL backend
- `test/all-databases.test.ts` - PostgreSQL + MySQL backends

## Troubleshooting

### Error: "No container runtime found"

**Solution**: Install Docker or Podman
```bash
# Docker
https://docs.docker.com/get-docker/

# Podman
brew install podman  # macOS
```

### Error: "Podman machine not running"

**Solution**: Start the Podman machine
```bash
podman machine start
```

### Error: "Cannot connect to Podman socket"

**Solution**: Check socket path
```bash
# List running machines
podman machine list

# Check socket
podman machine inspect podman-machine-default | grep -i socket
```

### Error: "Permission denied" (Linux)

**Solution**: Use rootless Podman or add user to podman group
```bash
# Rootless (recommended)
podman system service --time=0 unix:///run/user/$(id -u)/podman/podman.sock

# Or add to group
sudo usermod -aG podman $USER
```

### Slow container startup with Podman

**Reason**: Ryuk cleanup container may have issues

**Solution**: Already handled! Tests automatically disable Ryuk for Podman:
```typescript
process.env.TESTCONTAINERS_RYUK_DISABLED = 'true';
```

## CI/CD Examples

### GitHub Actions with Docker

```yaml
test-mysql:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v3
    - run: pnpm test test/mysql-working-example.test.ts
```

### GitHub Actions with Podman

```yaml
test-mysql-podman:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v3
    - name: Install Podman
      run: |
        sudo apt update
        sudo apt install -y podman
    - name: Run tests
      run: pnpm test test/mysql-working-example.test.ts
      # Automatically detects and uses Podman
```

### GitLab CI with Docker

```yaml
test:mysql:
  image: node:20
  services:
    - docker:dind
  script:
    - pnpm test test/mysql-working-example.test.ts
```

### GitLab CI with Podman

```yaml
test:mysql:podman:
  image: quay.io/podman/stable
  script:
    - podman system service --time=0 &
    - pnpm test test/mysql-working-example.test.ts
```

## Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `DOCKER_HOST` | Container socket | `unix:///var/run/docker.sock` |
| `TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE` | Override socket | `/run/podman/podman.sock` |
| `TESTCONTAINERS_RYUK_DISABLED` | Disable cleanup container | `true` (auto-set for Podman) |

## Benefits of Podman

- ✅ **Rootless**: Runs without root privileges
- ✅ **Daemonless**: No background daemon required
- ✅ **OCI-compliant**: Compatible with Docker images
- ✅ **Drop-in replacement**: Use `alias docker=podman`

## Debugging

Enable verbose output:

```bash
# See what runtime is detected
DEBUG=testcontainers pnpm test test/mysql-working-example.test.ts

# Check Podman configuration
podman info

# Test Podman socket
podman --remote info
```

## Summary

**Just install Docker or Podman and run the tests. Everything else is automatic!**

- ✅ Auto-detects available runtime
- ✅ Configures socket paths automatically
- ✅ Handles Podman-specific quirks
- ✅ Works on macOS, Linux, and Windows
- ✅ Same tests work with both runtimes
