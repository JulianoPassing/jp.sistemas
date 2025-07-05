const mysql = require('mysql2/promise');
require('dotenv').config();

async function createSessionsDatabase() {
  try {
    // Conectar como root para criar o banco
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD
    });

    // Criar banco de dados de sessões
    await connection.execute(`
      CREATE DATABASE IF NOT EXISTS \`jpsistemas_sessions\` 
      CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    console.log('Banco de dados jpsistemas_sessions criado com sucesso!');
    
    await connection.end();
  } catch (error) {
    console.error('Erro ao criar banco de sessões:', error);
  }
}

createSessionsDatabase(); 