#!/usr/bin/env node

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { getConfig } from '../config/index.js';

const { Pool } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate() {
  console.log('Running database migrations...');

  const config = getConfig();

  const pool = new Pool({
    host: config.postgres.host,
    port: config.postgres.port,
    database: config.postgres.database,
    user: config.postgres.user,
    password: config.postgres.password,
  });

  try {
    // Read the init script
    const initSqlPath = join(__dirname, '../../scripts/init-db.sql');
    const initSql = await readFile(initSqlPath, 'utf-8');

    // Execute the SQL
    await pool.query(initSql);

    console.log('Migrations completed successfully!');

    // Show table info
    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    console.log('\nCreated tables:');
    tables.rows.forEach((row) => {
      console.log(`  - ${row.table_name}`);
    });
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
