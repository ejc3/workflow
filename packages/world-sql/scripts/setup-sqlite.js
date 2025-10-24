#!/usr/bin/env node
/**
 * Set up SQLite schema for @workflow/world-sql
 *
 * Usage:
 *   node scripts/setup-sqlite.js [db-path]
 *
 * Examples:
 *   node scripts/setup-sqlite.js
 *   node scripts/setup-sqlite.js ./example.db
 */

import { setupSqliteSchema } from '../test/helpers/setup-sqlite.js';

async function main() {
  const dbPath = process.argv[2] || './example.db';

  console.log(`\n🔧 Setting up SQLite schema...`);
  console.log(`📁 Database: ${dbPath}\n`);

  try {
    await setupSqliteSchema(dbPath);
    console.log('\n✅ SQLite schema created successfully!\n');
    console.log('You can now run:');
    console.log('  node example.js sqlite\n');
  } catch (error) {
    console.error('\n❌ Error setting up SQLite schema:', error);
    console.error('');
    process.exit(1);
  }
}

main();
