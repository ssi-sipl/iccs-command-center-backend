// lib/prisma.js
import { PrismaClient } from "../../generated/prisma/index.js";

let prisma;

// Prevent multiple instances in dev (nodemon hot reload)
if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient();
} else {
  if (!global.__prisma) {
    global.__prisma = new PrismaClient();
  }
  prisma = global.__prisma;
}

export default prisma;
