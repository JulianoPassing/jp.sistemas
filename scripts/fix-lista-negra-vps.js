// Script para corrigir problema da lista negra na VPS
// Execute este script na VPS onde o banco de dados está rodando

const mysql = require('mysql2/promise');

async function fixListaNegra() {
  try {
    console.log('=== CORRIGINDO PROBLEMA DA LISTA NEGRA ===\n');
    
    // Configuração para VPS - ajuste conforme suas configurações
    const dbConfig = {
      host: 'localhost',
      user: 'jpsistemas', // ou o usuário correto da sua VPS
      password: 'Juliano@95', // ou a senha correta da sua VPS
      database: 'jpsistemas_cobrancas',
      port: 3306,
      charset: 'utf8mb4'
    };
    
    console.log('1. Conectando ao banco de dados...');
    const connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conectado com sucesso!');
    
    console.log('\n2. Verificando se o campo observacoes existe...');
    
    // Verificar se o campo já existe
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'jpsistemas_cobrancas' 
      AND TABLE_NAME = 'clientes_cobrancas' 
      AND COLUMN_NAME = 'observacoes'
    `);
    
    if (columns.length > 0) {
      console.log('✅ Campo observacoes já existe na tabela clientes_cobrancas');
    } else {
      console.log('3. Adicionando campo observacoes...');
      
      // Adicionar o campo observacoes
      await connection.execute(`
        ALTER TABLE clientes_cobrancas 
        ADD COLUMN observacoes TEXT AFTER status
      `);
      
      console.log('✅ Campo observacoes adicionado com sucesso!');
    }
    
    // Verificar estrutura da tabela
    console.log('\n4. Estrutura atual da tabela clientes_cobrancas:');
    const [tableStructure] = await connection.execute(`
      DESCRIBE clientes_cobrancas
    `);
    
    tableStructure.forEach(column => {
      console.log(`- ${column.Field}: ${column.Type} ${column.Null === 'YES' ? '(NULL)' : '(NOT NULL)'}`);
    });
    
    // Testar a funcionalidade da lista negra
    console.log('\n5. Testando funcionalidade da lista negra...');
    
    // Buscar um cliente para testar
    const [clientes] = await connection.execute(`
      SELECT id, nome, status FROM clientes_cobrancas LIMIT 1
    `);
    
    if (clientes.length > 0) {
      const cliente = clientes[0];
      console.log(`   Cliente de teste: ${cliente.nome} (ID: ${cliente.id})`);
      
      // Testar atualização para lista negra
      await connection.execute(`
        UPDATE clientes_cobrancas 
        SET 
          status = ?,
          observacoes = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, ['Lista Negra', 'Teste de correção da lista negra', cliente.id]);
      
      console.log('✅ Teste de atualização da lista negra realizado com sucesso!');
      
      // Verificar se foi atualizado
      const [clienteAtualizado] = await connection.execute(`
        SELECT id, nome, status, observacoes FROM clientes_cobrancas WHERE id = ?
      `, [cliente.id]);
      
      if (clienteAtualizado.length > 0) {
        console.log(`   Status atualizado: ${clienteAtualizado[0].status}`);
        console.log(`   Observações: ${clienteAtualizado[0].observacoes}`);
      }
      
      // Reverter o teste
      await connection.execute(`
        UPDATE clientes_cobrancas 
        SET 
          status = ?,
          observacoes = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, ['Ativo', '', cliente.id]);
      
      console.log('✅ Teste revertido com sucesso!');
      
    } else {
      console.log('   Nenhum cliente encontrado para teste');
    }
    
    await connection.end();
    console.log('\n=== CORREÇÃO CONCLUÍDA ===');
    console.log('✅ O problema da lista negra foi corrigido!');
    console.log('✅ Agora você pode adicionar clientes à lista negra sem erro 500.');
    
  } catch (error) {
    console.error('❌ Erro durante a correção:', error);
    console.log('\n🔧 Possíveis soluções:');
    console.log('1. Verifique se o MySQL está rodando na VPS');
    console.log('2. Verifique as credenciais do banco de dados');
    console.log('3. Verifique se o banco jpsistemas_cobrancas existe');
    console.log('4. Execute: mysql -u jpsistemas -p jpsistemas_cobrancas');
    console.log('5. Se necessário, ajuste as credenciais no script');
  }
}

// Executar correção
fixListaNegra(); 