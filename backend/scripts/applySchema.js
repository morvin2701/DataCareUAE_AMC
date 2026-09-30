/** db:apply — create DcAmc on the server named in .env, apply every script, seed the owner login. */
import { assertEnv, env } from '../src/config/env.js';
import { bootstrap, fieldUpdate } from '../src/services/schemaService.js';
import { seedOwner } from '../src/services/authService.js';
assertEnv();
console.log(`Server ${env.db.server}:${env.db.port} as ${env.db.user} → ${env.db.database}`);
await bootstrap(); const out = await fieldUpdate(); await seedOwner();
console.log(`Applied ${out.applied.length}, already there ${out.skipped}. Done.`);
process.exit(0);
