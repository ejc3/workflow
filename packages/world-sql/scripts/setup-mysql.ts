#!/usr/bin/env tsx
/**
 * Set up MySQL schema for @workflow/world-sql
 *
 * Usage:
 *   npx tsx scripts/setup-mysql.ts [connection-string]
 *
 * Examples:
 *   npx tsx scripts/setup-mysql.ts
 *   npx tsx scripts/setup-mysql.ts mysql://workflow:workflow@localhost:3306/workflow
 */

import { setupMysqlSchema } from '../test/helpers/setup-mysql.js';

async function main() {
  const connectionString =
    process.argv[2] ||
    process.env.WORKFLOW_SQL_URL ||
    process.env.DATABASE_URL ||
    'mysql://workflow:workflow@localhost:3306/workflow';

  console.log(`\n🔧 Setting up MySQL schema...`);
  console.log(`📡 Connection: ${connectionString}\n`);

  try {
    await setupMysqlSchema(connectionString);
    console.log('\n✅ MySQL schema created successfully!\n');
    console.log('You can now run:');
    console.log('  npx tsx example.ts mysql\n');
  } catch (error) {
    console.error('\n❌ Error setting up MySQL schema:', error);
    console.error('\nTroubleshooting:');
    console.error('  1. Make sure MySQL container is running:');
    console.error('     docker ps | grep mysql');
    console.error('     podman ps | grep mysql');
    console.error('  2. Check connection string is correct');
    console.error('  3. Make sure database exists:');
    console.error(
      '     mysql -u workflow -pworkflow -e "CREATE DATABASE IF NOT EXISTS workflow"'
    );
    console.error('');
    process.exit(1);
  }
}

main();
