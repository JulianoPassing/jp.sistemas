const mysql = require('mysql2/promise');
require('dotenv').config();

async function testListaNegraEndpoint() {
  console.log('🧪 Testando endpoint da lista negra...');
  
  try {
    // Configurações de conexão
    const configs = [
      {
        name: 'Banco principal jpsistemas_cobrancas',
        config: {
          host: process.env.DB_HOST || 'localhost',
          user: process.env.DB_USER || 'jpcobrancas',
          password: process.env.DB_PASSWORD || 'Juliano@95',
          database: 'jpsistemas_cobrancas',
          charset: 'utf8mb4'
        }
      },
      {
        name: 'Usuário root',
        config: {
          host: process.env.DB_HOST || 'localhost',
          user: 'root',
          password: process.env.DB_ROOT_PASSWORD || 'Juliano@95',
          database: 'jpsistemas_cobrancas',
          charset: 'utf8mb4'
        }
      }
    ];
    
    let connection = null;
    
    // Tentar conectar
    for (const { name, config } of configs) {
      try {
        console.log(`\n🔍 Tentando conectar: ${name}`);
        connection = await mysql.createConnection(config);
        console.log(`✅ Conectado com sucesso!`);
        break;
      } catch (error) {
        console.log(`❌ Falha: ${error.message}`);
      }
    }
    
    if (!connection) {
      throw new Error('Não foi possível conectar com o banco de dados');
    }
    
    // 1. Verificar se a tabela existe e sua estrutura
    console.log('\n📋 Verificando tabela clientes_cobrancas...');
    
    const [tables] = await connection.execute(`
      SHOW TABLES LIKE 'clientes_cobrancas'
    `);
    
    if (tables.length === 0) {
      console.log('❌ Tabela clientes_cobrancas não encontrada!');
      await connection.end();
      return;
    }
    
    // 2. Verificar estrutura da tabela
    const [columns] = await connection.execute(`
      DESCRIBE clientes_cobrancas
    `);
    
    console.log('\n📊 Estrutura da tabela:');
    columns.forEach(col => {
      console.log(`   - ${col.Field}: ${col.Type} ${col.Null === 'YES' ? '(NULL)' : '(NOT NULL)'} ${col.Key ? `[${col.Key}]` : ''}`);
    });
    
    // 3. Verificar se campos necessários existem
    const temObservacoes = columns.some(col => col.Field === 'observacoes');
    const temUpdatedAt = columns.some(col => col.Field === 'updated_at');
    
    console.log(`\n🔍 Campos necessários:`);
    console.log(`   - observacoes: ${temObservacoes ? '✅ Existe' : '❌ Não existe'}`);
    console.log(`   - updated_at: ${temUpdatedAt ? '✅ Existe' : '❌ Não existe'}`);
    
    // 4. Buscar cliente para testar (ID 5 que deu erro)
    console.log('\n🔍 Buscando cliente ID 5...');
    
    const [clienteRows] = await connection.execute(`
      SELECT id, nome, status, observacoes FROM clientes_cobrancas WHERE id = ?
    `, [5]);
    
    if (clienteRows.length === 0) {
      console.log('❌ Cliente ID 5 não encontrado!');
      
      // Buscar qualquer cliente para teste
      const [outrosClientes] = await connection.execute(`
        SELECT id, nome, status FROM clientes_cobrancas LIMIT 1
      `);
      
      if (outrosClientes.length === 0) {
        console.log('❌ Nenhum cliente encontrado na tabela!');
        await connection.end();
        return;
      }
      
      const cliente = outrosClientes[0];
      console.log(`\n⚠️  Usando cliente alternativo: ${cliente.nome} (ID: ${cliente.id})`);
      
      // Testar com cliente alternativo
      await testUpdateCliente(connection, cliente.id, cliente.nome);
      
    } else {
      const cliente = clienteRows[0];
      console.log(`✅ Cliente encontrado: ${cliente.nome} (Status: ${cliente.status})`);
      
      // Testar com cliente ID 5
      await testUpdateCliente(connection, 5, cliente.nome);
    }
    
    await connection.end();
    
  } catch (error) {
    console.error('\n❌ Erro durante o teste:', error);
    console.error('Detalhes:', {
      message: error.message,
      code: error.code,
      sqlMessage: error.sqlMessage
    });
  }
}

