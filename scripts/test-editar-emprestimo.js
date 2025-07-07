const mysql = require('mysql2/promise');

// Configurações do banco de dados
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'jp_cobrancas_test'
};

async function testEditarEmprestimo() {
  let connection;
  
  try {
    console.log('🔍 Testando funcionalidade de edição de empréstimos...\n');
    
    // Conectar ao banco
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conectado ao banco de dados');
    
    // 1. Criar um empréstimo de teste
    console.log('\n📝 Criando empréstimo de teste...');
    
    const [result] = await connection.execute(`
      INSERT INTO emprestimos (
        cliente_id, valor, juros_mensal, data_vencimento, 
        frequencia_pagamento, numero_parcelas, status, observacoes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [1, 1000, 10, '2024-01-15', 'monthly', 1, 'Ativo', 'Teste inicial']);
    
    const emprestimoId = result.insertId;
    console.log(`✅ Empréstimo criado com ID: ${emprestimoId}`);
    
    // 2. Buscar empréstimo criado
    console.log('\n🔍 Buscando empréstimo criado...');
    const [emprestimos] = await connection.execute(
      'SELECT * FROM emprestimos WHERE id = ?',
      [emprestimoId]
    );
    
    console.log('📋 Dados originais:');
    console.log(`   Valor: R$ ${emprestimos[0].valor}`);
    console.log(`   Juros: ${emprestimos[0].juros_mensal}%`);
    console.log(`   Parcelas: ${emprestimos[0].numero_parcelas}`);
    console.log(`   Status: ${emprestimos[0].status}`);
    
    // 3. Testar atualização
    console.log('\n✏️ Testando atualização do empréstimo...');
    
    const dadosAtualizacao = {
      cliente_id: 1,
      valor: 2000,
      juros_mensal: 15,
      data_vencimento: '2024-02-15',
      frequencia_pagamento: 'monthly',
      numero_parcelas: 3,
      status: 'Ativo',
      observacoes: 'Teste atualizado'
    };
    
    await connection.execute(`
      UPDATE emprestimos 
      SET cliente_id = ?, 
          valor = ?, 
          juros_mensal = ?, 
          data_vencimento = ?, 
          frequencia_pagamento = ?, 
          numero_parcelas = ?, 
          status = ?, 
          observacoes = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      dadosAtualizacao.cliente_id,
      dadosAtualizacao.valor,
      dadosAtualizacao.juros_mensal,
      dadosAtualizacao.data_vencimento,
      dadosAtualizacao.frequencia_pagamento,
      dadosAtualizacao.numero_parcelas,
      dadosAtualizacao.status,
      dadosAtualizacao.observacoes,
      emprestimoId
    ]);
    
    console.log('✅ Empréstimo atualizado com sucesso');
    
    // 4. Criar parcelas (se necessário)
    if (dadosAtualizacao.numero_parcelas > 1) {
      console.log('\n📋 Criando parcelas...');
      
      const valorParcela = dadosAtualizacao.valor / dadosAtualizacao.numero_parcelas;
      const dataVencimento = new Date(dadosAtualizacao.data_vencimento);
      
      for (let i = 1; i <= dadosAtualizacao.numero_parcelas; i++) {
        const dataParcelaVencimento = new Date(dataVencimento);
        dataParcelaVencimento.setMonth(dataParcelaVencimento.getMonth() + (i - 1));
        
        await connection.execute(`
          INSERT INTO parcelas (emprestimo_id, numero_parcela, valor_parcela, data_vencimento, status)
          VALUES (?, ?, ?, ?, ?)
        `, [emprestimoId, i, valorParcela, dataParcelaVencimento.toISOString().split('T')[0], 'Pendente']);
      }
      
      console.log(`✅ ${dadosAtualizacao.numero_parcelas} parcelas criadas`);
    }
    
    // 5. Verificar resultado
    console.log('\n🔍 Verificando resultado final...');
    const [emprestimosAtualizados] = await connection.execute(
      'SELECT * FROM emprestimos WHERE id = ?',
      [emprestimoId]
    );
    
    console.log('📋 Dados atualizados:');
    console.log(`   Valor: R$ ${emprestimosAtualizados[0].valor}`);
    console.log(`   Juros: ${emprestimosAtualizados[0].juros_mensal}%`);
    console.log(`   Parcelas: ${emprestimosAtualizados[0].numero_parcelas}`);
    console.log(`   Status: ${emprestimosAtualizados[0].status}`);
    console.log(`   Observações: ${emprestimosAtualizados[0].observacoes}`);
    
    // 6. Verificar parcelas
    if (dadosAtualizacao.numero_parcelas > 1) {
      const [parcelas] = await connection.execute(
        'SELECT * FROM parcelas WHERE emprestimo_id = ? ORDER BY numero_parcela',
        [emprestimoId]
      );
      
      console.log('\n📋 Parcelas criadas:');
      parcelas.forEach(parcela => {
        console.log(`   Parcela ${parcela.numero_parcela}: R$ ${parcela.valor_parcela} - Vencimento: ${parcela.data_vencimento}`);
      });
    }
    
    // 7. Limpeza
    console.log('\n🧹 Limpando dados de teste...');
    await connection.execute('DELETE FROM parcelas WHERE emprestimo_id = ?', [emprestimoId]);
    await connection.execute('DELETE FROM emprestimos WHERE id = ?', [emprestimoId]);
    console.log('✅ Dados de teste removidos');
    
    console.log('\n🎉 Teste de edição de empréstimo concluído com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Conexão com banco de dados encerrada');
    }
  }
}

// Executar teste
testEditarEmprestimo(); 