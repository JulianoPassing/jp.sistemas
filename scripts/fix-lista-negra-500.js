const mysql = require('mysql2/promise');

console.log('🔧 Corrigindo erro 500 da Lista Negra...');

async function fixListaNegraError() {
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
    
    // 1. Verificar e criar clientes se não existir
    const [clientes] = await connection.execute(`
      SELECT COUNT(*) as total FROM clientes_cobrancas
    `);
    
    console.log(`📊 Total de clientes: ${clientes[0].total}`);
    
    if (clientes[0].total === 0) {
      console.log('⚠️  Não há clientes cadastrados. Criando clientes de exemplo...');
      
      // Criar clientes de exemplo baseados nos empréstimos
      const [emprestimos] = await connection.execute(`
        SELECT DISTINCT cliente_id FROM emprestimos WHERE cliente_id IS NOT NULL
      `);
      
      for (const emp of emprestimos) {
        try {
          await connection.execute(`
            INSERT INTO clientes_cobrancas (
              id, nome, status, created_at, updated_at
            ) VALUES (?, ?, 'Ativo', NOW(), NOW())
          `, [emp.cliente_id, `Cliente ${emp.cliente_id}`]);
          
          console.log(`✅ Cliente ${emp.cliente_id} criado`);
        } catch (error) {
          if (error.code !== 'ER_DUP_ENTRY') {
            console.log(`❌ Erro ao criar cliente ${emp.cliente_id}:`, error.message);
          }
        }
      }
    }
    
    // 2. Verificar estrutura da tabela e adicionar colunas se necessário
    const [columns] = await connection.execute('DESCRIBE clientes_cobrancas');
    const columnNames = columns.map(col => col.Field);
    
    console.log('\n🔍 Verificando estrutura da tabela...');
    
    // Verificar se tem coluna observacoes
    if (!columnNames.includes('observacoes')) {
      console.log('➕ Adicionando coluna observacoes...');
      await connection.execute(`
        ALTER TABLE clientes_cobrancas 
        ADD COLUMN observacoes TEXT NULL
      `);
      console.log('✅ Coluna observacoes adicionada');
    }
    
    // Verificar se tem coluna updated_at
    if (!columnNames.includes('updated_at')) {
      console.log('➕ Adicionando coluna updated_at...');
      await connection.execute(`
        ALTER TABLE clientes_cobrancas 
        ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      `);
      console.log('✅ Coluna updated_at adicionada');
    }
    
    // 3. Testar operação de lista negra
    const [clientesTeste] = await connection.execute(`
      SELECT id, nome, status FROM clientes_cobrancas LIMIT 1
    `);
    
    if (clientesTeste.length > 0) {
      const cliente = clientesTeste[0];
      console.log(`\n🧪 Testando operação de lista negra com cliente ${cliente.id}...`);
      
      // Testar query de verificação
      const [verificacao] = await connection.execute(`
        SELECT id, nome, status FROM clientes_cobrancas WHERE id = ?
      `, [cliente.id]);
      
      if (verificacao.length === 0) {
        console.log('❌ Erro: Cliente não encontrado na verificação');
      } else {
        console.log('✅ Verificação funcionou');
        
        // Testar query de atualização (sem alterar)
        try {
          await connection.execute(`
            UPDATE clientes_cobrancas 
            SET 
              status = ?,
              observacoes = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, ['Ativo', 'Teste de funcionamento', cliente.id]);
          
          console.log('✅ Query de atualização funcionou');
          
          // Reverter para o status original
          await connection.execute(`
            UPDATE clientes_cobrancas 
            SET status = ?
            WHERE id = ?
          `, [cliente.status, cliente.id]);
          
        } catch (error) {
          console.log('❌ Erro na query de atualização:', error.message);
        }
      }
    }
    
    // 4. Verificar logs detalhados
    console.log('\n📋 Clientes disponíveis para lista negra:');
    const [todosClientes] = await connection.execute(`
      SELECT id, nome, status, observacoes 
      FROM clientes_cobrancas 
      ORDER BY id DESC 
      LIMIT 10
    `);
    
    todosClientes.forEach(cliente => {
      console.log(`  ID ${cliente.id}: ${cliente.nome} (${cliente.status})`);
    });
    
    console.log('\n✅ Correções aplicadas com sucesso!');
    console.log('\n💡 Próximos passos:');
    console.log('   1. Reinicie o servidor: pm2 restart ecosystem.config.js');
    console.log('   2. Teste novamente a lista negra');
    console.log('   3. Se ainda der erro, verifique os logs: pm2 logs');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error('Detalhes:', {
      code: error.code,
      sqlMessage: error.sqlMessage
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

fixListaNegraError().catch(console.error); 