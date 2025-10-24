import { describe, expect, test, beforeAll, afterAll } from 'vitest';
import { unlink } from 'node:fs/promises';
import { createWorld } from '../src/index.js';
import type { World } from '@workflow/world';
import { setupSqliteSchema } from './helpers/setup-sqlite.js';

/**
 * WORKING EXAMPLE: Simple e2e test for SQLite
 *
 * This demonstrates the correct way to test world-sql with SQLite.
 * Key points:
 * 1. Setup schema before creating world
 * 2. Don't provide runId - it's auto-generated
 * 3. Clean up test database after tests
 */

describe('SQLite E2E - Working Example', () => {
  let world: World & { start(): Promise<void> };
  const testDbPath = './test-working-example.db';

  beforeAll(async () => {
    // Step 1: Create schema
    await setupSqliteSchema(testDbPath);

    // Step 2: Create world instance
    world = await createWorld({
      databaseType: 'sqlite',
      connectionString: testDbPath,
    });

    // Step 3: Start the queue
    await world.start();
  });

  afterAll(async () => {
    // Cleanup test database
    try {
      await unlink(testDbPath);
      await unlink(`${testDbPath}-shm`);
      await unlink(`${testDbPath}-wal`);
    } catch {
      // Ignore errors if files don't exist
    }
  });

  test('can create and retrieve a workflow run', async () => {
    // Create a run (runId is auto-generated)
    const created = await world.runs.create({
      deploymentId: 'dep_example',
      workflowName: 'example-workflow',
      input: [{ message: 'Hello, World!' }],
    });

    // Verify auto-generated runId
    expect(created.runId).toMatch(/^wrun_/);
    expect(created.status).toBe('pending');
    expect(created.workflowName).toBe('example-workflow');

    // Retrieve the run
    const retrieved = await world.runs.get(created.runId);
    expect(retrieved.runId).toBe(created.runId);
    expect(retrieved.input).toEqual([{ message: 'Hello, World!' }]);
  });

  test('can update workflow run status', async () => {
    // Create a run
    const run = await world.runs.create({
      deploymentId: 'dep_example',
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
      deploymentId: 'dep_example',
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
      deploymentId: 'dep_example',
      workflowName: 'steps-test',
      input: [],
    });

    // Create a step
    const step = await world.steps.create(run.runId, {
      stepId: 'step_example_001',
      stepName: 'fetchData',
      input: [{ url: 'https://example.com' }],
      status: 'pending',
      attempt: 1,
    });

    expect(step.stepId).toBe('step_example_001');
    expect(step.stepName).toBe('fetchData');
    expect(step.status).toBe('pending');

    // Retrieve the step
    const retrieved = await world.steps.get(run.runId, 'step_example_001');
    expect(retrieved.stepId).toBe('step_example_001');
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
      deploymentId: 'dep_example',
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
      deploymentId: 'dep_example',
      workflowName: 'cancel-test',
      input: [],
    });

    // Cancel
    const cancelled = await world.runs.cancel(run.runId);
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.completedAt).toBeInstanceOf(Date);
  });
});
