// Standalone Supabase/Postgres connection tester.
// Usage:
//   DATABASE_URL="postgres://user:pass@host:6543/postgres?pgbouncer=true" node test-db-connection.js
// or pass the URL as the first CLI arg:
//   node test-db-connection.js "postgres://user:pass@host:6543/postgres?pgbouncer=true"

const { Client } = require('pg');

const url = process.argv[2] || process.env.DATABASE_URL;

if (!url) {
  console.error('No connection string given. Pass it as an arg or set DATABASE_URL.');
  process.exit(1);
}

// mirror the SSL logic in src/config/data-source.ts
const ssl =
  url.includes('supabase.co') || url.includes('sslmode=require')
    ? { rejectUnauthorized: false }
    : false;

let redacted;
try {
  const u = new URL(url);
  redacted = `${u.protocol}//${u.username}:***@${u.host}${u.pathname}${u.search}`;
} catch {
  redacted = '(unparseable URL)';
}

console.log('Connecting to:', redacted);
console.log('SSL:', ssl ? 'on (rejectUnauthorized: false)' : 'off');

const client = new Client({ connectionString: url, ssl });

(async () => {
  const start = Date.now();
  try {
    await client.connect();
    const res = await client.query('select now() as now, current_user as user');
    console.log('CONNECTED in', Date.now() - start, 'ms');
    console.log('Server time:', res.rows[0].now);
    console.log('Connected as:', res.rows[0].user);
    process.exit(0);
  } catch (err) {
    console.error('FAILED after', Date.now() - start, 'ms');
    console.error(err.message);
    if (err.code) console.error('code:', err.code);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
})();
