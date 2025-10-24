#!/usr/bin/env node
/**
 * Demo server showing MySQL world-sql in action
 */

import { createWorld } from './dist/index.js';

const connectionString = 'mysql://workflow:workflow@localhost:3306/workflow';

console.log('\n🚀 Starting MySQL World-SQL Demo Server...\n');
console.log(`📡 MySQL Connection: ${connectionString}\n`);

// Create world instance
const world = await createWorld({
  databaseType: 'mysql',
  connectionString,
  queueConcurrency: 5,
});

console.log('✅ World instance created');

// Start the queue worker
await world.start();
console.log('✅ Queue worker started (polling every 200ms)\n');

console.log('📊 Server is now ready to accept workflow runs!\n');
console.log('─'.repeat(60));

// Simulate some workflow activity
async function demo() {
  console.log('\n📝 Creating workflow runs...\n');

  // Create 3 workflow runs
  const runs = [];
  for (let i = 1; i <= 3; i++) {
    const run = await world.runs.create({
      deploymentId: 'dep_demo',
      workflowName: `demo-workflow-${i}`,
      input: [{ taskId: i, message: `Processing task ${i}` }],
    });
    runs.push(run);
    console.log(`✅ Created run ${i}: ${run.runId} (status: ${run.status})`);
  }

  console.log('\n🔄 Updating runs to "running" status...\n');

  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];
    await world.runs.update(run.runId, {
      status: 'running',
    });
    console.log(`▶️  Run ${i + 1}: ${run.runId} → running`);

    // Simulate some work
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.log('\n📋 Creating steps for each run...\n');

  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];
    const step = await world.steps.create(run.runId, {
      stepId: `step_${i + 1}`,
      stepName: `process-task-${i + 1}`,
      input: [{ action: 'execute' }],
    });
    console.log(`✅ Created step for run ${i + 1}: ${step.stepId}`);

    // Update step to running
    await world.steps.update(run.runId, step.stepId, {
      status: 'running',
    });

    // Simulate work
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Complete the step
    await world.steps.update(run.runId, step.stepId, {
      status: 'completed',
      output: [{ result: `Task ${i + 1} completed successfully!` }],
    });
    console.log(`✅ Completed step for run ${i + 1}`);
  }

  console.log('\n✅ Completing workflow runs...\n');

  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];
    await world.runs.update(run.runId, {
      status: 'completed',
      output: [{ finalResult: `Workflow ${i + 1} done!` }],
    });
    console.log(`✅ Run ${i + 1}: ${run.runId} → completed`);
  }

  console.log('\n📊 Listing all workflow runs:\n');

  const { data: allRuns } = await world.runs.list({
    pagination: { limit: 10 },
  });

  console.log(`Found ${allRuns.length} total runs:\n`);
  for (const r of allRuns) {
    console.log(`   ${r.runId}`);
    console.log(`   └─ Workflow: ${r.workflowName}`);
    console.log(`   └─ Status: ${r.status}`);
    console.log(`   └─ Created: ${r.createdAt}`);
    if (r.completedAt) {
      console.log(`   └─ Completed: ${r.completedAt}`);
    }
    console.log('');
  }

  console.log('─'.repeat(60));
  console.log('\n🎉 Demo complete! MySQL world-sql is working perfectly.\n');

  process.exit(0);
}

// Run the demo
demo().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
