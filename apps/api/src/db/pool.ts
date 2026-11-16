import type { QueryValues } from 'mysql2';
import mysql, { type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import { config } from '../config';

export const pool: Pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  ssl: config.db.ssl,
  waitForConnections: true,
  connectionLimit: 10,
  connectTimeout: 20000,
  namedPlaceholders: true,
  decimalNumbers: true,
  timezone: 'Z',
  enableKeepAlive: true,
});

export async function query<T extends RowDataPacket>(
  sql: string,
  params: Record<string, unknown> = {},
): Promise<T[]> {
  const [rows] = await pool.query<T[]>(sql, params as { [key: string]: QueryValues });
  return rows;
}

export async function exec(sql: string, params: Record<string, unknown> = {}): Promise<ResultSetHeader> {
  const [result] = await pool.query<ResultSetHeader>(sql, params as { [key: string]: QueryValues });
  return result;
}

export async function withTransaction<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await fn(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
