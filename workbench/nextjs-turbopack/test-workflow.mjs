#!/usr/bin/env node

// Test the addTenWorkflow: input + 2 + 3 + 5 = output
// For input 42, expected output is 52

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function testWorkflow() {
  console.log('🚀 Starting addTenWorkflow with input: 42');

  // Step 1: Start the workflow
  const startRes = await fetch(
    `${BASE_URL}/api/trigger?workflowFn=addTenWorkflow&args=42`,
    {
      method: 'POST',
    }
  );

  if (!startRes.ok) {
    throw new Error(
      `Failed to start workflow: ${startRes.status} ${await startRes.text()}`
    );
  }

  const run = await startRes.json();
  console.log('✅ Workflow started:', { runId: run.runId, status: run.status });

  // Step 2: Poll for completion
  let attempts = 0;
  const maxAttempts = 30;

  while (attempts < maxAttempts) {
    attempts++;
    console.log(`⏳ Checking status (attempt ${attempts})...`);

    const statusRes = await fetch(`${BASE_URL}/api/trigger?runId=${run.runId}`);

    if (statusRes.status === 202) {
      // Still running
      const error = await statusRes.json();
      console.log('   Still running:', error.message);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      continue;
    }

    if (!statusRes.ok) {
      throw new Error(
        `Failed to get result: ${statusRes.status} ${await statusRes.text()}`
      );
    }

    // Completed!
    const result = await statusRes.json();
    console.log('🎉 Workflow completed!');
    console.log('   Input:  42');
    console.log('   Output:', result);
    console.log('   Expected: 52 (42 + 2 + 3 + 5)');
    console.log('   ✅ Test', result === 52 ? 'PASSED' : 'FAILED');
    return;
  }

  throw new Error('Workflow did not complete in time');
}

testWorkflow().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
