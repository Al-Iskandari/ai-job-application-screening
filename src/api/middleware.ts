import { Request, Response, NextFunction } from 'express';
import admin from "firebase-admin";
import { config } from '@/config/index.js';

// Initialize Firebase Admin if not already
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(config.firebaseServiceAccountPath),
  });
}

export interface AuthRequest extends Request {
  user?: admin.auth.DecodedIdToken;
}

export const firebaseAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing Authorization header" });
    }

    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await admin.auth().verifyIdToken(token);

    req.user = decodedToken; // Attach decoded user info
    next();
  } catch (err) {
    console.error("❌ Firebase auth failed:", err);
    return res.status(401).json({ error: "Unauthorized" });
  }
};

