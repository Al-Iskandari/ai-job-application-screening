import express from "express";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";

import { config } from '@/config/index.js';

const authRouter = express.Router();
const client = new OAuth2Client(config.googleOauthClientId);

authRouter.post("/signin", async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: "Missing credential" });

    // Verify Google ID token
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: config.googleOauthClientId,
    });

    const payload = ticket.getPayload();
    if (!payload) return res.status(401).json({ error: "Invalid token" });

    const { sub, email, name, picture } = payload;

    // Generate your own JWT for the app
    const token = jwt.sign(
      { sub, email, name, picture },
      config.jwtSecret,
      { expiresIn: '2h' }
    );

    res.json({
      success: true,
      token,
      user: { email, name, picture },
    });
  } catch (err: any) {
    console.error("Google login error:", err);
    res.status(401).json({ error: "Authentication failed" });
  }
});

export default authRouter;
