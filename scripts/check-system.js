/**
 * Script para Verificar Status do Sistema J.P Sistemas
 * Diagnóstico de problemas e verificação de integridade
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

// Função para conectar ao banco de usuários
async function getUsersConnection() {
  return await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'jpsistemas',
    password: process.env.DB_PASSWORD || 'SuaSenhaForte123!',
    database: 'jpsistemas_users',
    charset: 'utf8mb4'
  });
}

// Função para verificar configurações do ambiente
function checkEnvironment() {
  console.log('🔧 Verificando configurações do ambiente...');
  console.log('');
  
  const requiredVars = [
    'DB_HOST',
    'DB_USER', 
    'DB_PASSWORD',
    'JWT_SECRET'
  ];
  
  const missingVars = [];
  
  requiredVars.forEach(varName => {
    const value = process.env[varName];
    if (!value) {
      missingVars.push(varName);
      console.log(`❌ ${varName}: Não definido`);
    } else {
      const displayValue = varName.includes('PASSWORD') || varName.includes('SECRET') 
        ? '*'.repeat(Math.min(value.length, 8)) 
        : value;
      console.log(`✅ ${varName}: ${displayValue}`);
    }
  });
  
  console.log('');
  
  if (missingVars.length > 0) {
    console.log('⚠️  Variáveis de ambiente ausentes:');
    missingVars.forEach(varName => {
      console.log(`   - ${varName}`);
    });
    console.log('');
    console.log('📝 Crie um arquivo .env na raiz do projeto com essas variáveis.');
    return false;
  }
  
  console.log('✅ Todas as variáveis de ambiente estão configuradas');
  return true;
}

// Função para verificar conexão com MariaDB
async function checkDatabaseConnection() {
  console.log('🗄️  Verificando conexão com MariaDB...');
  console.log('');
  
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'jpsistemas',
      password: process.env.DB_PASSWORD || 'SuaSenhaForte123!',
      charset: 'utf8mb4'
    });
    
    console.log('✅ Conexão com MariaDB estabelecida com sucesso');
    
    // Verificar versão do MariaDB
    const [versionResult] = await connection.execute('SELECT VERSION() as version');
    console.log(`📊 Versão do MariaDB: ${versionResult[0].version}`);
    
    await connection.end();
    return true;
  } catch (error) {
    console.error('❌ Erro ao conectar com MariaDB:', error.message);
    console.log('');
    console.log('🔧 Possíveis soluções:');
    console.log('   1. Verifique se o MariaDB está rodando');
    console.log('   2. Verifique as credenciais no arquivo .env');
    console.log('   3. Verifique se o usuário tem permissões adequadas');
    return false;
  }
}

// Função para verificar bancos principais
async function checkMainDatabases() {
  console.log('🏗️  Verificando bancos principais...');
  console.log('');
  
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'jpsistemas',
      password: process.env.DB_PASSWORD || 'SuaSenhaForte123!',
      charset: 'utf8mb4'
    });
    
    const requiredDatabases = [
      'jpsistemas_users',
      'jpsistemas_sessions'
    ];
    
    const [databases] = await connection.execute("SHOW DATABASES LIKE 'jpsistemas_%'");
    const existingDatabases = databases.map(db => db.Database);
    
    let allExist = true;
    
    requiredDatabases.forEach(dbName => {
      if (existingDatabases.includes(dbName)) {
        console.log(`✅ ${dbName}: Existe`);
      } else {
        console.log(`❌ ${dbName}: Não existe`);
        allExist = false;
      }
    });
    
    // Verificar bancos de usuários
    const userDatabases = existingDatabases.filter(db => 
      db.startsWith('jpsistemas_') && 
      !requiredDatabases.includes(db)
    );
    
    console.log(`📊 Bancos de usuários encontrados: ${userDatabases.length}`);
    if (userDatabases.length > 0) {
      userDatabases.slice(0, 5).forEach(db => {
        console.log(`   - ${db}`);
      });
      if (userDatabases.length > 5) {
        console.log(`   ... e mais ${userDatabases.length - 5} bancos`);
      }
    }
    
    await connection.end();
    
    if (!allExist) {
      console.log('');
      console.log('🔧 Execute o script de inicialização:');
      console.log('   node scripts/init-db.js');
    }
    
    return allExist;
  } catch (error) {
    console.error('❌ Erro ao verificar bancos:', error.message);
    return false;
  }
}

// Função para verificar tabelas do banco de usuários
async function checkUsersTable() {
  console.log('👥 Verificando tabela de usuários...');
  console.log('');
  
  try {
    const connection = await getUsersConnection();
    
    // Verificar se a tabela existe
    const [tables] = await connection.execute("SHOW TABLES LIKE 'users'");
    
    if (tables.length === 0) {
      console.log('❌ Tabela "users" não existe');
      await connection.end();
      return false;
    }
    
    console.log('✅ Tabela "users" existe');
    
    // Verificar estrutura da tabela
    const [columns] = await connection.execute("DESCRIBE users");
    const requiredColumns = ['id', 'username', 'email', 'password', 'is_active', 'is_admin'];
    
    const existingColumns = columns.map(col => col.Field);
    let allColumnsExist = true;
    
    requiredColumns.forEach(colName => {
      if (existingColumns.includes(colName)) {
        console.log(`   ✅ ${colName}`);
      } else {
        console.log(`   ❌ ${colName}`);
        allColumnsExist = false;
      }
    });
    
    // Verificar se há usuários
    const [users] = await connection.execute('SELECT COUNT(*) as count FROM users');
    const userCount = users[0].count;
    
    console.log(`📊 Total de usuários: ${userCount}`);
    
    if (userCount === 0) {
      console.log('⚠️  Nenhum usuário cadastrado');
      console.log('🔧 Execute: node scripts/init-db.js');
    } else {
      // Listar usuários
      const [userList] = await connection.execute(`
        SELECT username, email, is_admin, is_active, created_at 
        FROM users 
        ORDER BY created_at DESC
      `);
      
      console.log('👤 Usuários cadastrados:');
      userList.forEach(user => {
        const status = user.is_active ? '✅ Ativo' : '❌ Inativo';
        const admin = user.is_admin ? '👑 Admin' : '👤 Usuário';
        console.log(`   - ${user.username} (${user.email}) - ${status} | ${admin}`);
      });
    }
    
    await connection.end();
    return allColumnsExist;
  } catch (error) {
    console.error('❌ Erro ao verificar tabela de usuários:', error.message);
    return false;
  }
}

// Função para verificar banco de um usuário específico
async function checkUserDatabase(username) {
  console.log(`🔍 Verificando banco do usuário: ${username}`);
  console.log('');
  
  try {
    const dbName = `jpsistemas_${username.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'jpsistemas',
      password: process.env.DB_PASSWORD || 'SuaSenhaForte123!',
      database: dbName,
      charset: 'utf8mb4'
    });
    
    // Verificar tabelas necessárias
    const requiredTables = ['clientes', 'produtos', 'pedidos', 'pedido_itens'];
    const [tables] = await connection.execute('SHOW TABLES');
    const existingTables = tables.map(table => Object.values(table)[0]);
    
    let allTablesExist = true;
    
    requiredTables.forEach(tableName => {
      if (existingTables.includes(tableName)) {
        console.log(`✅ ${tableName}`);
      } else {
        console.log(`❌ ${tableName}`);
        allTablesExist = false;
      }
    });
    
    // Verificar dados nas tabelas
    if (allTablesExist) {
      console.log('');
      console.log('📊 Estatísticas do banco:');
      
      const [clientesCount] = await connection.execute('SELECT COUNT(*) as count FROM clientes');
      const [produtosCount] = await connection.execute('SELECT COUNT(*) as count FROM produtos');
      const [pedidosCount] = await connection.execute('SELECT COUNT(*) as count FROM pedidos');
      
      console.log(`   - Clientes: ${clientesCount[0].count}`);
      console.log(`   - Produtos: ${produtosCount[0].count}`);
      console.log(`   - Pedidos: ${pedidosCount[0].count}`);
    }
    
    await connection.end();
    return allTablesExist;
  } catch (error) {
    console.error(`❌ Erro ao verificar banco do usuário ${username}:`, error.message);
    return false;
  }
}

// Função principal
async function main() {
  console.log('🔍 Diagnóstico do Sistema J.P Sistemas');
  console.log('=====================================');
  console.log('');
  
  const args = process.argv.slice(2);
  const username = args[0];
  
  // 1. Verificar ambiente
  const envOk = checkEnvironment();
  console.log('');
  
  if (!envOk) {
    console.log('❌ Configuração de ambiente incompleta');
    process.exit(1);
  }
  
  // 2. Verificar conexão com banco
  const dbOk = await checkDatabaseConnection();
  console.log('');
  
  if (!dbOk) {
    console.log('❌ Problema de conexão com banco de dados');
    process.exit(1);
  }
  
  // 3. Verificar bancos principais
  const mainDbsOk = await checkMainDatabases();
  console.log('');
  
  // 4. Verificar tabela de usuários
  const usersTableOk = await checkUsersTable();
  console.log('');
  
  // 5. Se especificado, verificar banco de usuário específico
  if (username) {
    await checkUserDatabase(username);
    console.log('');
  }
  
  // Resumo
  console.log('📋 Resumo do Diagnóstico:');
  console.log(`   Ambiente: ${envOk ? '✅ OK' : '❌ Problema'}`);
  console.log(`   Conexão DB: ${dbOk ? '✅ OK' : '❌ Problema'}`);
  console.log(`   Bancos principais: ${mainDbsOk ? '✅ OK' : '❌ Problema'}`);
  console.log(`   Tabela usuários: ${usersTableOk ? '✅ OK' : '❌ Problema'}`);
  
  if (!mainDbsOk) {
    console.log('');
    console.log('🔧 Ações recomendadas:');
    console.log('   1. Execute: node scripts/init-db.js');
    console.log('   2. Verifique se o usuário do banco tem permissões adequadas');
  }
  
  if (!usersTableOk) {
    console.log('');
    console.log('🔧 Ações recomendadas:');
    console.log('   1. Execute: node scripts/init-db.js');
    console.log('   2. Verifique se a tabela users foi criada corretamente');
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Erro no diagnóstico:', error);
    process.exit(1);
  });
}

module.exports = {
  checkEnvironment,
  checkDatabaseConnection,
  checkMainDatabases,
  checkUsersTable,
  checkUserDatabase
}; 