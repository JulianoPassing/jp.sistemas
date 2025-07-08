const mysql = require('mysql2/promise');
require('dotenv').config();

// Função para criar conexão com banco de cobranças
async function createCobrancasConnection(username) {
  const dbName = `jpcobrancas_${username.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'jpcobrancas',
    password: process.env.DB_PASSWORD || 'Juliano@95',
    database: dbName,
    charset: 'utf8mb4'
  };
  
  try {
    const connection = await mysql.createConnection(dbConfig);
    return connection;
  } catch (error) {
    console.error(`Erro ao conectar ao banco de cobranças do usuário ${username}:`, error);
    throw error;
  }
}

async function fixListaNegraError() {
  console.log('🔧 Diagnosticando e corrigindo erro 500 da lista negra...');
  
  try {
    // Primeiro, vamos tentar conectar diretamente com o banco principal
    console.log('\n🔍 Tentando conectar com diferentes configurações...');
    
    let connection;
    const configs = [
      // Configuração 1: Banco específico do usuário
      {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'jpcobrancas',
        password: process.env.DB_PASSWORD || 'Juliano@95',
        database: 'jpcobrancas_test_user',
        charset: 'utf8mb4'
      },
      // Configuração 2: Banco principal jpsistemas_cobrancas
      {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'jpcobrancas',
        password: process.env.DB_PASSWORD || 'Juliano@95',
        database: 'jpsistemas_cobrancas',
        charset: 'utf8mb4'
      },
      // Configuração 3: Tentar com usuário root
      {
        host: process.env.DB_HOST || 'localhost',
        user: 'root',
        password: process.env.DB_ROOT_PASSWORD || process.env.DB_PASSWORD || 'Juliano@95',
        database: 'jpsistemas_cobrancas',
        charset: 'utf8mb4'
      }
    ];
    
    for (let i = 0; i < configs.length; i++) {
      try {
        console.log(`Tentativa ${i + 1}: ${configs[i].database} com usuário ${configs[i].user}`);
        connection = await mysql.createConnection(configs[i]);
        console.log(`✅ Conectado com sucesso!`);
        break;
      } catch (error) {
        console.log(`❌ Falha na tentativa ${i + 1}: ${error.message}`);
        if (i === configs.length - 1) {
          throw new Error('Não foi possível conectar com nenhuma configuração');
        }
      }
    }
    
    // 1. Verificar se a tabela clientes_cobrancas existe
    console.log('\n1. Verificando estrutura da tabela clientes_cobrancas...');
    
    const [tables] = await connection.execute(`
      SHOW TABLES LIKE 'clientes_cobrancas'
    `);
    
    if (tables.length === 0) {
      console.log('❌ Tabela clientes_cobrancas não existe!');
      await connection.end();
      return;
    }
    
    console.log('✅ Tabela clientes_cobrancas existe');
    
    // 2. Verificar estrutura da tabela
    console.log('\n2. Verificando campos da tabela...');
    
    const [columns] = await connection.execute(`
      DESCRIBE clientes_cobrancas
    `);
    
    console.log('Campos existentes:');
    columns.forEach(col => {
      console.log(`   - ${col.Field}: ${col.Type} ${col.Null === 'YES' ? '(NULL)' : '(NOT NULL)'}`);
    });
    
    // 3. Verificar se o campo observacoes existe
    const temObservacoes = columns.some(col => col.Field === 'observacoes');
    
    if (!temObservacoes) {
      console.log('\n❌ PROBLEMA ENCONTRADO: Campo "observacoes" não existe!');
      console.log('🔧 Adicionando campo observacoes...');
      
      await connection.execute(`
        ALTER TABLE clientes_cobrancas 
        ADD COLUMN observacoes TEXT AFTER status
      `);
      
      console.log('✅ Campo observacoes adicionado com sucesso!');
    } else {
      console.log('\n✅ Campo observacoes já existe');
    }
    
    // 4. Verificar se o campo updated_at existe
    const temUpdatedAt = columns.some(col => col.Field === 'updated_at');
    
    if (!temUpdatedAt) {
      console.log('\n⚠️  Campo "updated_at" não existe. Adicionando...');
      
      await connection.execute(`
        ALTER TABLE clientes_cobrancas 
        ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      `);
      
      console.log('✅ Campo updated_at adicionado com sucesso!');
    } else {
      console.log('✅ Campo updated_at já existe');
    }
    
    // 5. Verificar estrutura final
    console.log('\n3. Verificando estrutura final da tabela...');
    
    const [finalColumns] = await connection.execute(`
      DESCRIBE clientes_cobrancas
    `);
    
    console.log('Estrutura final:');
    finalColumns.forEach(col => {
      console.log(`   - ${col.Field}: ${col.Type} ${col.Null === 'YES' ? '(NULL)' : '(NOT NULL)'}`);
    });
    
    // 6. Testar a funcionalidade
    console.log('\n4. Testando a funcionalidade da lista negra...');
    
    // Buscar um cliente para testar
    const [clientes] = await connection.execute(`
      SELECT id, nome, status FROM clientes_cobrancas LIMIT 1
    `);
    
    if (clientes.length === 0) {
      console.log('⚠️  Nenhum cliente encontrado para teste. Criando cliente de teste...');
      
      await connection.execute(`
        INSERT INTO clientes_cobrancas (nome, cpf_cnpj, telefone, status) 
        VALUES (?, ?, ?, ?)
      `, ['Cliente Teste', '000.000.000-00', '(11) 99999-9999', 'Ativo']);
      
      const [novosClientes] = await connection.execute(`
        SELECT id, nome, status FROM clientes_cobrancas WHERE nome = 'Cliente Teste'
      `);
      
      if (novosClientes.length > 0) {
        clientes.push(novosClientes[0]);
        console.log('✅ Cliente de teste criado');
      }
    }
    
    if (clientes.length > 0) {
      const cliente = clientes[0];
      console.log(`\nTestando com cliente: ${cliente.nome} (ID: ${cliente.id})`);
      
      // Testar atualização para lista negra
      console.log('📝 Testando adição à lista negra...');
      
      await connection.execute(`
        UPDATE clientes_cobrancas 
        SET 
          status = ?,
          observacoes = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, ['Lista Negra', 'Teste de correção da funcionalidade', cliente.id]);
      
      console.log('✅ Atualização realizada com sucesso!');
      
      // Verificar se foi atualizado
      const [clienteAtualizado] = await connection.execute(`
        SELECT id, nome, status, observacoes, updated_at FROM clientes_cobrancas WHERE id = ?
      `, [cliente.id]);
      
      if (clienteAtualizado.length > 0) {
        const c = clienteAtualizado[0];
        console.log(`   Status: ${c.status}`);
        console.log(`   Observações: ${c.observacoes || 'N/A'}`);
        console.log(`   Atualizado em: ${c.updated_at || 'N/A'}`);
      }
      
      // Testar remoção da lista negra
      console.log('\n📝 Testando remoção da lista negra...');
      
      await connection.execute(`
        UPDATE clientes_cobrancas 
        SET 
          status = ?,
          observacoes = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, ['Ativo', 'Removido da lista negra - teste', cliente.id]);
      
      console.log('✅ Remoção realizada com sucesso!');
      
      // Verificar se foi revertido
      const [clienteRevertido] = await connection.execute(`
        SELECT id, nome, status, observacoes FROM clientes_cobrancas WHERE id = ?
      `, [cliente.id]);
      
      if (clienteRevertido.length > 0) {
        const c = clienteRevertido[0];
        console.log(`   Status: ${c.status}`);
        console.log(`   Observações: ${c.observacoes || 'N/A'}`);
      }
      
      // Limpar cliente de teste se foi criado
      if (cliente.nome === 'Cliente Teste') {
        await connection.execute(`DELETE FROM clientes_cobrancas WHERE id = ?`, [cliente.id]);
        console.log('🧹 Cliente de teste removido');
      }
    }
    
    await connection.end();
    
    console.log('\n🎉 CORREÇÃO CONCLUÍDA COM SUCESSO!');
    console.log('✅ A funcionalidade de lista negra deve estar funcionando agora.');
    console.log('✅ Teste no frontend: acesse a página de clientes e tente adicionar um cliente à lista negra.');
    
  } catch (error) {
    console.error('❌ Erro durante a correção:', error);
    console.log('\n🔧 Detalhes do erro:');
    console.log(`   Mensagem: ${error.message}`);
    console.log(`   Código: ${error.code || 'N/A'}`);
    console.log(`   SQL: ${error.sqlMessage || 'N/A'}`);
    
    console.log('\n💡 Possíveis soluções:');
    console.log('1. Verifique se o MySQL está rodando');
    console.log('2. Confirme as credenciais do banco de dados');
    console.log('3. Execute manualmente o SQL: ALTER TABLE clientes_cobrancas ADD COLUMN observacoes TEXT AFTER status;');
  }
}

// Executar a correção
fixListaNegraError(); 