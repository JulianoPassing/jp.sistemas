/**
 * Script para Atualizar Estrutura da Tabela Pedidos (Versão Corrigida)
 * Adiciona a coluna nome_cliente em bancos existentes
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

// Função para listar todos os bancos de usuários
async function getUserDatabases() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'jpsistemas',
      password: process.env.DB_PASSWORD || 'SuaSenhaForte123!',
      charset: 'utf8mb4'
    });
    
    const [databases] = await connection.execute("SHOW DATABASES LIKE 'jpsistemas_%'");
    await connection.end();
    
    // Filtrar apenas bancos de usuários (excluir bancos principais)
    const mainDatabases = ['jpsistemas_users', 'jpsistemas_sessions', 'jpsistemas_admin'];
    const userDatabases = [];
    
    for (const db of databases) {
      const dbName = db.Database || db['Database (jpsistemas_%)'];
      if (dbName && !mainDatabases.includes(dbName)) {
        userDatabases.push(dbName);
      }
    }
    
    console.log('Bancos de usuários encontrados:', userDatabases);
    return userDatabases;
  } catch (error) {
    console.error('❌ Erro ao listar bancos:', error.message);
    return [];
  }
}

// Função para verificar se a coluna nome_cliente existe
async function checkNomeClienteColumn(dbName) {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'jpsistemas',
      password: process.env.DB_PASSWORD || 'SuaSenhaForte123!',
      database: dbName,
      charset: 'utf8mb4'
    });
    
    const [columns] = await connection.execute("DESCRIBE pedidos");
    await connection.end();
    
    return columns.some(col => col.Field === 'nome_cliente');
  } catch (error) {
    console.error(`❌ Erro ao verificar coluna em ${dbName}:`, error.message);
    return false;
  }
}

// Função para adicionar a coluna nome_cliente
async function addNomeClienteColumn(dbName) {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'jpsistemas',
      password: process.env.DB_PASSWORD || 'SuaSenhaForte123!',
      database: dbName,
      charset: 'utf8mb4'
    });
    
    // Verificar se a tabela pedidos existe
    const [tables] = await connection.execute("SHOW TABLES LIKE 'pedidos'");
    if (tables.length === 0) {
      console.log(`⚠️  Tabela 'pedidos' não existe em ${dbName}`);
      await connection.end();
      return false;
    }
    
    // Adicionar a coluna nome_cliente
    await connection.execute(`
      ALTER TABLE pedidos 
      ADD COLUMN nome_cliente VARCHAR(255) AFTER cliente_id
    `);
    
    await connection.end();
    console.log(`✅ Coluna 'nome_cliente' adicionada em ${dbName}`);
    return true;
  } catch (error) {
    console.error(`❌ Erro ao adicionar coluna em ${dbName}:`, error.message);
    return false;
  }
}

// Função principal
async function main() {
  console.log('🔧 Atualizando Estrutura da Tabela Pedidos (Versão Corrigida)');
  console.log('===========================================================');
  console.log('');
  
  try {
    // Listar bancos de usuários
    console.log('📋 Buscando bancos de usuários...');
    const userDatabases = await getUserDatabases();
    
    if (userDatabases.length === 0) {
      console.log('ℹ️  Nenhum banco de usuário encontrado');
      return;
    }
    
    console.log(`📊 Encontrados ${userDatabases.length} banco(s) de usuário(s)`);
    console.log('');
    
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    // Processar cada banco
    for (const dbName of userDatabases) {
      if (!dbName) {
        console.log('⚠️  Nome de banco inválido, pulando...');
        continue;
      }
      
      console.log(`🔍 Verificando ${dbName}...`);
      
      // Verificar se a coluna já existe
      const hasColumn = await checkNomeClienteColumn(dbName);
      
      if (hasColumn) {
        console.log(`   ✅ Coluna 'nome_cliente' já existe`);
        skippedCount++;
      } else {
        console.log(`   ⚠️  Coluna 'nome_cliente' não encontrada, adicionando...`);
        const success = await addNomeClienteColumn(dbName);
        
        if (success) {
          updatedCount++;
        } else {
          errorCount++;
        }
      }
    }
    
    console.log('');
    console.log('📋 Resumo da Atualização:');
    console.log(`   ✅ Atualizados: ${updatedCount}`);
    console.log(`   ⏭️  Pulados (já existia): ${skippedCount}`);
    console.log(`   ❌ Erros: ${errorCount}`);
    console.log(`   📊 Total processado: ${userDatabases.length}`);
    
    if (updatedCount > 0) {
      console.log('');
      console.log('🎉 Atualização concluída com sucesso!');
      console.log('🔧 A API de pedidos agora deve funcionar corretamente.');
    }
    
  } catch (error) {
    console.error('❌ Erro durante a atualização:', error.message);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  main();
}

module.exports = {
  getUserDatabases,
  checkNomeClienteColumn,
  addNomeClienteColumn
}; 