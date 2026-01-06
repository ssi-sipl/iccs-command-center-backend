export function requireMasterAuth(req, res, next) {
  const { master_username, master_password } = req.body;

  if (
    master_username !== process.env.MASTER_ADMIN_USERNAME ||
    master_password !== process.env.MASTER_ADMIN_PASSWORD
  ) {
    return res.status(403).json({
      success: false,
      error: "Forbidden",
    });
  }

  next();
}
