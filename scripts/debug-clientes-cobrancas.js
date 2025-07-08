const mysql = require('mysql2/promise');
const fs = require('fs');

// Configuração do banco
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '', // Substitua pela sua senha
  database: 'cobrancas_admin' // Nome do banco de dados
};

async function debugClientesCobrancas() {
  console.log('=== DEBUG TABELA CLIENTES_COBRANCAS ===\n');
  
  try {
    const connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conexão estabelecida com sucesso\n');
    
    // Verificar se a tabela existe
    console.log('1. Verificando se a tabela clientes_cobrancas existe...');
    const [tables] = await connection.execute(`
      SHOW TABLES LIKE 'clientes_cobrancas'
    `);
    
    if (tables.length === 0) {
      console.log('❌ Tabela clientes_cobrancas não existe!');
      
      // Criar a tabela
      console.log('2. Criando tabela clientes_cobrancas...');
      await connection.execute(`
        CREATE TABLE clientes_cobrancas (
          id INT AUTO_INCREMENT PRIMARY KEY,
          nome VARCHAR(255) NOT NULL,
          cpf_cnpj VARCHAR(20),
          email VARCHAR(255),
          telefone VARCHAR(20),
          endereco TEXT,
          cidade VARCHAR(100),
          estado VARCHAR(2),
          cep VARCHAR(10),
          status VARCHAR(20) DEFAULT 'Ativo',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Tabela clientes_cobrancas criada com sucesso');
      
    } else {
      console.log('✅ Tabela clientes_cobrancas existe');
    }
    
    // Verificar estrutura da tabela
    console.log('\n3. Verificando estrutura da tabela...');
    const [columns] = await connection.execute(`
      DESCRIBE clientes_cobrancas
    `);
    
    console.log('Colunas da tabela:');
    columns.forEach(col => {
      console.log(`  - ${col.Field}: ${col.Type} (${col.Null === 'YES' ? 'NULL' : 'NOT NULL'})`);
    });
    
    // Verificar se há coluna status
    const hasStatus = columns.some(col => col.Field === 'status');
    if (!hasStatus) {
      console.log('\n4. Adicionando coluna status...');
      await connection.execute(`
        ALTER TABLE clientes_cobrancas 
        ADD COLUMN status VARCHAR(20) DEFAULT 'Ativo'
      `);
      console.log('✅ Coluna status adicionada');
    }
    
    // Contar registros
    console.log('\n5. Contando registros...');
    const [count] = await connection.execute(`
      SELECT COUNT(*) as total FROM clientes_cobrancas
    `);
    console.log(`Total de clientes: ${count[0].total}`);
    
    // Verificar status dos clientes
    console.log('\n6. Verificando status dos clientes...');
    const [statusCount] = await connection.execute(`
      SELECT status, COUNT(*) as total 
      FROM clientes_cobrancas 
      GROUP BY status
    `);
    
    console.log('Status dos clientes:');
    statusCount.forEach(row => {
      console.log(`  - ${row.status}: ${row.total}`);
    });
    
    // Testar query do dashboard
    console.log('\n7. Testando query do dashboard...');
    const [dashboardResult] = await connection.execute(`
      SELECT COUNT(*) as total_clientes 
      FROM clientes_cobrancas 
      WHERE status IN ('Ativo', 'Pendente')
    `);
    console.log(`Clientes ativos/pendentes: ${dashboardResult[0].total_clientes}`);
    
    await connection.end();
    console.log('\n✅ Teste concluído com sucesso');
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Executar o debug
debugClientesCobrancas(); 