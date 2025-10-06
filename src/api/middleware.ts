import { Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { config } from '../config';

const oauthClient = new OAuth2Client(config.googleOauthClientId);

export interface AuthRequest extends Request {
  user?: {
    email?: string;
    name?: string;
    sub?: string;
  };
}

/**
 * googleAuth middleware
 * Expects Authorization: Bearer <GOOGLE_ID_TOKEN>
 * Verifies token, attaches simple user info to req.user
 */
export async function googleAuth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Missing Authorization header' });

    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer' || !token) return res.status(401).json({ error: 'Malformed Authorization header' });

    const ticket = await oauthClient.verifyIdToken({
      idToken: token,
      audience: config.googleOauthClientId,
    });
    const payload = ticket.getPayload();
    if (!payload) return res.status(401).json({ error: 'Invalid ID token' });

    req.user = {
      email: payload.email,
      name: payload.name,
      sub: payload.sub,
    };

    // optional: mint an internal JWT and expose it as header for client convenience
    const internalJwt = jwt.sign({ uid: payload.sub, email: payload.email }, config.jwtSecret, { expiresIn: '1h' });
    res.setHeader('X-Internal-JWT', internalJwt);

    next();
  } catch (err) {
    console.error('googleAuth error', err);
    return res.status(401).json({ error: 'Invalid or expired Google ID token' });
  }
}
