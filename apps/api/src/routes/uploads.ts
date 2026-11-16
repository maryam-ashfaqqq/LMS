import { Router } from 'express';
import multer from 'multer';
import { config } from '../config';
import { storage } from '../lib/storage';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/validate';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 1 },
});

export const uploadRouter = Router();

uploadRouter.post(
  '/',
  requireAuth,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: { message: 'Choose a file to upload.', code: 'UPLOAD_REQUIRED' } });
      return;
    }
    const stored = await storage.save({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      originalName: req.file.originalname,
    });
    res.status(201).json(stored);
  }),
);
