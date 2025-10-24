#!/usr/bin/env node
/**
 * Simple example script to test @workflow/world-sql
 *
 * Usage:
 *   # With MySQL (requires container running)
 *   node example.js mysql
 *
 *   # With SQLite (no container needed)
 *   node example.js sqlite
 *
 *   # With PostgreSQL (requires container running)
 *   node example.js postgres
 */

import { createWorld } from './dist/index.js';

async function main() {
  const dbType = process.argv[2] || 'sqlite';

  console.log(
    `\n🚀 Starting workflow backend with ${dbType.toUpperCase()}...\n`
  );

  // Connection strings
  const connectionStrings = {
    postgres: 'postgres://workflow:workflow@localhost:5432/workflow',
    mysql: 'mysql://workflow:workflow@localhost:3306/workflow',
    sqlite: './example.db',
  };

  const connectionString = connectionStrings[dbType];
  console.log(`📡 Connection: ${connectionString}`);

  try {
    const world = await createWorld({
      databaseType: dbType,
      connectionString,
    });

    await world.start();
    console.log('✅ Backend started successfully\n');

    // Create a test workflow run
    console.log('📝 Creating workflow run...');
    const run = await world.runs.create({
      deploymentId: 'dep_example',
      workflowName: 'hello-world',
      input: [{ message: 'Hello from the example script!' }],
    });

    console.log(`✅ Created run: ${run.runId}`);
    console.log(`   Status: ${run.status}`);
    console.log(`   Created: ${run.createdAt}\n`);

    // Update to running
    console.log('🏃 Starting workflow execution...');
    const running = await world.runs.update(run.runId, {
      status: 'running',
    });
    console.log(`✅ Status: ${running.status}`);
    console.log(`   Started: ${running.startedAt}\n`);

    // Create a step
    console.log('📋 Creating workflow step...');
    const step = await world.steps.create(run.runId, {
      stepId: `step_${Date.now()}`,
      stepName: 'hello-step',
      input: [{ action: 'greet' }],
    });
    console.log(`✅ Created step: ${step.stepId}`);
    console.log(`   Status: ${step.status}\n`);

    // Update step to running
    console.log('🏃 Running step...');
    const runningStep = await world.steps.update(run.runId, step.stepId, {
      status: 'running',
    });
    console.log(`✅ Step status: ${runningStep.status}\n`);

    // Complete step
    console.log('✅ Completing step...');
    const completedStep = await world.steps.update(run.runId, step.stepId, {
      status: 'completed',
      output: [{ greeting: 'Hello, World!' }],
    });
    console.log(`✅ Step completed`);
    console.log(`   Output:`, completedStep.output);
    console.log(`   Completed: ${completedStep.completedAt}\n`);

    // Complete the workflow
    console.log('✅ Completing workflow...');
    const completed = await world.runs.update(run.runId, {
      status: 'completed',
      output: [{ result: 'Workflow completed successfully!' }],
    });
    console.log(`✅ Workflow completed`);
    console.log(`   Status: ${completed.status}`);
    console.log(`   Output:`, completed.output);
    console.log(`   Completed: ${completed.completedAt}\n`);

    // Test pause/resume
    console.log('🔄 Testing pause/resume with a new run...');
    const pauseRun = await world.runs.create({
      deploymentId: 'dep_example',
      workflowName: 'pause-test',
      input: [{ test: 'pause-resume' }],
    });

    await world.runs.update(pauseRun.runId, { status: 'running' });
    console.log(`✅ Created and started run: ${pauseRun.runId}`);

    const paused = await world.runs.pause(pauseRun.runId);
    console.log(`⏸️  Paused: ${paused.status}`);

    const resumed = await world.runs.resume(pauseRun.runId);
    console.log(`▶️  Resumed: ${resumed.status}\n`);

    // Test cancellation
    console.log('❌ Testing cancellation...');
    const cancelRun = await world.runs.create({
      deploymentId: 'dep_example',
      workflowName: 'cancel-test',
      input: [{ test: 'cancel' }],
    });

    await world.runs.update(cancelRun.runId, { status: 'running' });
    const cancelled = await world.runs.cancel(cancelRun.runId);
    console.log(`✅ Cancelled run: ${cancelled.runId} (${cancelled.status})\n`);

    // List all runs
    console.log('📋 Listing all workflow runs...');
    const {
      data: runs,
      hasMore,
      cursor,
    } = await world.runs.list({
      pagination: { limit: 10 },
    });
    console.log(
      `✅ Found ${runs.length} run(s)${hasMore ? ' (more available)' : ''}`
    );
    for (const r of runs) {
      console.log(`   - ${r.runId}`);
      console.log(`     Workflow: ${r.workflowName}`);
      console.log(`     Status: ${r.status}`);
      console.log(`     Created: ${r.createdAt}`);
    }

    console.log(
      `\n🎉 All tests completed successfully with ${dbType.toUpperCase()}!\n`
    );

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error);
    console.error('\nTroubleshooting:');

    if (dbType === 'mysql' || dbType === 'postgres') {
      console.error(`  1. Make sure ${dbType} container is running:`);
      console.error(`     docker ps | grep workflow-${dbType}`);
      console.error(`  2. Make sure schema is set up (see GETTING_STARTED.md)`);
      console.error(`  3. Check connection string: ${connectionString}`);
    } else if (dbType === 'sqlite') {
      console.error(`  1. Make sure schema is set up`);
      console.error(`  2. Run: node scripts/setup-sqlite.js`);
    }

    process.exit(1);
  }
}

main();
