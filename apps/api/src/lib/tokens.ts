import jwt, { type SignOptions } from 'jsonwebtoken';
import { config } from '../config';
import type { Role } from './roles';

export type TokenPayload = {
  sub: string;
  role: Role;
  email: string;
};

export function signToken(user: { id: string; role: Role; email: string }): string {
  const options: SignOptions = { expiresIn: config.jwtExpiresIn as SignOptions['expiresIn'] };
  return jwt.sign({ sub: user.id, role: user.role, email: user.email }, config.jwtSecret, options);
}

export function verifyToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, config.jwtSecret);
  if (typeof decoded === 'string' || typeof decoded.sub !== 'string') {
    throw new Error('Invalid token payload.');
  }
  const role = decoded.role;
  if (role !== 'admin' && role !== 'instructor' && role !== 'student') {
    throw new Error('Invalid token role.');
  }
  return {
    sub: decoded.sub,
    role,
    email: typeof decoded.email === 'string' ? decoded.email : '',
  };
}
