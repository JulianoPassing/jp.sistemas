const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixListaNegraDirect() {
  console.log('🔧 Correção direta da lista negra...');
  
  let connection;
  
  try {
    // Tentar conectar com diferentes configurações
    const configs = [
      {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'jpcobrancas',
        password: process.env.DB_PASSWORD || 'Juliano@95',
        database: 'jpsistemas_cobrancas',
        charset: 'utf8mb4'
      },
      {
        host: process.env.DB_HOST || 'localhost',
        user: 'root',
        password: process.env.DB_ROOT_PASSWORD || 'Juliano@95',
        database: 'jpsistemas_cobrancas',
        charset: 'utf8mb4'
      }
    ];
    
    for (const config of configs) {
      try {
        console.log(`Tentando conectar com usuário: ${config.user}`);
        connection = await mysql.createConnection(config);
        console.log('✅ Conectado com sucesso!');
        break;
      } catch (error) {
        console.log(`❌ Falha: ${error.message}`);
      }
    }
    
    if (!connection) {
      throw new Error('Não foi possível conectar com o banco');
    }
    
    console.log('\n1. Verificando estrutura da tabela...');
    
    // Verificar se tabela existe
    const [tables] = await connection.execute("SHOW TABLES LIKE 'clientes_cobrancas'");
    if (tables.length === 0) {
      console.log('❌ Tabela clientes_cobrancas não encontrada!');
      return;
    }
    
    // Verificar campos
    const [columns] = await connection.execute("DESCRIBE clientes_cobrancas");
    const hasObservacoes = columns.some(col => col.Field === 'observacoes');
    const hasUpdatedAt = columns.some(col => col.Field === 'updated_at');
    
    console.log(`Campo observacoes: ${hasObservacoes ? '✅' : '❌'}`);
    console.log(`Campo updated_at: ${hasUpdatedAt ? '✅' : '❌'}`);
    
    // Adicionar campo observacoes se não existir
    if (!hasObservacoes) {
      console.log('\n2. Adicionando campo observacoes...');
      try {
        await connection.execute(`
          ALTER TABLE clientes_cobrancas 
          ADD COLUMN observacoes TEXT AFTER status
        `);
        console.log('✅ Campo observacoes adicionado!');
      } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
          console.log('⚠️  Campo observacoes já existe');
        } else {
          console.log('❌ Erro ao adicionar observacoes:', error.message);
          throw error;
        }
      }
    }
    
    // Adicionar campo updated_at se não existir
    if (!hasUpdatedAt) {
      console.log('\n3. Adicionando campo updated_at...');
      try {
        await connection.execute(`
          ALTER TABLE clientes_cobrancas 
          ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        `);
        console.log('✅ Campo updated_at adicionado!');
      } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
          console.log('⚠️  Campo updated_at já existe');
        } else {
          console.log('❌ Erro ao adicionar updated_at:', error.message);
          // Não é crítico, continuar
        }
      }
    }
    
    console.log('\n4. Testando funcionalidade...');
    
    // Buscar um cliente para testar
    const [clientes] = await connection.execute(`
      SELECT id, nome, status FROM clientes_cobrancas LIMIT 1
    `);
    
    if (clientes.length === 0) {
      console.log('⚠️  Nenhum cliente encontrado para teste');
    } else {
      const cliente = clientes[0];
      console.log(`Testando com cliente: ${cliente.nome} (ID: ${cliente.id})`);
      
      try {
        // Testar o UPDATE que estava falhando
        await connection.execute(`
          UPDATE clientes_cobrancas 
          SET 
            status = ?,
            observacoes = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, ['Lista Negra', 'Teste automático', cliente.id]);
        
        console.log('✅ Teste de UPDATE: SUCESSO');
        
        // Reverter
        await connection.execute(`
          UPDATE clientes_cobrancas 
          SET 
            status = ?,
            observacoes = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, ['Ativo', '', cliente.id]);
        
        console.log('✅ Dados revertidos');
        
      } catch (error) {
        console.log('❌ Erro no teste:', error.message);
        throw error;
      }
    }
    
    console.log('\n🎉 CORREÇÃO CONCLUÍDA!');
    console.log('A funcionalidade de lista negra deve estar funcionando agora.');
    
  } catch (error) {
    console.error('\n❌ Erro:', error.message);
    console.log('\n🔧 Solução manual:');
    console.log('Execute no MySQL:');
    console.log('ALTER TABLE clientes_cobrancas ADD COLUMN observacoes TEXT AFTER status;');
    console.log('ALTER TABLE clientes_cobrancas ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;');
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

fixListaNegraDirect(); 