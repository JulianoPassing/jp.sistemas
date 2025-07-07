const fs = require('fs');
const path = require('path');

function setupEnvVPS() {
  try {
    console.log('=== CONFIGURANDO VARIÁVEIS DE AMBIENTE NO VPS ===');
    
    const envPath = path.join(__dirname, '..', '.env');
    const envExamplePath = path.join(__dirname, '..', 'env.example');
    
    // Verificar se .env já existe
    if (fs.existsSync(envPath)) {
      console.log('Arquivo .env já existe. Verificando configurações...');
      const envContent = fs.readFileSync(envPath, 'utf8');
      
      // Verificar se as configurações básicas estão presentes
      if (envContent.includes('DB_HOST') && envContent.includes('DB_USER') && envContent.includes('DB_PASSWORD')) {
        console.log('✅ Configurações de banco de dados já estão presentes no .env');
        return;
      }
    }
    
    // Ler o arquivo de exemplo
    if (!fs.existsSync(envExamplePath)) {
      console.error('❌ Arquivo env.example não encontrado');
      return;
    }
    
    const envExample = fs.readFileSync(envExamplePath, 'utf8');
    
    // Configurações específicas para VPS
    const vpsConfig = envExample
      .replace(/DATABASE_PROVIDER=local/, 'DATABASE_PROVIDER=local')
      .replace(/DB_HOST=localhost/, 'DB_HOST=localhost')
      .replace(/DB_USER=jpsistemas/, 'DB_USER=jpcobrancas')
      .replace(/DB_PASSWORD=SuaSenhaForte123!/, 'DB_PASSWORD=Juliano@95')
      .replace(/DB_PORT=3306/, 'DB_PORT=3306')
      .replace(/NODE_ENV=production/, 'NODE_ENV=production')
      .replace(/PORT=3000/, 'PORT=3000')
      .replace(/JWT_SECRET=SeuJWTSecretMuitoForte123!/, 'JWT_SECRET=JPSistemasJWTSecret2024!')
      .replace(/SESSION_SECRET=SeuSessionSecretMuitoForte123!/, 'SESSION_SECRET=JPSistemasSessionSecret2024!');
    
    // Escrever o arquivo .env
    fs.writeFileSync(envPath, vpsConfig);
    
    console.log('✅ Arquivo .env criado com configurações do VPS');
    console.log('📝 Configurações aplicadas:');
    console.log('   - DATABASE_PROVIDER: local');
    console.log('   - DB_HOST: localhost');
    console.log('   - DB_USER: jpcobrancas');
    console.log('   - DB_PASSWORD: Juliano@95');
    console.log('   - DB_PORT: 3306');
    console.log('   - NODE_ENV: production');
    console.log('   - PORT: 3000');
    
    // Verificar se o MySQL está rodando e acessível
    console.log('\n🔍 Verificando conexão com MySQL...');
    const mysql = require('mysql2/promise');
    
    mysql.createConnection({
      host: 'localhost',
      user: 'jpcobrancas',
      password: 'Juliano@95',
      port: 3306
    }).then(connection => {
      console.log('✅ Conexão com MySQL estabelecida com sucesso!');
      connection.end();
    }).catch(error => {
      console.error('❌ Erro ao conectar com MySQL:', error.message);
      console.log('\n💡 Possíveis soluções:');
      console.log('   1. Verificar se o MySQL está rodando: sudo systemctl status mysql');
      console.log('   2. Verificar se o usuário jpcobrancas existe');
      console.log('   3. Verificar se a senha está correta');
      console.log('   4. Verificar se o usuário tem permissões adequadas');
    });
    
  } catch (error) {
    console.error('❌ Erro ao configurar .env:', error);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  setupEnvVPS();
}

module.exports = { setupEnvVPS }; 