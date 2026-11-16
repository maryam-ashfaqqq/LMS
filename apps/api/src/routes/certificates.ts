import { Router } from 'express';
import type { RowDataPacket } from 'mysql2';
import { query } from '../db/pool';
import { iso } from '../lib/values';
import { asyncHandler } from '../middleware/validate';
import { HttpError } from '../lib/httpError';

export const certificateRouter = Router();

certificateRouter.get(
  '/:code',
  asyncHandler(async (req, res) => {
    const rows = await query<
      RowDataPacket & {
        certificate_code: string;
        issued_at: unknown;
        course_title: string;
        first_name: string;
        last_name: string;
      }
    >(
      `SELECT cert.certificate_code, cert.issued_at, c.title AS course_title, u.first_name, u.last_name
       FROM certificates cert
       JOIN courses c ON c.id = cert.course_id
       JOIN users u ON u.id = cert.user_id
       WHERE cert.certificate_code = :code
       LIMIT 1`,
      { code: String(req.params.code).trim().toUpperCase() },
    );
    const certificate = rows[0];
    if (!certificate) throw new HttpError(404, 'No certificate matches that code.', 'NOT_FOUND');
    res.json({
      certificate: {
        code: certificate.certificate_code,
        issuedAt: iso(certificate.issued_at),
        courseTitle: certificate.course_title,
        studentName: `${certificate.first_name} ${certificate.last_name}`,
      },
    });
  }),
);
