import fs from 'fs';
import { createApp } from './app';
import { config } from './config';
import { ensureDatabase } from './db/setup';

if (!fs.existsSync(config.uploadDir)) {
  fs.mkdirSync(config.uploadDir, { recursive: true });
}

async function main() {
  await ensureDatabase();
  const app = createApp();
  app.listen(config.port, () => {
    const ssl = config.db.ssl ? 'on' : 'off';
    console.log(`Oakline API listening on ${config.apiPublicUrl}`);
    console.log(`Database ${config.db.database} at ${config.db.host}:${config.db.port} (ssl ${ssl})`);
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
