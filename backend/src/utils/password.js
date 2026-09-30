import bcrypt from 'bcryptjs';
export const hashPassword = (plain) => bcrypt.hash(String(plain), 10);
export const verifyPassword = (plain, hash) => bcrypt.compare(String(plain || ''), String(hash || ''));
