/**
 * Cria usuário de login do JP Auto Peças RG.
 * Uso: node scripts/create-autopecasrg-user.js <usuario> <senha>
 */
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { ensureDatabase, getPool } = require('../lib/autopecasrg-db');

async function main() {
  const username = process.argv[2];
  const password = process.argv[3];
  if (!username || !password) {
    console.log('Uso: node scripts/create-autopecasrg-user.js <usuario> <senha>');
    process.exit(1);
  }
  await ensureDatabase();
  const pool = getPool();
  const hash = await bcrypt.hash(password, 10);
  try {
    await pool.execute('INSERT INTO usuarios (username, password_hash) VALUES (?, ?)', [String(username).trim(), hash]);
    console.log('Usuário criado. Acesse /jp.autopecasrg/login.html');
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      console.error('Já existe usuário com esse nome.');
    } else {
      console.error(e);
    }
    process.exit(1);
  }
}

main();
