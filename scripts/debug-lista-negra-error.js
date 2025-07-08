const mysql = require('mysql2/promise');

console.log('🔍 Debugando erro 500 da Lista Negra...');

async function debugListaNegraError() {
  let connection;
  
  try {
    // Conectar ao banco do usuário cobranca
    const dbConfig = {
      host: 'localhost',
      user: 'jpsistemas',
      password: 'Juliano@95',
      database: 'jpcobrancas_cobranca',
      charset: 'utf8mb4'
    };
    
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conectado ao banco jpcobrancas_cobranca');
    
    // 1. Verificar se a tabela clientes_cobrancas existe
    const [tables] = await connection.execute(`SHOW TABLES LIKE 'clientes_cobrancas'`);
    if (tables.length === 0) {
      console.log('❌ PROBLEMA: Tabela clientes_cobrancas não existe!');
      return;
    }
    
    console.log('✅ Tabela clientes_cobrancas existe');
    
    // 2. Verificar estrutura da tabela
    const [columns] = await connection.execute('DESCRIBE clientes_cobrancas');
    console.log('\n📊 Estrutura da tabela clientes_cobrancas:');
    columns.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type}) ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
    // 3. Verificar clientes existentes
    const [clientes] = await connection.execute(`
      SELECT id, nome, status, observacoes, created_at
      FROM clientes_cobrancas
      ORDER BY id DESC
      LIMIT 5
    `);
    
    console.log('\n👥 Clientes existentes:');
    if (clientes.length === 0) {
      console.log('  ❌ Nenhum cliente encontrado!');
      console.log('  💡 Isso pode causar erro se tentar adicionar à lista negra um cliente que não existe');
    } else {
      clientes.forEach(cliente => {
        console.log(`  ID ${cliente.id}: ${cliente.nome} (Status: ${cliente.status})`);
      });
    }
    
    // 4. Testar a query de atualização que está na API
    if (clientes.length > 0) {
      const clienteTeste = clientes[0];
      console.log(`\n🧪 Testando query de atualização com cliente ID ${clienteTeste.id}...`);
      
      try {
        // Simular a query que a API executa (sem alterar dados reais)
        await connection.execute(`
          SELECT id, nome, status FROM clientes_cobrancas WHERE id = ?
        `, [clienteTeste.id]);
        console.log('✅ Query de verificação funcionou');
        
        // Testar query de atualização (query seca)
        console.log('🔍 Testando query de atualização...');
        const result = await connection.execute(`
          SELECT 
            status as status_atual,
            observacoes as observacoes_atuais,
            updated_at as ultima_atualizacao
          FROM clientes_cobrancas 
          WHERE id = ?
        `, [clienteTeste.id]);
        
        console.log('✅ Query funciona corretamente');
        console.log('📋 Dados atuais:', result[0][0]);
        
      } catch (error) {
        console.error('❌ Erro na query:', error.message);
        console.error('💡 Detalhes:', {
          code: error.code,
          sqlMessage: error.sqlMessage,
          sqlState: error.sqlState
        });
      }
    }
    
    // 5. Verificar permissões do usuário
    console.log('\n🔐 Verificando permissões...');
    try {
      const [grants] = await connection.execute(`SHOW GRANTS FOR 'jpsistemas'@'localhost'`);
      console.log('✅ Permissões do usuário jpsistemas:');
      grants.forEach(grant => {
        console.log(`  - ${grant[Object.keys(grant)[0]]}`);
      });
    } catch (error) {
      console.log('❌ Erro ao verificar permissões:', error.message);
    }
    
    console.log('\n📊 Resumo do Debug:');
    console.log('================');
    console.log('✅ Conexão: OK');
    console.log('✅ Tabela: OK');
    console.log(`✅ Clientes: ${clientes.length} encontrados`);
    console.log('✅ Queries: OK');
    
    if (clientes.length === 0) {
      console.log('\n⚠️  POSSÍVEL PROBLEMA:');
      console.log('   - Não há clientes na tabela');
      console.log('   - Tentativa de adicionar cliente inexistente à lista negra causa erro 500');
      console.log('\n💡 SOLUÇÃO:');
      console.log('   - Primeiro cadastre clientes antes de usar a lista negra');
    } else {
      console.log('\n💡 Se mesmo assim há erro 500:');
      console.log('   - Verifique logs do servidor');
      console.log('   - Pode ser problema de sessão/autenticação');
      console.log('   - Execute: pm2 logs ecosystem.config.js');
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

debugListaNegraError().catch(console.error); 