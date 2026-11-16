import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import { config } from '../config';
import { pool } from './pool';
import { seed } from './seed';

const schemaPath = path.resolve(__dirname, '../../../../database/schema.sql');

function assertIdentifier(value: string) {
  if (!/^[A-Za-z0-9_]+$/.test(value)) {
    throw new Error('Database name contains unsupported characters.');
  }
}

export async function setupDatabase() {
  assertIdentifier(config.db.database);
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema file not found at ${schemaPath}`);
  }
  let connection: mysql.Connection | null = null;
  try {
    connection = await mysql.createConnection({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      multipleStatements: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    throw new Error(
      `Could not connect to MySQL at ${config.db.host}:${config.db.port} as ${config.db.user}. ${message}. Set DB_HOST, DB_PORT, DB_USER, and DB_PASSWORD in apps/api/.env.`,
    );
  }
  try {
    await connection.query(`DROP DATABASE IF EXISTS \`${config.db.database}\``);
    await connection.query(
      `CREATE DATABASE \`${config.db.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    await connection.query(`USE \`${config.db.database}\``);
    await connection.query(fs.readFileSync(schemaPath, 'utf8'));
  } finally {
    await connection.end();
  }
  await seed();
}

async function main() {
  try {
    await setupDatabase();
    console.log(`Database ${config.db.database} is ready.`);
    console.log('Demo accounts are listed in the README.');
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  void main();
}
