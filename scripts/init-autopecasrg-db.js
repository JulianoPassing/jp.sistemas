/**
 * Cria o banco jpsistemas_autopecasrg e tabelas na VPS.
 * Uso: npm run init-autopecasrg
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { ensureDatabase } = require('../lib/autopecasrg-db');

ensureDatabase()
  .then(() => {
    console.log('OK: banco Auto Peças RG inicializado (jpsistemas_autopecasrg).');
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
