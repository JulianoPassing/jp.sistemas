const mysql = require('mysql2/promise');
const { getDatabaseConfig } = require('./database-config');

const dbConfig = getDatabaseConfig();
const pool = mysql.createPool({
  host: dbConfig.host,
  user: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.database || 'jpsistemas',
  port: dbConfig.port || 3306,
  charset: dbConfig.charset || 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool; 