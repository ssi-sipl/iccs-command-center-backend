export function requireMasterAuth(req, res, next) {
  const { master_username, master_password } = req.body;

  if (
    master_username !== "abhinn_admin_root" ||
    master_password !== "VERY_STRONG_LONG_PASSWORD_123!@"
  ) {
    return res.status(403).json({
      success: false,
      error: "Forbidden",
    });
  }

  next();
}
