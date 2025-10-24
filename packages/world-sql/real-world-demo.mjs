#!/usr/bin/env node
/**
 * Real-world demo: Client/Server architecture with world-sql
 *
 * This demonstrates:
 * - Server: Persistent queue worker that processes workflows
 * - Client: Creates workflow runs that get picked up by the server
 * - Workflows persist in MySQL across restarts
 */

import { createWorld } from './dist/index.js';

const connectionString = 'mysql://workflow:workflow@localhost:3306/workflow';

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  Real-World Client/Server Architecture Demo');
console.log('═══════════════════════════════════════════════════════════\n');

async function runServer() {
  console.log('🖥️  SERVER: Starting workflow server...\n');

  const world = createWorld({
    databaseType: 'mysql',
    connectionString,
    queueConcurrency: 3,
  });

  // Start the persistent queue worker (this is the "server")
  await world.start();
  console.log(
    '✅ SERVER: Queue worker started (listening for workflow runs)\n'
  );

  // Keep server running indefinitely
  console.log('📡 SERVER: Waiting for workflow runs to process...\n');
  console.log('   (Server will keep running until you press Ctrl+C)\n');
  console.log('   Press Ctrl+C to shut down the server.\n');

  // Keep the process alive indefinitely
  await new Promise(() => {}); // Never resolves - runs forever
}

async function runClient() {
  console.log('👤 CLIENT: Connecting to workflow backend...\n');

  const world = createWorld({
    databaseType: 'mysql',
    connectionString,
  });

  await world.start();
  console.log('✅ CLIENT: Connected to MySQL backend\n');

  // Client creates workflow runs
  console.log('📝 CLIENT: Creating workflow run...');
  const run = await world.runs.create({
    deploymentId: 'dep_demo',
    workflowName: 'process-order',
    input: [{ orderId: 12345, amount: 99.99 }],
  });

  console.log(`✅ CLIENT: Created run ${run.runId}`);
  console.log(`   Status: ${run.status}`);
  console.log(`   Workflow: ${run.workflowName}\n`);

  // Start workflow execution
  console.log('🔄 CLIENT: Starting workflow execution...');
  await world.runs.update(run.runId, { status: 'running' });
  console.log('✅ CLIENT: Workflow submitted to server queue\n');

  // Create a workflow step
  const step = await world.steps.create(run.runId, {
    stepId: `step_${Date.now()}`,
    stepName: 'validate-order',
    input: [{ action: 'validate' }],
  });

  console.log(`📋 CLIENT: Created step ${step.stepId}`);
  console.log(`   Step: ${step.stepName}\n`);

  // Poll for completion
  console.log('⏳ CLIENT: Waiting for workflow to complete...');
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Complete the workflow
  await world.runs.update(run.runId, {
    status: 'completed',
    output: [{ success: true, message: 'Order processed!' }],
  });

  console.log('✅ CLIENT: Workflow completed!\n');

  // Show persistence: list all runs
  console.log('📊 CLIENT: Querying all workflow runs from database...');
  const { data: allRuns } = await world.runs.list({ pagination: { limit: 5 } });
  console.log(`   Found ${allRuns.length} runs in database:\n`);

  for (const r of allRuns) {
    console.log(`   • ${r.runId}`);
    console.log(`     └─ ${r.workflowName} (${r.status})`);
  }

  console.log('\n✅ CLIENT: Done!\n');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Key Points:');
  console.log('  • Server runs persistently, processing workflows');
  console.log('  • Client submits workflows and they persist in MySQL');
  console.log('  • Multiple clients can submit to the same server');
  console.log('  • Workflows survive server restarts');
  console.log('═══════════════════════════════════════════════════════════\n');
}

// Run based on argument
const mode = process.argv[2];

if (mode === 'server') {
  runServer().catch((err) => {
    console.error('❌ SERVER ERROR:', err);
    process.exit(1);
  });
} else if (mode === 'client') {
  runClient().catch((err) => {
    console.error('❌ CLIENT ERROR:', err);
    process.exit(1);
  });
} else {
  console.log('Usage:');
  console.log('  node real-world-demo.js server   # Run persistent server');
  console.log(
    '  node real-world-demo.js client   # Run client to submit workflow\n'
  );
  process.exit(1);
}
