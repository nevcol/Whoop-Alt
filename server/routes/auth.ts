import { Router, Request, Response, NextFunction } from 'express';
import { createHmac, randomBytes } from 'node:crypto';

const router = Router();
const APP_PASSWORD = process.env.APP_PASSWORD;
const SECRET = process.env.SESSION_SECRET || 'default-dev-secret';

function getSessionCookie(req: Request): string | null {
  const cookie = req.headers.cookie;
  if (!cookie) return null;
  const match = cookie.match(/ledgerly_session=([^;]+)/);
  return match ? match[1] : null;
}

function createSessionToken(): string {
  return randomBytes(32).toString('hex');
}

function signSessionToken(token: string): string {
  return createHmac('sha256', SECRET).update(token).digest('hex');
}

function verifySessionToken(token: string, signature: string): boolean {
  const expected = signSessionToken(token);
  return expected === signature;
}

router.post('/login', (req: Request, res: Response) => {
  const { password } = req.body;

  if (!APP_PASSWORD) {
    return res.status(501).json({ error: 'Authentication not configured' });
  }

  if (!password || password !== APP_PASSWORD) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  const token = createSessionToken();
  const signature = signSessionToken(token);
  const sessionValue = `${token}.${signature}`;

  res.setHeader(
    'Set-Cookie',
    `ledgerly_session=${sessionValue}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}${
      process.env.NODE_ENV === 'production' ? '; Secure' : ''
    }`,
  );

  res.json({ ok: true });
});

router.get('/me', (req: Request, res: Response) => {
  if (!APP_PASSWORD) {
    return res.json({ authenticated: false, requiresAuth: false });
  }

  const cookie = getSessionCookie(req);
  if (!cookie) {
    return res.status(401).json({ authenticated: false, requiresAuth: true });
  }

  const [token, signature] = cookie.split('.');
  if (!token || !signature || !verifySessionToken(token, signature)) {
    return res.status(401).json({ authenticated: false, requiresAuth: true });
  }

  res.json({ authenticated: true, requiresAuth: true });
});

router.post('/logout', (req: Request, res: Response) => {
  res.setHeader('Set-Cookie', 'ledgerly_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  res.json({ ok: true });
});

export const authRouter = router;

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!APP_PASSWORD) {
    return next();
  }

  const cookie = getSessionCookie(req);
  if (!cookie) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const [token, signature] = cookie.split('.');
  if (!token || !signature || !verifySessionToken(token, signature)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}
