import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { config } from '../config';
import { HttpError } from './httpError';

const allowed = new Map<string, string>([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
  ['application/pdf', '.pdf'],
  ['application/zip', '.zip'],
  ['application/x-zip-compressed', '.zip'],
]);

export type StoredObject = {
  key: string;
  url: string;
  mimeType: string;
  size: number;
  originalName: string;
};

export interface StorageAdapter {
  save(input: { buffer: Buffer; mimeType: string; originalName: string }): Promise<StoredObject>;
}

export class LocalDiskStorage implements StorageAdapter {
  constructor(private readonly directory: string) {}

  async save(input: { buffer: Buffer; mimeType: string; originalName: string }): Promise<StoredObject> {
    const extension = allowed.get(input.mimeType);
    if (!extension) {
      throw new HttpError(400, 'Upload a PNG, JPG, WEBP, GIF, PDF, or ZIP file.', 'UPLOAD_TYPE');
    }
    await fs.mkdir(this.directory, { recursive: true });
    const key = `${randomUUID()}${extension}`;
    const target = path.join(this.directory, key);
    if (!target.startsWith(this.directory)) {
      throw new HttpError(400, 'The upload path was rejected.', 'UPLOAD_PATH');
    }
    await fs.writeFile(target, input.buffer);
    return {
      key,
      url: `${config.apiPublicUrl}/uploads/${key}`,
      mimeType: input.mimeType,
      size: input.buffer.length,
      originalName: path.basename(input.originalName).slice(0, 180),
    };
  }
}

export const storage: StorageAdapter = new LocalDiskStorage(config.uploadDir);
