const mysql = require('mysql2');
require('dotenv').config({ path: __dirname + '/.env' });

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'Juliano@95',
  database: process.env.DB_NAME || 'jp_cobrancas'
});

module.exports = pool.promise(); 