import fs from 'fs';
import { createApp } from './app';
import { config } from './config';

if (!fs.existsSync(config.uploadDir)) {
  fs.mkdirSync(config.uploadDir, { recursive: true });
}

const app = createApp();
app.listen(config.port, () => {
  console.log(`Oakline API listening on ${config.apiPublicUrl}`);
});
