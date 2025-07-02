/**
 * Script para Gerenciar Usuários no Sistema J.P Sistemas
 * Sistema Multi-Tenancy com MariaDB
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

// Função para listar todos os usuários
async function listUsers() {
  try {
    const connection = await getUsersConnection();
    
    const [users] = await connection.execute(`
      SELECT 
        id,
        username,
        email,
        is_admin,
        is_active,
        created_at,
        updated_at
      FROM users 
      ORDER BY created_at DESC
    `);
    
    await connection.end();
    
    console.log('📋 Lista de Usuários do Sistema:');
    console.log('');
    
    if (users.length === 0) {
      console.log('❌ Nenhum usuário encontrado');
      return;
    }
    
    users.forEach((user, index) => {
      const status = user.is_active ? '✅ Ativo' : '❌ Inativo';
      const admin = user.is_admin ? '👑 Admin' : '👤 Usuário';
      const created = new Date(user.created_at).toLocaleDateString('pt-BR');
      
      console.log(`${index + 1}. ${user.username} (${user.email})`);
      console.log(`   Status: ${status} | Tipo: ${admin}`);
      console.log(`   Criado em: ${created}`);
      console.log(`   Banco: jpsistemas_${user.username.toLowerCase().replace(/[^a-z0-9]/g, '_')}`);
      console.log('');
    });
    
    console.log(`📊 Total: ${users.length} usuário(s)`);
    
  } catch (error) {
    console.error('❌ Erro ao listar usuários:', error.message);
  }
}

// Função para verificar se um usuário existe
async function checkUser(username) {
  try {
    const connection = await getUsersConnection();
    
    const [users] = await connection.execute(
      'SELECT username, email, is_admin, is_active FROM users WHERE username = ?',
      [username]
    );
    
    await connection.end();
    
    if (users.length === 0) {
      console.log(`❌ Usuário '${username}' não encontrado`);
      return null;
    }
    
    const user = users[0];
    console.log(`✅ Usuário '${username}' encontrado:`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Tipo: ${user.is_admin ? 'Administrador' : 'Usuário comum'}`);
    console.log(`   Status: ${user.is_active ? 'Ativo' : 'Inativo'}`);
    
    return user;
  } catch (error) {
    console.error('❌ Erro ao verificar usuário:', error.message);
    return null;
  }
}

// Função para ativar/desativar usuário
async function toggleUserStatus(username, activate = true) {
  try {
    const connection = await getUsersConnection();
    
    const [result] = await connection.execute(
      'UPDATE users SET is_active = ? WHERE username = ?',
      [activate, username]
    );
    
    await connection.end();
    
    if (result.affectedRows === 0) {
      console.log(`❌ Usuário '${username}' não encontrado`);
      return false;
    }
    
    const action = activate ? 'ativado' : 'desativado';
    console.log(`✅ Usuário '${username}' ${action} com sucesso`);
    return true;
    
  } catch (error) {
    console.error('❌ Erro ao alterar status do usuário:', error.message);
    return false;
  }
}

// Função para alterar senha do usuário
async function changePassword(username, newPassword) {
  try {
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    const connection = await getUsersConnection();
    
    const [result] = await connection.execute(
      'UPDATE users SET password = ? WHERE username = ?',
      [hashedPassword, username]
    );
    
    await connection.end();
    
    if (result.affectedRows === 0) {
      console.log(`❌ Usuário '${username}' não encontrado`);
      return false;
    }
    
    console.log(`✅ Senha do usuário '${username}' alterada com sucesso`);
    return true;
    
  } catch (error) {
    console.error('❌ Erro ao alterar senha:', error.message);
    return false;
  }
}

// Função para tornar usuário administrador
async function makeAdmin(username, isAdmin = true) {
  try {
    const connection = await getUsersConnection();
    
    const [result] = await connection.execute(
      'UPDATE users SET is_admin = ? WHERE username = ?',
      [isAdmin, username]
    );
    
    await connection.end();
    
    if (result.affectedRows === 0) {
      console.log(`❌ Usuário '${username}' não encontrado`);
      return false;
    }
    
    const action = isAdmin ? 'promovido a administrador' : 'removido como administrador';
    console.log(`✅ Usuário '${username}' ${action} com sucesso`);
    return true;
    
  } catch (error) {
    console.error('❌ Erro ao alterar privilégios:', error.message);
    return false;
  }
}

// Função para verificar bancos de dados dos usuários
async function checkUserDatabases() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'jpsistemas',
      password: process.env.DB_PASSWORD || 'SuaSenhaForte123!',
      charset: 'utf8mb4'
    });
    
    const [databases] = await connection.execute("SHOW DATABASES LIKE 'jpsistemas_%'");
    await connection.end();
    
    console.log('🗄️  Bancos de Dados dos Usuários:');
    console.log('');
    
    if (databases.length === 0) {
      console.log('❌ Nenhum banco de usuário encontrado');
      return;
    }
    
    databases.forEach((db, index) => {
      const dbName = db.Database;
      const username = dbName.replace('jpsistemas_', '');
      console.log(`${index + 1}. ${dbName} (usuário: ${username})`);
    });
    
    console.log('');
    console.log(`📊 Total: ${databases.length} banco(s) de usuário(s)`);
    
  } catch (error) {
    console.error('❌ Erro ao verificar bancos:', error.message);
  }
}

// Função para mostrar estatísticas
async function showStats() {
  try {
    const connection = await getUsersConnection();
    
    const [stats] = await connection.execute(`
      SELECT 
        COUNT(*) as total_users,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_users,
        SUM(CASE WHEN is_admin = 1 THEN 1 ELSE 0 END) as admin_users,
        MIN(created_at) as first_user,
        MAX(created_at) as last_user
      FROM users
    `);
    
    await connection.end();
    
    const stat = stats[0];
    console.log('📊 Estatísticas do Sistema:');
    console.log('');
    console.log(`👥 Total de usuários: ${stat.total_users}`);
    console.log(`✅ Usuários ativos: ${stat.active_users}`);
    console.log(`❌ Usuários inativos: ${stat.total_users - stat.active_users}`);
    console.log(`👑 Administradores: ${stat.admin_users}`);
    console.log(`👤 Usuários comuns: ${stat.total_users - stat.admin_users}`);
    
    if (stat.first_user) {
      console.log(`📅 Primeiro usuário criado: ${new Date(stat.first_user).toLocaleDateString('pt-BR')}`);
      console.log(`📅 Último usuário criado: ${new Date(stat.last_user).toLocaleDateString('pt-BR')}`);
    }
    
  } catch (error) {
    console.error('❌ Erro ao obter estatísticas:', error.message);
  }
}

// Função principal
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (!command) {
    console.log('📋 Gerenciador de Usuários - J.P Sistemas');
    console.log('');
    console.log('📝 Comandos disponíveis:');
    console.log('   list                    - Listar todos os usuários');
    console.log('   check <username>        - Verificar usuário específico');
    console.log('   activate <username>     - Ativar usuário');
    console.log('   deactivate <username>   - Desativar usuário');
    console.log('   password <username> <new_password> - Alterar senha');
    console.log('   make-admin <username>   - Tornar usuário administrador');
    console.log('   remove-admin <username> - Remover privilégios de admin');
    console.log('   databases               - Listar bancos de usuários');
    console.log('   stats                   - Mostrar estatísticas');
    console.log('');
    console.log('📝 Exemplos:');
    console.log('   node scripts/manage-users.js list');
    console.log('   node scripts/manage-users.js check joao_silva');
    console.log('   node scripts/manage-users.js activate maria');
    console.log('   node scripts/manage-users.js password joao NovaSenha123');
    console.log('   node scripts/manage-users.js make-admin gerente');
    console.log('   node scripts/manage-users.js stats');
    process.exit(1);
  }
  
  try {
    switch (command) {
      case 'list':
        await listUsers();
        break;
        
      case 'check':
        if (!args[1]) {
          console.error('❌ Username é obrigatório');
          process.exit(1);
        }
        await checkUser(args[1]);
        break;
        
      case 'activate':
        if (!args[1]) {
          console.error('❌ Username é obrigatório');
          process.exit(1);
        }
        await toggleUserStatus(args[1], true);
        break;
        
      case 'deactivate':
        if (!args[1]) {
          console.error('❌ Username é obrigatório');
          process.exit(1);
        }
        await toggleUserStatus(args[1], false);
        break;
        
      case 'password':
        if (!args[1] || !args[2]) {
          console.error('❌ Username e nova senha são obrigatórios');
          process.exit(1);
        }
        await changePassword(args[1], args[2]);
        break;
        
      case 'make-admin':
        if (!args[1]) {
          console.error('❌ Username é obrigatório');
          process.exit(1);
        }
        await makeAdmin(args[1], true);
        break;
        
      case 'remove-admin':
        if (!args[1]) {
          console.error('❌ Username é obrigatório');
          process.exit(1);
        }
        await makeAdmin(args[1], false);
        break;
        
      case 'databases':
        await checkUserDatabases();
        break;
        
      case 'stats':
        await showStats();
        break;
        
      default:
        console.error(`❌ Comando '${command}' não reconhecido`);
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  main();
}

module.exports = {
  listUsers,
  checkUser,
  toggleUserStatus,
  changePassword,
  makeAdmin,
  checkUserDatabases,
  showStats
}; 