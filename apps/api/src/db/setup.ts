import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import mysql from 'mysql2/promise';
import { config } from '../config';
import type { RowDataPacket } from 'mysql2';
import { exec, pool, query } from './pool';
import { settingDefaults } from './settings';
import { hashPassword } from '../lib/password';

const schemaPath = path.resolve(__dirname, '../../../../database/schema.sql');

function assertIdentifier(value: string) {
  if (!/^[A-Za-z0-9_]+$/.test(value)) {
    throw new Error('Database name contains unsupported characters.');
  }
}

function schemaStatements(sql: string) {
  return sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);
}

export async function ensureDatabase() {
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
      ssl: config.db.ssl,
      connectTimeout: 20000,
      multipleStatements: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    throw new Error(
      `Could not connect to the database at ${config.db.host}:${config.db.port} as ${config.db.user}. ${message}. Check DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, and DB_SSL in apps/api/.env.`,
    );
  }

  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${config.db.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    await connection.query(`USE \`${config.db.database}\``);
    for (const statement of schemaStatements(fs.readFileSync(schemaPath, 'utf8'))) {
      await connection.query(statement);
    }
  } finally {
    await connection.end();
  }

  for (const [key, value] of Object.entries(settingDefaults)) {
    await exec(
      `INSERT IGNORE INTO platform_settings (setting_key, setting_value) VALUES (:key, :value)`,
      { key, value },
    );
  }

  if (config.adminEmail && config.adminPassword) {
    const existing = await query<RowDataPacket & { id: string }>(
      'SELECT id FROM users WHERE email = :email LIMIT 1',
      { email: config.adminEmail },
    );
    if (existing.length === 0) {
      try {
        await exec(
          `INSERT INTO users (id, email, password_hash, first_name, last_name, role)
           VALUES (:id, :email, :passwordHash, :firstName, :lastName, 'admin')`,
          {
            id: randomUUID(),
            email: config.adminEmail,
            passwordHash: await hashPassword(config.adminPassword),
            firstName: 'Site',
            lastName: 'Admin',
          },
        );
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code !== 'ER_DUP_ENTRY') throw error;
      }
    }
  }
}

async function main() {
  try {
    await ensureDatabase();
    console.log(`Database ${config.db.database} is ready on ${config.db.host}.`);
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
