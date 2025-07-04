const mysql = require('mysql2');
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'Juliano@95',
  database: 'jp_cobrancas'
});
module.exports = pool.promise(); 