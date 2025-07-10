const mysql = require('mysql2/promise');

// Configuração do banco de dados
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'jp_cobrancas',
  charset: 'utf8mb4'
};

async function testEmprestimoQuitadoFix() {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('🔗 Conectado ao banco de dados');
    
    // 1. Buscar empréstimos ativos com parcelas
    console.log('\n📋 Buscando empréstimos ativos com parcelas...');
    const [emprestimos] = await connection.execute(`
      SELECT e.id, e.cliente_id, e.status, e.valor, e.tipo_emprestimo, e.numero_parcelas,
             c.nome as cliente_nome
      FROM emprestimos e
      LEFT JOIN clientes_cobrancas c ON e.cliente_id = c.id
      WHERE e.status IN ('Ativo', 'Pendente')
      ORDER BY e.id DESC
      LIMIT 5
    `);
    
    console.log(`📊 Encontrados ${emprestimos.length} empréstimos ativos`);
    
    for (const emprestimo of emprestimos) {
      console.log(`\n📝 Empréstimo ID: ${emprestimo.id}`);
      console.log(`   Cliente: ${emprestimo.cliente_nome}`);
      console.log(`   Status: ${emprestimo.status}`);
      console.log(`   Valor: R$ ${emprestimo.valor}`);
      console.log(`   Tipo: ${emprestimo.tipo_emprestimo || 'fixed'}`);
      console.log(`   Parcelas: ${emprestimo.numero_parcelas || 1}`);
      
      // Buscar parcelas do empréstimo
      const [parcelas] = await connection.execute(`
        SELECT numero_parcela, valor_parcela, data_vencimento, status
        FROM parcelas
        WHERE emprestimo_id = ?
        ORDER BY numero_parcela
      `, [emprestimo.id]);
      
      if (parcelas.length > 0) {
        console.log(`   📅 Parcelas encontradas: ${parcelas.length}`);
        for (const parcela of parcelas) {
          console.log(`      ${parcela.numero_parcela}: R$ ${parcela.valor_parcela} - ${parcela.data_vencimento} - ${parcela.status}`);
        }
      } else {
        console.log(`   📄 Empréstimo sem parcelas (valor fixo)`);
      }
    }
    
    // 2. Simular marcação como quitado
    if (emprestimos.length > 0) {
      const emprestimoTeste = emprestimos[0];
      console.log(`\n🧪 Simulando marcação como quitado para empréstimo ID: ${emprestimoTeste.id}`);
      
      // Verificar parcelas ANTES da marcação
      const [parcelasAntes] = await connection.execute(`
        SELECT numero_parcela, status, data_pagamento
        FROM parcelas
        WHERE emprestimo_id = ?
        ORDER BY numero_parcela
      `, [emprestimoTeste.id]);
      
      console.log(`📋 Parcelas ANTES da marcação:`);
      if (parcelasAntes.length > 0) {
        for (const parcela of parcelasAntes) {
          console.log(`   ${parcela.numero_parcela}: ${parcela.status} ${parcela.data_pagamento ? `(pago em ${parcela.data_pagamento})` : ''}`);
        }
      } else {
        console.log(`   Nenhuma parcela encontrada`);
      }
      
      // Simular o endpoint de marcação como quitado
      await connection.execute(
        'UPDATE emprestimos SET status = ? WHERE id = ?',
        ['Quitado', emprestimoTeste.id]
      );
      
      // Marcar cobranças como pagas
      await connection.execute('UPDATE cobrancas SET status = ? WHERE emprestimo_id = ?', ['Paga', emprestimoTeste.id]);
      
      // Marcar todas as parcelas como pagas
      const hoje = new Date().toISOString().split('T')[0];
      const [parcelasUpdate] = await connection.execute(`
        UPDATE parcelas 
        SET status = 'Paga', 
            data_pagamento = ?, 
            valor_pago = COALESCE(valor_pago, valor_parcela),
            updated_at = CURRENT_TIMESTAMP
        WHERE emprestimo_id = ? AND status != 'Paga'
      `, [hoje, emprestimoTeste.id]);
      
      console.log(`✅ Empréstimo atualizado - ${parcelasUpdate.affectedRows} parcelas marcadas como pagas`);
      
      // Verificar parcelas DEPOIS da marcação
      const [parcelasDepois] = await connection.execute(`
        SELECT numero_parcela, status, data_pagamento
        FROM parcelas
        WHERE emprestimo_id = ?
        ORDER BY numero_parcela
      `, [emprestimoTeste.id]);
      
      console.log(`📋 Parcelas DEPOIS da marcação:`);
      if (parcelasDepois.length > 0) {
        for (const parcela of parcelasDepois) {
          console.log(`   ${parcela.numero_parcela}: ${parcela.status} ${parcela.data_pagamento ? `(pago em ${parcela.data_pagamento})` : ''}`);
        }
      } else {
        console.log(`   Nenhuma parcela encontrada`);
      }
      
      // Verificar status final do empréstimo
      const [emprestimoFinal] = await connection.execute(`
        SELECT id, status FROM emprestimos WHERE id = ?
      `, [emprestimoTeste.id]);
      
      console.log(`📊 Status final do empréstimo: ${emprestimoFinal[0].status}`);
      
      // Reverter para teste (opcional)
      console.log(`\n🔄 Revertendo alterações de teste...`);
      await connection.execute(
        'UPDATE emprestimos SET status = ? WHERE id = ?',
        ['Ativo', emprestimoTeste.id]
      );
      await connection.execute('UPDATE cobrancas SET status = ? WHERE emprestimo_id = ?', ['Pendente', emprestimoTeste.id]);
      await connection.execute(`
        UPDATE parcelas 
        SET status = 'Pendente', 
            data_pagamento = NULL, 
            valor_pago = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE emprestimo_id = ?
      `, [emprestimoTeste.id]);
      
      console.log(`✅ Teste concluído - alterações revertidas`);
    }
    
    // 3. Testar lógica de determinação de status
    console.log(`\n🧪 Testando lógica de determinação de status...`);
    
    const [emprestimosComParcelas] = await connection.execute(`
      SELECT e.id, e.status, COUNT(p.id) as total_parcelas,
             SUM(CASE WHEN p.status = 'Paga' THEN 1 ELSE 0 END) as parcelas_pagas
      FROM emprestimos e
      LEFT JOIN parcelas p ON p.emprestimo_id = e.id
      GROUP BY e.id
      HAVING COUNT(p.id) > 0
      LIMIT 3
    `);
    
    for (const emp of emprestimosComParcelas) {
      console.log(`\n📝 Empréstimo ID: ${emp.id}`);
      console.log(`   Status na DB: ${emp.status}`);
      console.log(`   Total parcelas: ${emp.total_parcelas}`);
      console.log(`   Parcelas pagas: ${emp.parcelas_pagas}`);
      
      let statusReal = 'ATIVO';
      if (emp.parcelas_pagas === emp.total_parcelas) {
        statusReal = 'QUITADO';
      } else if (emp.parcelas_pagas > 0) {
        statusReal = 'PARCIALMENTE_PAGO';
      }
      
      console.log(`   Status calculado: ${statusReal}`);
      console.log(`   Consistente: ${emp.status === statusReal || (emp.status === 'Quitado' && statusReal === 'QUITADO') ? '✅' : '❌'}`);
    }
    
    console.log(`\n🎉 Teste concluído com sucesso!`);
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
    console.error('Detalhes:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Conexão com banco encerrada');
    }
  }
}

// Executar o teste
testEmprestimoQuitadoFix().catch(console.error); 