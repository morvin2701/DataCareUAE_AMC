import 'dotenv/config';

const num = (v, d) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; };

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: num(process.env.PORT, 4100),
  corsOrigins: (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter((s) => s && s !== '*'),
  baseUrl: (process.env.APP_BASE_URL || '').replace(/\/$/, ''),

  /** The one database. */
  db: {
    server: process.env.AMC_DB_SERVER || '127.0.0.1',
    port: num(process.env.AMC_DB_PORT, 1433),
    database: process.env.AMC_DB_NAME || 'DcAmc',
    user: process.env.AMC_DB_USER || 'sa',
    password: process.env.AMC_DB_PASSWORD || '',
    auth: (process.env.AMC_DB_AUTH || 'sql').toLowerCase(),   // sql | ntlm
    domain: process.env.AMC_DB_DOMAIN || '',
  },
  encryptionKey: process.env.AMC_ENCRYPTION_KEY || '',
  sessionSecret: process.env.SESSION_SECRET || '',

  /** The first owner login, made once when AMC_USER is empty. */
  owner: { login: (process.env.OWNER_LOGIN || 'msv').trim(), name: process.env.OWNER_NAME || 'Owner', password: process.env.OWNER_PASSWORD || '' },
  backupPath: process.env.BACKUP_PATH || 'C:\\AmcBkps',
};

/** Warn loudly about missing secrets; refuse to start in production. */
export function assertEnv() {
  const problems = [];
  if (!env.sessionSecret) problems.push('SESSION_SECRET is not set');
  if (!env.encryptionKey) problems.push('AMC_ENCRYPTION_KEY is not set');
  if (env.isProd && env.corsOrigins.length === 0) problems.push('CORS_ORIGIN must list the site origin in production');
  if (problems.length) {
    const msg = `[env] ${problems.join('; ')}`;
    if (env.isProd) throw new Error(msg);
    console.warn(msg + ' — using insecure development defaults');
    if (!env.sessionSecret) env.sessionSecret = 'dev-only-session-secret';
    if (!env.encryptionKey) env.encryptionKey = Buffer.alloc(32, 7).toString('base64');
  }
}
