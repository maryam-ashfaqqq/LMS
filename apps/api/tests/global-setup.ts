export default async function globalSetup() {
  return async () => {
    const { pool } = await import('../src/db/pool');
    await pool.end();
  };
}
