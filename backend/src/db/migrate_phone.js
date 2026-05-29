require('dotenv').config();
const sql = require('./client');
async function run() {
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT`;
  console.log('phone/email migration done');
  await sql.end();
}
run().catch(e => { console.error(e.message); process.exit(1); });
