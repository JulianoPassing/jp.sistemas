// Script para adicionar campo observacoes à tabela clientes_cobrancas
const mysql = require('mysql2/promise');

async function addObservacoesField() {
  try {
    console.log('=== ADICIONANDO CAMPO OBSERVAÇÕES ===\n');
    
    // Configuração do banco
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: 'jpsistemas_cobrancas'
    });
    
    console.log('1. Verificando se o campo observacoes já existe...');
    
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
      console.log('2. Adicionando campo observacoes...');
      
      // Adicionar o campo observacoes
      await connection.execute(`
        ALTER TABLE clientes_cobrancas 
        ADD COLUMN observacoes TEXT AFTER status
      `);
      
      console.log('✅ Campo observacoes adicionado com sucesso!');
    }
    
    // Verificar estrutura da tabela
    console.log('\n3. Estrutura atual da tabela clientes_cobrancas:');
    const [tableStructure] = await connection.execute(`
      DESCRIBE clientes_cobrancas
    `);
    
    tableStructure.forEach(column => {
      console.log(`- ${column.Field}: ${column.Type} ${column.Null === 'YES' ? '(NULL)' : '(NOT NULL)'}`);
    });
    
    await connection.end();
    console.log('\n=== SCRIPT CONCLUÍDO ===');
    
  } catch (error) {
    console.error('❌ Erro ao adicionar campo observacoes:', error);
    
    if (error.code === 'ER_NO_SUCH_TABLE') {
      console.log('\n💡 A tabela clientes_cobrancas não existe ainda.');
      console.log('   Ela será criada automaticamente quando o sistema for usado pela primeira vez.');
    } else if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('\n✅ O campo observacoes já existe na tabela.');
    } else {
      console.log('\n🔧 Verifique se:');
      console.log('   - O banco de dados está rodando');
      console.log('   - As credenciais estão corretas');
      console.log('   - O banco jpsistemas_cobrancas existe');
    }
  }
}

// Executar script
addObservacoesField(); 