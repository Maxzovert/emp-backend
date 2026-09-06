import bcrypt from "bcryptjs";

const ROUNDS = 10;

export async function hashPassword(password) {
  return bcrypt.hash(String(password), ROUNDS);
}

export async function verifyPassword(password, passwordHash) {
  if (!passwordHash) return false;
  return bcrypt.compare(String(password), String(passwordHash));
}
