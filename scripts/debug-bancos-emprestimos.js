const mysql = require('mysql2/promise');

// Configuração do banco de dados
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'jpsistemas',
  password: process.env.DB_PASSWORD || 'Juliano@95',
  charset: 'utf8mb4'
};

async function debugBancosEmprestimos() {
  let connection;
  
  try {
    console.log('🔍 DEBUGGING - Verificando bancos de dados...');
    console.log('📋 Configuração do banco:', {
      host: dbConfig.host,
      user: dbConfig.user,
      password: '***'
    });
    
    // Conectar ao MySQL
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conexão estabelecida com sucesso');
    
    // 1. Listar TODOS os bancos
    console.log('\n📊 TODOS OS BANCOS DISPONÍVEIS:');
    const [allDatabases] = await connection.execute('SHOW DATABASES');
    allDatabases.forEach((db, index) => {
      const dbName = Object.values(db)[0];
      console.log(`  ${index + 1}. ${dbName}`);
    });
    
    // 2. Procurar bancos de cobranças com diferentes padrões
    console.log('\n🔎 PROCURANDO BANCOS DE COBRANÇAS:');
    
    const patterns = [
      'jpcobrancas_%',
      'jp_cobrancas_%', 
      '%cobrancas%',
      'jp.sistemas%',
      'jpsistemas%'
    ];
    
    for (const pattern of patterns) {
      console.log(`\n  🔍 Padrão: ${pattern}`);
      const [databases] = await connection.execute(`SHOW DATABASES LIKE ?`, [pattern]);
      
      if (databases.length > 0) {
        databases.forEach(db => {
          const dbName = Object.values(db)[0];
          console.log(`    ✅ Encontrado: ${dbName}`);
        });
      } else {
        console.log(`    ❌ Nenhum banco encontrado com padrão ${pattern}`);
      }
    }
    
    // 3. Verificar bancos que têm tabela emprestimos
    console.log('\n💾 VERIFICANDO BANCOS COM TABELA EMPRESTIMOS:');
    
    for (const db of allDatabases) {
      const dbName = Object.values(db)[0];
      
      // Pular bancos do sistema
      if (['information_schema', 'mysql', 'performance_schema', 'sys'].includes(dbName)) {
        continue;
      }
      
      try {
        await connection.execute(`USE \`${dbName}\``);
        
        // Verificar se tem tabela emprestimos
        const [tables] = await connection.execute(`
          SELECT TABLE_NAME 
          FROM INFORMATION_SCHEMA.TABLES 
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'emprestimos'
        `, [dbName]);
        
        if (tables.length > 0) {
          // Contar empréstimos
          const [count] = await connection.execute('SELECT COUNT(*) as total FROM emprestimos');
          const total = count[0].total;
          
          console.log(`  📦 ${dbName}: ${total} empréstimos`);
          
          if (total > 0) {
            // Mostrar alguns exemplos
            const [samples] = await connection.execute(`
              SELECT id, data_emprestimo, data_vencimento, created_at
              FROM emprestimos 
              LIMIT 3
            `);
            
            console.log(`    📋 Exemplos:`);
            samples.forEach(emp => {
              console.log(`      ID ${emp.id}: emp=${emp.data_emprestimo} | venc=${emp.data_vencimento} | criado=${emp.created_at ? emp.created_at.toISOString().split('T')[0] : 'N/A'}`);
            });
            
            // Verificar quantos têm problema
            const [problemas] = await connection.execute(`
              SELECT COUNT(*) as total 
              FROM emprestimos 
              WHERE data_emprestimo = data_vencimento
            `);
            
            console.log(`    ⚠️  ${problemas[0].total} empréstimos com datas iguais`);
          }
        }
        
      } catch (error) {
        // Erro ao acessar banco - não é problema
      }
    }
    
    // 4. Verificar banco principal jp.sistemas
    console.log('\n🎯 VERIFICANDO BANCO PRINCIPAL:');
    try {
      await connection.execute('USE `jp.sistemas`');
      console.log('  ✅ Banco jp.sistemas acessível');
      
      // Verificar se tem tabela emprestimos
      const [tables] = await connection.execute(`
        SELECT TABLE_NAME 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = 'jp.sistemas' AND TABLE_NAME = 'emprestimos'
      `);
      
      if (tables.length > 0) {
        const [count] = await connection.execute('SELECT COUNT(*) as total FROM emprestimos');
        console.log(`  📊 jp.sistemas tem ${count[0].total} empréstimos`);
      } else {
        console.log('  ❌ jp.sistemas não tem tabela emprestimos');
      }
      
    } catch (error) {
      console.log('  ❌ Erro ao acessar jp.sistemas:', error.message);
    }
    
  } catch (error) {
    console.error('💥 Erro geral:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Executar
debugBancosEmprestimos()
  .then(() => {
    console.log('\n✨ Debug finalizado!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Erro fatal:', error);
    process.exit(1);
  }); 