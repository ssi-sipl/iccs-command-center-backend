import jwt from "jsonwebtoken";

export const signAccessToken = (user) =>
  jwt.sign(
    { uid: user.id, role: user.role },
    "asasdfasdfadsfadsfasdfdasfadsf",
    {
      expiresIn: "15m",
    }
  );

export const signRefreshToken = (user) =>
  jwt.sign({ uid: user.id }, "sadfsadfdsafasdfasdfsdafadsfsdfsda", {
    expiresIn: "7d",
  });
