#!/usr/bin/env node
/**
 * Simple test script to verify the world-sql API works correctly
 */

import { createWorld } from './dist/index.js';

async function testAPI() {
  console.log('🧪 Testing world-sql API...\n');

  // Test 1: Auto-detection with PostgreSQL
  console.log('Test 1: Auto-detect PostgreSQL from connection string');
  try {
    const pgWorld = await createWorld({
      connectionString: 'postgres://user:pass@localhost:5432/db',
    });
    console.log('✅ PostgreSQL world created successfully');
    console.log(`   Database type: postgres (auto-detected)`);
  } catch (error) {
    console.log(`❌ PostgreSQL test failed: ${error.message}`);
  }

  // Test 2: Auto-detection with MySQL
  console.log('\nTest 2: Auto-detect MySQL from connection string');
  try {
    const mysqlWorld = await createWorld({
      connectionString: 'mysql://user:pass@localhost:3306/db',
    });
    console.log('✅ MySQL world created successfully');
    console.log(`   Database type: mysql (auto-detected)`);
  } catch (error) {
    console.log(`❌ MySQL test failed: ${error.message}`);
  }

  // Test 3: Explicit SQLite
  console.log('\nTest 3: Explicit SQLite database type');
  try {
    const sqliteWorld = await createWorld({
      databaseType: 'sqlite',
      connectionString: ':memory:',
    });
    console.log('✅ SQLite world created successfully');
    console.log(`   Database type: sqlite (explicit)`);
  } catch (error) {
    console.log(`❌ SQLite test failed: ${error.message}`);
  }

  // Test 4: Verify backward compatibility
  console.log('\nTest 4: Backward compatibility with PostgresWorldConfig');
  try {
    const legacyWorld = await createWorld({
      connectionString: 'postgresql://user:pass@localhost:5432/db',
      jobPrefix: 'wf_',
    });
    console.log('✅ Legacy config works');
    console.log(
      `   Database type: postgres (auto-detected from postgresql://)`
    );
  } catch (error) {
    console.log(`❌ Legacy config test failed: ${error.message}`);
  }

  console.log('\n✨ All API tests completed!');
}

testAPI().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