async function testUpdateCliente(connection, clienteId, clienteNome) {
  console.log(`\n🧪 Testando update do cliente ${clienteNome} (ID: ${clienteId})...`);
  
  try {
    // Simular exatamente o que o endpoint faz
    console.log('1. Verificando se cliente existe...');
    
    const [clienteRows] = await connection.execute(`
      SELECT id, nome, status FROM clientes_cobrancas WHERE id = ?
    `, [clienteId]);
    
    if (clienteRows.length === 0) {
      console.log('❌ Cliente não encontrado');
      return;
    }
    
    console.log(`✅ Cliente encontrado: ${clienteRows[0].nome} (Status atual: ${clienteRows[0].status})`);
    
    // 2. Testar o UPDATE que está falhando
    console.log('2. Testando UPDATE...');
    
    const status = 'Lista Negra';
    const motivo = 'Teste de correção da funcionalidade';
    
    try {
      await connection.execute(`
        UPDATE clientes_cobrancas 
        SET 
          status = ?,
          observacoes = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [status, motivo, clienteId]);
      
      console.log('✅ UPDATE executado com sucesso!');
      
      // 3. Verificar se foi atualizado
      const [verificacao] = await connection.execute(`
        SELECT status, observacoes, updated_at FROM clientes_cobrancas WHERE id = ?
      `, [clienteId]);
      
      if (verificacao.length > 0) {
        console.log('✅ Verificação pós-update:');
        console.log(`   - Status: ${verificacao[0].status}`);
        console.log(`   - Observações: ${verificacao[0].observacoes}`);
        console.log(`   - Updated_at: ${verificacao[0].updated_at}`);
      }
      
      // 4. Reverter para não alterar dados
      await connection.execute(`
        UPDATE clientes_cobrancas 
        SET 
          status = ?,
          observacoes = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, ['Ativo', '', clienteId]);
      
      console.log('✅ Dados revertidos com sucesso!');
      
    } catch (updateError) {
      console.log('❌ Erro no UPDATE:', updateError.message);
      console.log('Detalhes do erro:', {
        code: updateError.code,
        sqlMessage: updateError.sqlMessage,
        sql: updateError.sql
      });
      
      // Verificar se é problema com campo específico
      if (updateError.message.includes('observacoes')) {
        console.log('\n🔧 Problema com campo observacoes detectado!');
        console.log('Tentando adicionar o campo...');
        
        try {
          await connection.execute(`
            ALTER TABLE clientes_cobrancas 
            ADD COLUMN observacoes TEXT AFTER status
          `);
          console.log('✅ Campo observacoes adicionado!');
          
          // Tentar novamente
          await connection.execute(`
            UPDATE clientes_cobrancas 
            SET 
              status = ?,
              observacoes = ?
            WHERE id = ?
          `, [status, motivo, clienteId]);
          
          console.log('✅ UPDATE funcionou após adicionar campo!');
          
        } catch (alterError) {
          console.log('❌ Erro ao adicionar campo:', alterError.message);
        }
      }
      
      if (updateError.message.includes('updated_at')) {
        console.log('\n🔧 Problema com campo updated_at detectado!');
        console.log('Tentando adicionar o campo...');
        
        try {
          await connection.execute(`
            ALTER TABLE clientes_cobrancas 
            ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          `);
          console.log('✅ Campo updated_at adicionado!');
          
        } catch (alterError) {
          console.log('❌ Erro ao adicionar campo:', alterError.message);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Erro geral no teste:', error);
  }
}

// Executar teste
testListaNegraEndpoint(); 