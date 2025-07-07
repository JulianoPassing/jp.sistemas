const mysql = require('mysql2/promise');

async function testValorFixoEmprestimos() {
  try {
    console.log('=== TESTE DE VALOR FIXO EM EMPRÉSTIMOS ===\n');

    // Obter conexão com o banco principal
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'jp_sistemas'
    });

    // Buscar o primeiro banco de dados de cobranças
    const [databases] = await connection.execute(`
      SELECT SCHEMA_NAME as db_name 
      FROM INFORMATION_SCHEMA.SCHEMATA 
      WHERE SCHEMA_NAME LIKE 'cobrancas_%'
      LIMIT 1
    `);

    if (databases.length === 0) {
      console.log('❌ Nenhum banco de dados de cobranças encontrado');
      await connection.end();
      return;
    }

    const dbName = databases[0].db_name;
    console.log(`Usando banco de dados: ${dbName}`);

    const dbConnection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: dbName
    });

    // 1. Testar criação de cliente
    console.log('\n1. Criando cliente de teste...');
    const [clienteResult] = await dbConnection.execute(`
      INSERT INTO clientes_cobrancas (nome, cpf_cnpj, telefone, email, endereco, cidade, estado, cep)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      'Cliente Teste Valor Fixo',
      '123.456.789-00',
      '(11) 99999-9999',
      'teste@exemplo.com',
      'Rua Teste, 123',
      'São Paulo',
      'SP',
      '01234-567'
    ]);
    
    const clienteId = clienteResult.insertId;
    console.log(`Cliente criado com ID: ${clienteId}`);

    // 2. Testar empréstimo com valor final fixo
    console.log('\n2. Testando empréstimo com valor final fixo...');
    console.log('Dados: Valor Final = R$ 1500, Parcelas = 3');
    
    const [emprestimoResult1] = await dbConnection.execute(`
      INSERT INTO emprestimos (
        cliente_id, valor, data_emprestimo, data_vencimento, juros_mensal, multa_atraso, observacoes,
        tipo_emprestimo, numero_parcelas, frequencia, valor_parcela, tipo_calculo
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      clienteId,
      1500.00, // valor inicial (igual ao final para valor_final)
      '2024-01-15',
      '2024-02-15',
      0.00, // sem juros percentual
      2.00,
      'Teste valor final fixo',
      'in_installments',
      3,
      'monthly',
      500.00, // 1500 / 3
      'valor_final'
    ]);
    
    const emprestimoId1 = emprestimoResult1.insertId;
    console.log(`Empréstimo 1 criado com ID: ${emprestimoId1}`);

    // 3. Testar empréstimo com parcela fixa
    console.log('\n3. Testando empréstimo com parcela fixa...');
    console.log('Dados: Valor Parcela = R$ 1000, Parcelas = 10');
    
    const [emprestimoResult2] = await dbConnection.execute(`
      INSERT INTO emprestimos (
        cliente_id, valor, data_emprestimo, data_vencimento, juros_mensal, multa_atraso, observacoes,
        tipo_emprestimo, numero_parcelas, frequencia, valor_parcela, tipo_calculo
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      clienteId,
      10000.00, // valor inicial (1000 * 10)
      '2024-01-15',
      '2024-02-15',
      0.00, // sem juros percentual
      2.00,
      'Teste parcela fixa',
      'in_installments',
      10,
      'monthly',
      1000.00, // valor fixo da parcela
      'parcela_fixa'
    ]);
    
    const emprestimoId2 = emprestimoResult2.insertId;
    console.log(`Empréstimo 2 criado com ID: ${emprestimoId2}`);

    // 4. Criar parcelas para o primeiro empréstimo
    console.log('\n4. Criando parcelas para empréstimo 1...');
    const dataPrimeiraParcela1 = new Date('2024-02-15');
    
    for (let i = 1; i <= 3; i++) {
      const dataVencimento = new Date(dataPrimeiraParcela1);
      dataVencimento.setMonth(dataVencimento.getMonth() + (i - 1));
      
      await dbConnection.execute(`
        INSERT INTO parcelas (emprestimo_id, numero_parcela, valor_parcela, data_vencimento)
        VALUES (?, ?, ?, ?)
      `, [emprestimoId1, i, 500.00, dataVencimento.toISOString().split('T')[0]]);
    }
    
    console.log('3 parcelas criadas para empréstimo 1');

    // 5. Criar parcelas para o segundo empréstimo
    console.log('\n5. Criando parcelas para empréstimo 2...');
    const dataPrimeiraParcela2 = new Date('2024-02-15');
    
    for (let i = 1; i <= 10; i++) {
      const dataVencimento = new Date(dataPrimeiraParcela2);
      dataVencimento.setMonth(dataVencimento.getMonth() + (i - 1));
      
      await dbConnection.execute(`
        INSERT INTO parcelas (emprestimo_id, numero_parcela, valor_parcela, data_vencimento)
        VALUES (?, ?, ?, ?)
      `, [emprestimoId2, i, 1000.00, dataVencimento.toISOString().split('T')[0]]);
    }
    
    console.log('10 parcelas criadas para empréstimo 2');

    // 6. Verificar empréstimos criados
    console.log('\n6. Verificando empréstimos criados...');
    
    const [emprestimos] = await dbConnection.execute(`
      SELECT id, cliente_id, valor, tipo_emprestimo, numero_parcelas, valor_parcela, tipo_calculo, observacoes
      FROM emprestimos 
      WHERE id IN (?, ?)
      ORDER BY id
    `, [emprestimoId1, emprestimoId2]);
    
    console.log('Empréstimos criados:');
    emprestimos.forEach(emp => {
      console.log(`  ID: ${emp.id}`);
      console.log(`  Tipo: ${emp.tipo_emprestimo}`);
      console.log(`  Tipo Cálculo: ${emp.tipo_calculo}`);
      console.log(`  Valor: R$ ${emp.valor}`);
      console.log(`  Parcelas: ${emp.numero_parcelas}`);
      console.log(`  Valor Parcela: R$ ${emp.valor_parcela}`);
      console.log(`  Observações: ${emp.observacoes}`);
      console.log('');
    });

    // 7. Verificar parcelas criadas
    console.log('\n7. Verificando parcelas criadas...');
    
    const [parcelas] = await dbConnection.execute(`
      SELECT emprestimo_id, numero_parcela, valor_parcela, data_vencimento
      FROM parcelas 
      WHERE emprestimo_id IN (?, ?)
      ORDER BY emprestimo_id, numero_parcela
    `, [emprestimoId1, emprestimoId2]);
    
    console.log('Parcelas criadas:');
    parcelas.forEach(parcela => {
      console.log(`  Empréstimo ${parcela.emprestimo_id} - Parcela ${parcela.numero_parcela}: R$ ${parcela.valor_parcela} - Vencimento: ${parcela.data_vencimento}`);
    });

    // 8. Limpeza
    console.log('\n8. Limpando dados de teste...');
    
    await dbConnection.execute('DELETE FROM parcelas WHERE emprestimo_id IN (?, ?)', [emprestimoId1, emprestimoId2]);
    await dbConnection.execute('DELETE FROM emprestimos WHERE id IN (?, ?)', [emprestimoId1, emprestimoId2]);
    await dbConnection.execute('DELETE FROM clientes_cobrancas WHERE id = ?', [clienteId]);
    
    console.log('Dados de teste removidos');

    await dbConnection.end();
    await connection.end();
    
    console.log('\n✅ Teste concluído com sucesso!');

  } catch (error) {
    console.error('❌ Erro no teste:', error);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  testValorFixoEmprestimos();
}

module.exports = { testValorFixoEmprestimos }; 