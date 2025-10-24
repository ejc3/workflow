import mysql from 'mysql2/promise';

/**
 * Helper to create MySQL tables programmatically
 * Mirrors the schema from src/schema/mysql.ts
 */
export async function setupMysqlSchema(
  connectionString: string
): Promise<void> {
  const connection = await mysql.createConnection(connectionString);

  try {
    // Create all tables manually
    await connection.query(`
    CREATE TABLE IF NOT EXISTS workflow_runs (
      id VARCHAR(255) PRIMARY KEY,
      deployment_id VARCHAR(255) NOT NULL,
      status VARCHAR(50) NOT NULL,
      name VARCHAR(255) NOT NULL,
      execution_context JSON,
      input JSON NOT NULL,
      output JSON,
      error TEXT,
      error_code VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      completed_at TIMESTAMP,
      started_at TIMESTAMP,
      INDEX workflow_name_idx(name),
      INDEX status_idx(status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

    await connection.query(`
    CREATE TABLE IF NOT EXISTS workflow_events (
      id VARCHAR(255) PRIMARY KEY,
      type VARCHAR(255) NOT NULL,
      correlation_id VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      run_id VARCHAR(255) NOT NULL,
      payload JSON,
      INDEX run_fk_idx(run_id),
      INDEX correlation_id_fk_idx(correlation_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

    await connection.query(`
    CREATE TABLE IF NOT EXISTS workflow_steps (
      run_id VARCHAR(255) NOT NULL,
      step_id VARCHAR(255) PRIMARY KEY,
      step_name VARCHAR(255) NOT NULL,
      status VARCHAR(50) NOT NULL,
      input JSON NOT NULL,
      output JSON,
      error TEXT,
      error_code VARCHAR(255),
      attempt INT NOT NULL,
      started_at TIMESTAMP,
      completed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      INDEX run_fk_idx(run_id),
      INDEX status_idx(status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

    await connection.query(`
    CREATE TABLE IF NOT EXISTS workflow_hooks (
      run_id VARCHAR(255) NOT NULL,
      hook_id VARCHAR(255) PRIMARY KEY,
      token VARCHAR(255) NOT NULL,
      owner_id VARCHAR(255) NOT NULL,
      project_id VARCHAR(255) NOT NULL,
      environment VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      metadata JSON,
      INDEX run_fk_idx(run_id),
      INDEX token_idx(token)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

    await connection.query(`
    CREATE TABLE IF NOT EXISTS workflow_stream_chunks (
      id VARCHAR(255) NOT NULL,
      stream_id VARCHAR(255) NOT NULL,
      data BLOB NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      eof BOOLEAN NOT NULL,
      PRIMARY KEY (stream_id, id),
      INDEX stream_idx(stream_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

    await connection.query(`
    CREATE TABLE IF NOT EXISTS workflow_jobs (
      id VARCHAR(255) PRIMARY KEY,
      queue_name VARCHAR(255) NOT NULL,
      payload JSON NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      attempts INT NOT NULL DEFAULT 0,
      max_attempts INT NOT NULL DEFAULT 3,
      locked_until TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      scheduled_for TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      idempotency_key VARCHAR(255),
      error TEXT,
      INDEX queue_name_idx(queue_name),
      INDEX status_idx(status),
      INDEX scheduled_idx(scheduled_for),
      INDEX idempotency_idx(idempotency_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

    console.log('MySQL schema created successfully');
  } finally {
    await connection.end();
  }
}

/**
 * Helper to clean up MySQL test database
 */
export async function cleanupMysqlSchema(
  connectionString: string
): Promise<void> {
  const connection = await mysql.createConnection(connectionString);

  const tables = [
    'workflow_jobs',
    'workflow_stream_chunks',
    'workflow_hooks',
    'workflow_steps',
    'workflow_events',
    'workflow_runs',
  ];

  for (const table of tables) {
    await connection.query(`DROP TABLE IF EXISTS ${table}`);
  }

  await connection.end();
}
