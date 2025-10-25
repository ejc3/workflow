#!/usr/bin/env node

// Test the health endpoint (port 3001)

const BASE_URL = 'http://localhost:3001';

async function testHealth() {
  console.log('🏥 Checking health endpoint...\n');

  try {
    const response = await fetch(`${BASE_URL}/api/health`);
    const data = await response.json();

    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(JSON.stringify(data, null, 2));

    if (data.status === 'healthy') {
      console.log('\n✅ System is healthy!');
      process.exit(0);
    } else {
      console.log('\n⚠️  System is unhealthy');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    process.exit(1);
  }
}

testHealth();
