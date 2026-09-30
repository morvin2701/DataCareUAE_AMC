import { env, assertEnv } from './config/env.js';
import { createApp } from './app.js';
import { dbStatus } from './config/db.js';
import { bootstrap } from './services/schemaService.js';
import { seedOwner } from './services/authService.js';
import { startReminderScheduler } from './services/reminderService.js';
import { startBackupScheduler } from './services/backupService.js';

assertEnv();
const app = createApp();
const server = app.listen(env.port, async () => {
  console.log(`DcAMC backend listening on :${env.port} (${env.nodeEnv})`);
  try { await bootstrap(); await seedOwner(); const db = await dbStatus(); console.log(db.ok ? `Database connected: ${db.server}/${db.db}` : `Database NOT reachable: ${db.error}`); if (process.env.REMINDER_SCHEDULER !== '0') startReminderScheduler(); if (process.env.BACKUP_SCHEDULER !== '0') startBackupScheduler(); }
  catch (e) { console.error('Database not ready:', e.message, '(routes will retry on demand)'); }
});
server.keepAliveTimeout = 65000;
process.on('unhandledRejection', (e) => console.error('Unhandled rejection:', e));
process.on('uncaughtException', (e) => console.error('Uncaught exception:', e));
