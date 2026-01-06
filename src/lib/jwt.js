import jwt from "jsonwebtoken";

export const signAccessToken = (user) =>
  jwt.sign({ uid: user.id, role: user.role }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: "15m",
  });

export const signRefreshToken = (user) =>
  jwt.sign({ uid: user.id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: "7d",
  });
