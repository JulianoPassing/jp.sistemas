const mysql = require('mysql2/promise');

async function testParcelamento() {
  try {
    console.log('=== TESTE DE PARCELAMENTO ===');
    
    // Conectar ao banco de teste
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'jpsistemas',
      password: process.env.DB_PASSWORD || 'SuaSenhaForte123!',
      database: 'jpsistemas_test',
      charset: 'utf8mb4'
    });

    // 1. Testar estrutura das tabelas
    console.log('\n1. Verificando estrutura das tabelas...');
    
    const [emprestimosColumns] = await connection.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'jpsistemas_test' AND TABLE_NAME = 'emprestimos'
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log('Colunas da tabela emprestimos:');
    emprestimosColumns.forEach(col => {
      console.log(`  - ${col.COLUMN_NAME}: ${col.DATA_TYPE} (${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'})`);
    });

    const [parcelasColumns] = await connection.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'jpsistemas_test' AND TABLE_NAME = 'parcelas'
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log('\nColunas da tabela parcelas:');
    parcelasColumns.forEach(col => {
      console.log(`  - ${col.COLUMN_NAME}: ${col.DATA_TYPE} (${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'})`);
    });

    // 2. Testar criação de empréstimo parcelado
    console.log('\n2. Testando criação de empréstimo parcelado...');
    
    // Primeiro, criar um cliente de teste
    const [clienteResult] = await connection.execute(`
      INSERT INTO clientes_cobrancas (nome, cpf_cnpj, telefone, email)
      VALUES (?, ?, ?, ?)
    `, ['Cliente Teste Parcelamento', '12345678901', '11999999999', 'teste@teste.com']);
    
    const clienteId = clienteResult.insertId;
    console.log(`Cliente criado com ID: ${clienteId}`);

    // Criar empréstimo parcelado
    const [emprestimoResult] = await connection.execute(`
      INSERT INTO emprestimos (
        cliente_id, valor, data_emprestimo, data_vencimento, juros_mensal, 
        tipo_emprestimo, numero_parcelas, frequencia, valor_parcela
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      clienteId, 
      1200.00, 
      '2024-01-15', 
      '2024-02-15', 
      5.0,
      'in_installments',
      12,
      'monthly',
      100.00
    ]);
    
    const emprestimoId = emprestimoResult.insertId;
    console.log(`Empréstimo parcelado criado com ID: ${emprestimoId}`);

    // 3. Testar criação de parcelas
    console.log('\n3. Testando criação de parcelas...');
    
    const dataPrimeiraParcela = new Date('2024-02-15');
    const parcelas = [];
    
    for (let i = 1; i <= 12; i++) {
      const dataVencimento = new Date(dataPrimeiraParcela);
      dataVencimento.setMonth(dataVencimento.getMonth() + (i - 1));
      
      parcelas.push([
        emprestimoId,
        i,
        100.00,
        dataVencimento.toISOString().split('T')[0]
      ]);
    }
    
    for (const parcela of parcelas) {
      await connection.execute(`
        INSERT INTO parcelas (emprestimo_id, numero_parcela, valor_parcela, data_vencimento)
        VALUES (?, ?, ?, ?)
      `, parcela);
    }
    
    console.log(`${parcelas.length} parcelas criadas`);

    // 4. Verificar parcelas criadas
    console.log('\n4. Verificando parcelas criadas...');
    
    const [parcelasCriadas] = await connection.execute(`
      SELECT numero_parcela, valor_parcela, data_vencimento, status
      FROM parcelas 
      WHERE emprestimo_id = ?
      ORDER BY numero_parcela
    `, [emprestimoId]);
    
    console.log('Parcelas criadas:');
    parcelasCriadas.forEach(parcela => {
      console.log(`  Parcela ${parcela.numero_parcela}: R$ ${parcela.valor_parcela} - Vencimento: ${parcela.data_vencimento} - Status: ${parcela.status}`);
    });

    // 5. Testar consulta de parcelas
    console.log('\n5. Testando consulta de parcelas...');
    
    const [parcelasCompleta] = await connection.execute(`
      SELECT p.*, e.valor as valor_total_emprestimo, e.juros_mensal, e.multa_atraso
      FROM parcelas p
      LEFT JOIN emprestimos e ON p.emprestimo_id = e.id
      WHERE p.emprestimo_id = ?
      ORDER BY p.numero_parcela ASC
    `, [emprestimoId]);
    
    console.log(`Total de parcelas encontradas: ${parcelasCompleta.length}`);
    console.log(`Valor total do empréstimo: R$ ${parcelasCompleta[0].valor_total_emprestimo}`);
    console.log(`Juros mensal: ${parcelasCompleta[0].juros_mensal}%`);

    // 6. Testar atualização de status de parcela
    console.log('\n6. Testando atualização de status de parcela...');
    
    await connection.execute(`
      UPDATE parcelas 
      SET status = 'Paga', valor_pago = valor_parcela, data_pagamento = CURDATE()
      WHERE emprestimo_id = ? AND numero_parcela = 1
    `, [emprestimoId]);
    
    const [parcelaAtualizada] = await connection.execute(`
      SELECT numero_parcela, status, valor_pago, data_pagamento
      FROM parcelas 
      WHERE emprestimo_id = ? AND numero_parcela = 1
    `, [emprestimoId]);
    
    console.log('Parcela 1 atualizada:');
    console.log(`  Status: ${parcelaAtualizada[0].status}`);
    console.log(`  Valor pago: R$ ${parcelaAtualizada[0].valor_pago}`);
    console.log(`  Data pagamento: ${parcelaAtualizada[0].data_pagamento}`);

    // 7. Limpeza
    console.log('\n7. Limpando dados de teste...');
    
    await connection.execute('DELETE FROM parcelas WHERE emprestimo_id = ?', [emprestimoId]);
    await connection.execute('DELETE FROM emprestimos WHERE id = ?', [emprestimoId]);
    await connection.execute('DELETE FROM clientes_cobrancas WHERE id = ?', [clienteId]);
    
    console.log('Dados de teste removidos');

    await connection.end();
    console.log('\n✅ Teste de parcelamento concluído com sucesso!');

  } catch (error) {
    console.error('❌ Erro no teste:', error);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  testParcelamento();
}

module.exports = { testParcelamento }; 