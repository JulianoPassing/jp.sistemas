const mysql = require('mysql2/promise');

async function debugEmprestimosQuery() {
  const username = 'teste1234';
  const dbName = `jpcobrancas_${username}`;
  
  console.log('🔍 DEBUG: Query da rota /emprestimos');
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
    
    // Testar cada parte da query separadamente
    console.log('\n📋 TESTE 1: Verificar tabela emprestimos');
    try {
      const [result1] = await connection.execute('SELECT COUNT(*) as count FROM emprestimos');
      console.log('✅ Tabela emprestimos OK, registros:', result1[0].count);
    } catch (error) {
      console.error('❌ Erro na tabela emprestimos:', error.message);
      return;
    }
    
    console.log('\n📋 TESTE 2: Verificar tabela clientes_cobrancas');
    try {
      const [result2] = await connection.execute('SELECT COUNT(*) as count FROM clientes_cobrancas');
      console.log('✅ Tabela clientes_cobrancas OK, registros:', result2[0].count);
    } catch (error) {
      console.error('❌ Erro na tabela clientes_cobrancas:', error.message);
      return;
    }
    
    console.log('\n📋 TESTE 3: Verificar colunas específicas');
    try {
      const [result3] = await connection.execute(`
        SELECT 
          COLUMN_NAME, 
          DATA_TYPE, 
          IS_NULLABLE, 
          COLUMN_DEFAULT
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'emprestimos'
        ORDER BY ORDINAL_POSITION
      `, [dbName]);
      
      console.log('✅ Colunas da tabela emprestimos:');
      result3.forEach(col => {
        console.log(`  - ${col.COLUMN_NAME}: ${col.DATA_TYPE} (${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'})`);
      });
    } catch (error) {
      console.error('❌ Erro ao verificar colunas:', error.message);
    }
    
    console.log('\n📋 TESTE 4: Verificar campos específicos da query');
    try {
      // Testar cada campo individualmente
      const fieldsToTest = [
        'id', 'cliente_id', 'valor', 'data_emprestimo', 'data_vencimento', 
        'juros_mensal', 'multa_atraso', 'status', 'observacoes', 
        'tipo_emprestimo', 'numero_parcelas', 'valor_parcela', 'created_at'
      ];
      
      for (const field of fieldsToTest) {
        try {
          const [result] = await connection.execute(`SELECT ${field} FROM emprestimos LIMIT 1`);
          console.log(`✅ Campo ${field}: OK`);
        } catch (error) {
          console.error(`❌ Campo ${field}: ${error.message}`);
        }
      }
    } catch (error) {
      console.error('❌ Erro ao testar campos:', error.message);
    }
    
    console.log('\n📋 TESTE 5: Testar UPDATE das parcelas');
    try {
      await connection.execute(`
        UPDATE parcelas 
        SET status = 'Atrasada' 
        WHERE status = 'Pendente' 
          AND data_vencimento < CURDATE()
      `);
      console.log('✅ UPDATE parcelas: OK');
    } catch (error) {
      console.error('❌ UPDATE parcelas:', error.message);
    }
    
    console.log('\n📋 TESTE 6: Testar query simplificada');
    try {
      const [result6] = await connection.execute(`
        SELECT e.id, e.valor, e.status
        FROM emprestimos e
        LIMIT 5
      `);
      console.log('✅ Query básica OK, registros:', result6.length);
    } catch (error) {
      console.error('❌ Query básica:', error.message);
    }
    
    console.log('\n📋 TESTE 7: Testar JOIN');
    try {
      const [result7] = await connection.execute(`
        SELECT e.id, e.valor, c.nome as cliente_nome
        FROM emprestimos e
        LEFT JOIN clientes_cobrancas c ON e.cliente_id = c.id
        LIMIT 5
      `);
      console.log('✅ JOIN OK, registros:', result7.length);
    } catch (error) {
      console.error('❌ JOIN:', error.message);
    }
    
    console.log('\n📋 TESTE 8: Testar COALESCE');
    try {
      const [result8] = await connection.execute(`
        SELECT 
          COALESCE(e.valor, 0) as valor,
          COALESCE(e.juros_mensal, 0) as juros_mensal,
          COALESCE(e.numero_parcelas, 1) as numero_parcelas,
          COALESCE(e.valor_parcela, 0) as valor_parcela
        FROM emprestimos e
        LIMIT 5
      `);
      console.log('✅ COALESCE OK, registros:', result8.length);
    } catch (error) {
      console.error('❌ COALESCE:', error.message);
    }
    
    console.log('\n📋 TESTE 9: Testar DATE_FORMAT');
    try {
      const [result9] = await connection.execute(`
        SELECT 
          DATE_FORMAT(e.data_emprestimo, '%Y-%m-%d') as data_emprestimo_formatada,
          DATE_FORMAT(e.data_vencimento, '%Y-%m-%d') as data_vencimento_formatada
        FROM emprestimos e
        LIMIT 5
      `);
      console.log('✅ DATE_FORMAT OK, registros:', result9.length);
    } catch (error) {
      console.error('❌ DATE_FORMAT:', error.message);
    }
    
    console.log('\n📋 TESTE 10: Testar CASE WHEN');
    try {
      const [result10] = await connection.execute(`
        SELECT 
          CASE 
            WHEN e.tipo_emprestimo = 'in_installments' AND e.valor_parcela > 0 AND e.numero_parcelas > 0 
              THEN (e.valor_parcela * e.numero_parcelas)
            WHEN e.valor > 0 AND e.juros_mensal > 0 
              THEN e.valor * (1 + (e.juros_mensal / 100))
            ELSE COALESCE(e.valor, 0)
          END as valor_final
        FROM emprestimos e
        LIMIT 5
      `);
      console.log('✅ CASE WHEN OK, registros:', result10.length);
    } catch (error) {
      console.error('❌ CASE WHEN:', error.message);
    }
    
    console.log('\n📋 TESTE 11: Query completa da API');
    try {
      const [result11] = await connection.execute(`
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
      console.log('✅ Query completa OK, registros:', result11.length);
      
      if (result11.length > 0) {
        console.log('📊 Primeiro registro:', result11[0]);
      }
    } catch (error) {
      console.error('❌ Query completa:', error.message);
      console.error('Stack:', error.stack);
    }
    
    await connection.end();
    console.log('\n🎉 Debug concluído!');
    
  } catch (error) {
    console.error('❌ Erro na conexão:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Executar debug
debugEmprestimosQuery().catch(console.error); 