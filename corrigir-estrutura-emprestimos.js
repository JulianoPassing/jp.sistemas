const mysql = require('mysql2/promise');

async function corrigirEstruturaEmprestimos() {
  const username = 'teste1234';
  const dbName = `jpcobrancas_${username}`;
  
  console.log('🔧 CORREÇÃO: Estrutura da tabela emprestimos');
  console.log(`📊 Usuário: ${username}`);
  console.log(`🗄️  Banco: ${dbName}`);
  
  try {
    // Conectar ao banco
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'jpsistemas',
      password: process.env.DB_PASSWORD || 'Juliano@95',
      database: dbName,
      charset: 'utf8mb4'
    });
    
    console.log('✅ Conexão com banco estabelecida');
    
    // Verificar colunas existentes
    console.log('\n📋 Verificando colunas existentes...');
    const [existingColumns] = await connection.execute(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'emprestimos'
    `, [dbName]);
    
    const columnNames = existingColumns.map(col => col.COLUMN_NAME);
    console.log('Colunas existentes:', columnNames);
    
    // Adicionar colunas faltantes
    const columnsToAdd = [
      {
        name: 'tipo_emprestimo',
        definition: "ENUM('fixed', 'in_installments') DEFAULT 'fixed'"
      },
      {
        name: 'numero_parcelas',
        definition: "INT DEFAULT 1"
      },
      {
        name: 'valor_parcela',
        definition: "DECIMAL(10,2) DEFAULT 0.00"
      },
      {
        name: 'frequencia',
        definition: "ENUM('daily', 'weekly', 'biweekly', 'monthly') DEFAULT 'monthly'"
      }
    ];
    
    console.log('\n🔧 Adicionando colunas faltantes...');
    
    for (const column of columnsToAdd) {
      if (!columnNames.includes(column.name)) {
        try {
          await connection.execute(`
            ALTER TABLE emprestimos 
            ADD COLUMN ${column.name} ${column.definition}
          `);
          console.log(`✅ Coluna '${column.name}' adicionada com sucesso`);
        } catch (error) {
          console.error(`❌ Erro ao adicionar coluna '${column.name}':`, error.message);
        }
      } else {
        console.log(`⚠️  Coluna '${column.name}' já existe`);
      }
    }
    
    // Verificar estrutura final
    console.log('\n📋 Verificando estrutura final...');
    const [finalColumns] = await connection.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'emprestimos'
      ORDER BY ORDINAL_POSITION
    `, [dbName]);
    
    console.log('✅ Estrutura final da tabela emprestimos:');
    finalColumns.forEach(col => {
      console.log(`  - ${col.COLUMN_NAME}: ${col.DATA_TYPE} (${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'}) DEFAULT: ${col.COLUMN_DEFAULT || 'N/A'}`);
    });
    
    // Testar query da API novamente
    console.log('\n🧪 Testando query da API...');
    try {
      const [result] = await connection.execute(`
        SELECT e.*, 
               c.nome as cliente_nome, 
               c.telefone as telefone,
               COALESCE(e.valor, 0) as valor,
               COALESCE(e.juros_mensal, 0) as juros_mensal,
               COALESCE(e.numero_parcelas, 1) as numero_parcelas,
               COALESCE(e.valor_parcela, 0) as valor_parcela,
               CASE 
                 WHEN e.tipo_emprestimo = 'in_installments' AND e.valor_parcela > 0 AND e.numero_parcelas > 0 
                   THEN (e.valor_parcela * e.numero_parcelas)
                 WHEN e.valor > 0 AND e.juros_mensal > 0 
                   THEN e.valor * (1 + (e.juros_mensal / 100))
                 ELSE COALESCE(e.valor, 0)
               END as valor_final,
               DATE_FORMAT(e.data_emprestimo, '%Y-%m-%d') as data_emprestimo_formatada,
               DATE_FORMAT(e.data_vencimento, '%Y-%m-%d') as data_vencimento_formatada
        FROM emprestimos e
        LEFT JOIN clientes_cobrancas c ON e.cliente_id = c.id
        ORDER BY e.created_at DESC
      `);
      
      console.log('✅ Query da API executada com sucesso!');
      console.log(`📊 Registros retornados: ${result.length}`);
      
    } catch (error) {
      console.error('❌ Query da API ainda tem erro:', error.message);
    }
    
    await connection.end();
    console.log('\n🎉 Correção concluída!');
    
  } catch (error) {
    console.error('❌ Erro na conexão:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Executar correção
corrigirEstruturaEmprestimos().catch(console.error); 