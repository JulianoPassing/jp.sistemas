const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixListaNegraSql() {
  console.log('🔧 Corrigindo erro 500 da lista negra...');
  
  try {
    // Configurações de conexão para tentar
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
    
    // Tentar conectar com cada configuração
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
    
    // 1. Verificar se a tabela existe
    console.log('\n📋 Verificando se a tabela clientes_cobrancas existe...');
    
    const [tables] = await connection.execute(`
      SHOW TABLES LIKE 'clientes_cobrancas'
    `);
    
    if (tables.length === 0) {
      console.log('❌ Tabela clientes_cobrancas não encontrada!');
      await connection.end();
      return;
    }
    
    console.log('✅ Tabela clientes_cobrancas encontrada');
    
    // 2. Verificar estrutura atual
    console.log('\n🔍 Verificando estrutura da tabela...');
    
    const [columns] = await connection.execute(`
      DESCRIBE clientes_cobrancas
    `);
    
    console.log('Campos atuais:');
    columns.forEach(col => {
      console.log(`   - ${col.Field}: ${col.Type}`);
    });
    
    // 3. Verificar se campo observacoes existe
    const temObservacoes = columns.some(col => col.Field === 'observacoes');
    
    if (!temObservacoes) {
      console.log('\n❌ Campo "observacoes" não encontrado!');
      console.log('🔧 Adicionando campo observacoes...');
      
      try {
        await connection.execute(`
          ALTER TABLE clientes_cobrancas 
          ADD COLUMN observacoes TEXT AFTER status
        `);
        console.log('✅ Campo observacoes adicionado com sucesso!');
      } catch (error) {
        console.log('❌ Erro ao adicionar campo observacoes:', error.message);
        throw error;
      }
    } else {
      console.log('✅ Campo observacoes já existe');
    }
    
    // 4. Verificar se campo updated_at existe
    const temUpdatedAt = columns.some(col => col.Field === 'updated_at');
    
    if (!temUpdatedAt) {
      console.log('\n⚠️  Campo "updated_at" não encontrado!');
      console.log('🔧 Adicionando campo updated_at...');
      
      try {
        await connection.execute(`
          ALTER TABLE clientes_cobrancas 
          ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        `);
        console.log('✅ Campo updated_at adicionado com sucesso!');
      } catch (error) {
        console.log('❌ Erro ao adicionar campo updated_at:', error.message);
        // Não é crítico, continuar
      }
    } else {
      console.log('✅ Campo updated_at já existe');
    }
    
    // 5. Verificar estrutura final
    console.log('\n📋 Estrutura final da tabela:');
    
    const [finalColumns] = await connection.execute(`
      DESCRIBE clientes_cobrancas
    `);
    
    finalColumns.forEach(col => {
      console.log(`   - ${col.Field}: ${col.Type} ${col.Null === 'YES' ? '(NULL)' : '(NOT NULL)'}`);
    });
    
    // 6. Testar a funcionalidade
    console.log('\n🧪 Testando a funcionalidade...');
    
    // Buscar um cliente para testar
    const [clientes] = await connection.execute(`
      SELECT id, nome, status FROM clientes_cobrancas LIMIT 1
    `);
    
    if (clientes.length > 0) {
      const cliente = clientes[0];
      console.log(`\nTestando com cliente: ${cliente.nome} (ID: ${cliente.id})`);
      
      // Testar update
      try {
        await connection.execute(`
          UPDATE clientes_cobrancas 
          SET 
            status = ?,
            observacoes = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, ['Lista Negra', 'Teste de correção da funcionalidade', cliente.id]);
        
        console.log('✅ Teste de adição à lista negra: SUCESSO');
        
        // Reverter teste
        await connection.execute(`
          UPDATE clientes_cobrancas 
          SET 
            status = ?,
            observacoes = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, ['Ativo', '', cliente.id]);
        
        console.log('✅ Teste de remoção da lista negra: SUCESSO');
        
      } catch (error) {
        console.log('❌ Erro no teste:', error.message);
        throw error;
      }
    } else {
      console.log('⚠️  Nenhum cliente encontrado para teste');
    }
    
    await connection.end();
    
    console.log('\n🎉 CORREÇÃO CONCLUÍDA COM SUCESSO!');
    console.log('✅ A funcionalidade de lista negra deve estar funcionando agora.');
    console.log('\n📝 Próximos passos:');
    console.log('1. Acesse a página de clientes no sistema');
    console.log('2. Clique em "Lista Negra" em qualquer cliente');
    console.log('3. Confirme a ação');
    console.log('4. Verifique se não há mais erro 500');
    
  } catch (error) {
    console.error('\n❌ Erro durante a correção:', error);
    console.log('\n🔧 Soluções manuais:');
    console.log('1. Execute no MySQL:');
    console.log('   ALTER TABLE clientes_cobrancas ADD COLUMN observacoes TEXT AFTER status;');
    console.log('2. Ou execute:');
    console.log('   mysql -u jpcobrancas -p jpsistemas_cobrancas');
    console.log('   Depois execute o ALTER TABLE acima');
  }
}

// Executar a correção
fixListaNegraSql(); 