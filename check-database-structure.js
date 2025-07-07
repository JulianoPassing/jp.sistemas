const mysql = require('mysql2/promise');

async function checkDatabaseStructure() {
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'jpsistemas',
    password: process.env.DB_PASSWORD || 'SuaSenhaForte123!',
    charset: 'utf8mb4'
  };
  
  try {
    console.log('🔍 Verificando estrutura do banco de dados...\n');
    
    // Conectar ao banco
    const connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conexão estabelecida');
    
    // Listar bancos de dados
    const [databases] = await connection.execute('SHOW DATABASES');
    console.log('\n📋 Bancos de dados encontrados:');
    databases.forEach(db => {
      if (db.Database.startsWith('jpsistemas_')) {
        console.log(`   - ${db.Database}`);
      }
    });
    
    // Verificar um banco específico (substitua pelo nome correto)
    const testDbName = 'jpsistemas_test'; // ou outro nome de banco existente
    
    try {
      await connection.execute(`USE \`${testDbName}\``);
      console.log(`\n📊 Verificando banco: ${testDbName}`);
      
      // Verificar tabelas
      const [tables] = await connection.execute('SHOW TABLES');
      console.log('\n📋 Tabelas encontradas:');
      tables.forEach(table => {
        console.log(`   - ${Object.values(table)[0]}`);
      });
      
      // Verificar estrutura da tabela emprestimos
      if (tables.some(t => Object.values(t)[0] === 'emprestimos')) {
        console.log('\n🏗️ Estrutura da tabela emprestimos:');
        const [columns] = await connection.execute('DESCRIBE emprestimos');
        columns.forEach(col => {
          console.log(`   - ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Default ? `DEFAULT ${col.Default}` : ''}`);
        });
      }
      
      // Verificar estrutura da tabela clientes_cobrancas
      if (tables.some(t => Object.values(t)[0] === 'clientes_cobrancas')) {
        console.log('\n🏗️ Estrutura da tabela clientes_cobrancas:');
        const [columns] = await connection.execute('DESCRIBE clientes_cobrancas');
        columns.forEach(col => {
          console.log(`   - ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Default ? `DEFAULT ${col.Default}` : ''}`);
        });
      }
      
      // Verificar estrutura da tabela cobrancas
      if (tables.some(t => Object.values(t)[0] === 'cobrancas')) {
        console.log('\n🏗️ Estrutura da tabela cobrancas:');
        const [columns] = await connection.execute('DESCRIBE cobrancas');
        columns.forEach(col => {
          console.log(`   - ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Default ? `DEFAULT ${col.Default}` : ''}`);
        });
      }
      
      // Verificar dados de exemplo
      console.log('\n📊 Dados de exemplo:');
      
      const [clientes] = await connection.execute('SELECT COUNT(*) as total FROM clientes_cobrancas');
      console.log(`   - Clientes: ${clientes[0].total}`);
      
      const [emprestimos] = await connection.execute('SELECT COUNT(*) as total FROM emprestimos');
      console.log(`   - Empréstimos: ${emprestimos[0].total}`);
      
      const [cobrancas] = await connection.execute('SELECT COUNT(*) as total FROM cobrancas');
      console.log(`   - Cobranças: ${cobrancas[0].total}`);
      
    } catch (error) {
      console.log(`❌ Erro ao verificar banco ${testDbName}:`, error.message);
    }
    
    await connection.end();
    
  } catch (error) {
    console.error('❌ Erro ao conectar ao banco:', error);
  }
}

checkDatabaseStructure(); 