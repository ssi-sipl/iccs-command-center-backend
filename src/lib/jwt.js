import jwt from "jsonwebtoken";

export const signAccessToken = (user) =>
  jwt.sign(
    { uid: user.id, role: user.role },
    "asasdfasdfadsfadsfasdfdasfadsf",
    {
      expiresIn: "7d",
    },
  );

export const signRefreshToken = (user) =>
  jwt.sign({ uid: user.id }, "sadfsadfdsafasdfasdfsdafadsfsdfsda", {
    expiresIn: "7d",
  });
