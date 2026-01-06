import prisma from "../lib/prisma.js";
import bcrypt from "bcrypt";

/**
 * GET ALL USERS (MASTER / ADMIN)
 */
export async function getAllUsers(req, res) {
  try {
    const users = await prisma.user.findMany({
      // where: {
      //   isActive: true, // change/remove if you want all users
      // },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return res.json({
      success: true,
      users,
    });
  } catch (err) {
    console.error("[GET USERS ERROR]", err);

    return res.status(500).json({
      success: false,
      error: "Failed to fetch users",
    });
  }
}

/**
 * CREATE USER (MASTER ONLY)
 */
export async function createUser(req, res) {
  try {
    const { email, password, name, role } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        error: "email, password, and name are required",
      });
    }

    const userExists = await prisma.user.findUnique({
      where: { email },
    });

    if (userExists) {
      return res.status(409).json({
        success: false,
        error: "User with this email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: role || "USER",
      },
    });

    return res.status(201).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("[CREATE USER ERROR]", err);

    // Prisma unique constraint violation
    if (err.code === "P2002") {
      return res.status(409).json({
        success: false,
        error: "User with this email already exists",
      });
    }

    return res.status(500).json({
      success: false,
      error: "Failed to create user",
    });
  }
}

/**
 * DELETE USER (MASTER ONLY)
 */
export async function deleteUser(req, res) {
  try {
    const { userId } = req.params;

    await prisma.user.delete({
      where: { id: userId },
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("[DELETE USER ERROR]", err);

    return res.status(404).json({
      success: false,
      error: "User not found",
    });
  }
}

/**
 * DEACTIVATE USER (SAFER THAN DELETE)
 */
export async function deactivateUser(req, res) {
  try {
    const { userId } = req.params;

    await prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("[DEACTIVATE USER ERROR]", err);

    return res.status(404).json({
      success: false,
      error: "User not found",
    });
  }
}
