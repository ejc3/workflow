import { execSync } from 'node:child_process';

/**
 * Detect and configure container runtime (Docker or Podman)
 */

export type ContainerRuntime = 'docker' | 'podman';

export function detectContainerRuntime(): ContainerRuntime {
  // Check for explicit override
  const override = process.env.TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE;
  if (override?.includes('podman')) {
    return 'podman';
  }

  // Try docker first
  try {
    execSync('docker info', { stdio: 'ignore' });
    return 'docker';
  } catch {
    // Docker not available, try podman
  }

  // Try podman
  try {
    execSync('podman info', { stdio: 'ignore' });
    return 'podman';
  } catch {
    // Neither available
  }

  throw new Error(
    'No container runtime found. Please install Docker or Podman.\n' +
      'Docker: https://docs.docker.com/get-docker/\n' +
      'Podman: https://podman.io/getting-started/installation'
  );
}

export function configureContainerRuntime(): ContainerRuntime {
  const runtime = detectContainerRuntime();

  if (runtime === 'podman') {
    // Configure testcontainers to use Podman
    // Podman socket location varies by OS
    const podmanSocket = getPodmanSocket();

    process.env.DOCKER_HOST = `unix://${podmanSocket}`;
    process.env.TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE = podmanSocket;
    process.env.TESTCONTAINERS_RYUK_DISABLED = 'true'; // Ryuk doesn't work well with Podman

    console.log(`Using Podman at ${podmanSocket}`);
  } else {
    console.log('Using Docker');
  }

  return runtime;
}

function getPodmanSocket(): string {
  const platform = process.platform;

  // Get socket path from podman machine inspect (most reliable)
  try {
    const output = execSync('podman machine inspect podman-machine-default', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    const config = JSON.parse(output);
    const socketPath = config[0]?.ConnectionInfo?.PodmanSocket?.Path;
    if (socketPath) {
      return socketPath;
    }
  } catch {
    // Fall back to platform-specific guesses
  }

  // Fallback: Check common Podman socket locations
  if (platform === 'darwin') {
    // macOS fallback
    const homeDir = process.env.HOME || '/Users/' + process.env.USER;
    return `${homeDir}/.local/share/containers/podman/machine/podman.sock`;
  } else if (platform === 'linux') {
    // Linux - try rootless first, then root
    const uid = execSync('id -u', { encoding: 'utf8' }).trim();
    const rootlessSocket = `/run/user/${uid}/podman/podman.sock`;
    const rootSocket = '/run/podman/podman.sock';

    try {
      execSync(`test -S ${rootlessSocket}`, { stdio: 'ignore' });
      return rootlessSocket;
    } catch {
      return rootSocket;
    }
  } else if (platform === 'win32') {
    // Windows
    return '//./pipe/podman-machine-default';
  }

  throw new Error(`Unsupported platform for Podman: ${platform}`);
}

/**
 * Start Podman machine if needed (macOS/Windows)
 */
export async function ensurePodmanMachine(): Promise<void> {
  if (process.platform !== 'darwin' && process.platform !== 'win32') {
    return; // Linux doesn't need a machine
  }

  try {
    // Check if machine is running
    const output = execSync('podman machine list --format json', {
      encoding: 'utf8',
    });
    const machines = JSON.parse(output);

    const runningMachine = machines.find((m: any) => m.Running === true);
    if (runningMachine) {
      console.log(`Podman machine '${runningMachine.Name}' is running`);
      return;
    }

    // Check if default machine exists
    const defaultMachine = machines.find(
      (m: any) => m.Name === 'podman-machine-default'
    );
    if (defaultMachine) {
      console.log('Starting Podman machine...');
      execSync('podman machine start podman-machine-default', {
        stdio: 'inherit',
      });
    } else {
      console.log('Initializing Podman machine...');
      execSync('podman machine init', { stdio: 'inherit' });
      execSync('podman machine start', { stdio: 'inherit' });
    }
  } catch (error) {
    throw new Error(
      `Failed to start Podman machine: ${error}\n` +
        'Try running: podman machine init && podman machine start'
    );
  }
}

/**
 * Setup container runtime before tests
 */
export async function setupContainerRuntime(): Promise<ContainerRuntime> {
  const runtime = configureContainerRuntime();

  if (runtime === 'podman') {
    await ensurePodmanMachine();
  }

  return runtime;
}
