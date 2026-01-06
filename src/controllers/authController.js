import prisma from "../lib/prisma.js";
import bcrypt from "bcrypt";
import { signAccessToken, signRefreshToken } from "../lib/jwt.js";

export async function login(req, res) {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  res
    .cookie("access_token", accessToken, {
      httpOnly: true,
      sameSite: "strict",
      secure: true,
    })
    .cookie("refresh_token", refreshToken, {
      httpOnly: true,
      sameSite: "strict",
      secure: true,
    })
    .json({
      success: true,
      user: { id: user.id, email: user.email, role: user.role },
    });
}

export async function logout(req, res) {
  res
    .clearCookie("access_token")
    .clearCookie("refresh_token")
    .json({ success: true });
}

export async function me(req, res) {
  const user = await prisma.user.findUnique({
    where: { id: req.user.uid },
    select: { id: true, email: true, name: true, role: true },
  });

  res.json({ success: true, user });
}
