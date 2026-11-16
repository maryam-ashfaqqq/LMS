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
    console.log(`Oakline API listening on ${config.apiPublicUrl}`);
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
