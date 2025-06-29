/**
 * Script para inicializar o banco de dados de sessões
 * Execute este script antes de fazer deploy para produção
 */

const mysql = require('mysql2/promise');
const { getSessionConfig } = require('../database-config');
require('dotenv').config();

async function initSessionsDatabase() {
  try {
    console.log('🚀 Inicializando banco de dados de sessões...');
    
    // Obter configuração da sessão
    const sessionConfig = getSessionConfig();
    
    // Conectar sem especificar database para criar o banco
    const connection = await mysql.createConnection({
      host: sessionConfig.host,
      port: sessionConfig.port,
      user: sessionConfig.user,
      password: sessionConfig.password,
      ssl: sessionConfig.ssl
    });

    // Criar banco de dados de sessões
    await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${sessionConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`✅ Banco de dados ${sessionConfig.database} criado/verificado`);

    // Usar o banco de sessões
    await connection.execute(`USE \`${sessionConfig.database}\``);

    // Criar tabela de sessões
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_id VARCHAR(128) NOT NULL PRIMARY KEY,
        expires INT UNSIGNED NOT NULL,
        data TEXT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Tabela sessions criada/verificada');

    // Criar índices para performance
    await connection.execute(`
      CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires)
    `);
    console.log('✅ Índices criados/verificados');

    await connection.end();
    console.log('🎉 Banco de dados de sessões inicializado com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro ao inicializar banco de sessões:', error);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  initSessionsDatabase();
}

module.exports = { initSessionsDatabase }; 