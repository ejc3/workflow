import { execSync } from 'node:child_process';
import { describe, expect, test, beforeAll, afterAll } from 'vitest';
import { MySqlContainer } from '@testcontainers/mysql';
import { createWorld } from '../src/index.js';
import type { World } from '@workflow/world';
import { setupContainerRuntime } from './helpers/container-runtime.js';

/**
 * E2E tests for MySQL backend
 * Works with Docker or Podman
 */

describe('MySQL E2E - Working Example', () => {
  let world: World & { start(): Promise<void> };
  let container: MySqlContainer;
  let connectionString: string;

  beforeAll(async () => {
    // Step 1: Setup container runtime (Docker or Podman)
    const runtime = await setupContainerRuntime();
    console.log(`Using container runtime: ${runtime}`);

    // Step 2: Start MySQL container
    container = await new MySqlContainer('mysql:8')
      .withDatabase('workflow_test')
      .withRootPassword('test')
      .start();

    connectionString = container.getConnectionUri(true); // true = use root user

    process.env.DATABASE_URL = connectionString;
    process.env.WORKFLOW_SQL_DATABASE_TYPE = 'mysql';
    process.env.WORKFLOW_SQL_URL = connectionString;

    // Step 3: Push schema using drizzle-kit
    execSync('pnpm db:push', {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: process.env,
    });

    // Step 3: Create world instance
    world = await createWorld({
      databaseType: 'mysql',
      connectionString,
    });

    // Step 4: Start the queue
    await world.start();
  }, 120_000); // 2 minute timeout for container startup

  afterAll(async () => {
    // Cleanup
    if (container) {
      await container.stop();
    }
  }, 30_000);

  test('can create and retrieve a workflow run', async () => {
    // Create a run (runId is auto-generated)
    const created = await world.runs.create({
      deploymentId: 'dep_mysql_test',
      workflowName: 'mysql-example-workflow',
      input: [{ message: 'Hello, MySQL!' }],
    });

    // Verify auto-generated runId
    expect(created.runId).toMatch(/^wrun_/);
    expect(created.status).toBe('pending');
    expect(created.workflowName).toBe('mysql-example-workflow');

    // Retrieve the run
    const retrieved = await world.runs.get(created.runId);
    expect(retrieved.runId).toBe(created.runId);
    expect(retrieved.input).toEqual([{ message: 'Hello, MySQL!' }]);
  });

  test('can update workflow run status', async () => {
    // Create a run
    const run = await world.runs.create({
      deploymentId: 'dep_mysql_test',
      workflowName: 'status-test',
      input: [],
    });

    // Update to running
    const updated = await world.runs.update(run.runId, {
      status: 'running',
    });

    expect(updated.status).toBe('running');
    expect(updated.startedAt).toBeInstanceOf(Date);
  });

  test('can complete workflow with output', async () => {
    // Create a run
    const run = await world.runs.create({
      deploymentId: 'dep_mysql_test',
      workflowName: 'completion-test',
      input: [{ value: 10 }],
    });

    // Mark as running
    await world.runs.update(run.runId, { status: 'running' });

    // Complete with output
    const completed = await world.runs.update(run.runId, {
      status: 'completed',
      output: [{ result: 42 }],
    });

    expect(completed.status).toBe('completed');
    expect(completed.output).toEqual([{ result: 42 }]);
    expect(completed.completedAt).toBeInstanceOf(Date);
  });

  test('can create and retrieve steps', async () => {
    // Create a parent run
    const run = await world.runs.create({
      deploymentId: 'dep_mysql_test',
      workflowName: 'steps-test',
      input: [],
    });

    // Create a step
    const step = await world.steps.create(run.runId, {
      stepId: 'step_mysql_001',
      stepName: 'fetchData',
      input: [{ url: 'https://example.com' }],
      status: 'pending',
      attempt: 1,
    });

    expect(step.stepId).toBe('step_mysql_001');
    expect(step.stepName).toBe('fetchData');
    expect(step.status).toBe('pending');

    // Retrieve the step
    const retrieved = await world.steps.get(run.runId, 'step_mysql_001');
    expect(retrieved.stepId).toBe('step_mysql_001');
  });

  test('can list workflow runs', async () => {
    // Create several runs
    await world.runs.create({
      deploymentId: 'dep_list',
      workflowName: 'list-test-1',
      input: [],
    });

    await world.runs.create({
      deploymentId: 'dep_list',
      workflowName: 'list-test-2',
      input: [],
    });

    // List with limit
    const list = await world.runs.list({
      pagination: { limit: 10 },
    });

    expect(list.data.length).toBeGreaterThan(0);
    expect(list.data[0]).toHaveProperty('runId');
    expect(list.data[0]).toHaveProperty('workflowName');
    expect(list.data[0]).toHaveProperty('status');
  });

  test('handles errors correctly', async () => {
    // Try to get non-existent run
    await expect(world.runs.get('wrun_nonexistent')).rejects.toThrow(
      'Run not found'
    );
  });

  test('can pause and resume workflow', async () => {
    const run = await world.runs.create({
      deploymentId: 'dep_mysql_test',
      workflowName: 'pause-resume-test',
      input: [],
    });

    // Update to running first
    await world.runs.update(run.runId, { status: 'running' });

    // Pause
    const paused = await world.runs.pause(run.runId);
    expect(paused.status).toBe('paused');

    // Resume
    const resumed = await world.runs.resume(run.runId);
    expect(resumed.status).toBe('running');
  });

  test('can cancel workflow', async () => {
    const run = await world.runs.create({
      deploymentId: 'dep_mysql_test',
      workflowName: 'cancel-test',
      input: [],
    });

    // Cancel
    const cancelled = await world.runs.cancel(run.runId);
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.completedAt).toBeInstanceOf(Date);
  });
});
