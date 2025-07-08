const mysql = require('mysql2/promise');
const { createCobrancasConnection } = require('../api/cobrancas');

async function testClientesAtrasoCorrigido() {
  console.log('🧪 Testando correção dos clientes em atraso...');
  
  try {
    const username = 'test_user';
    const connection = await createCobrancasConnection(username);
    
    // 1. Testar a query antiga (problemática)
    console.log('\n📊 Query ANTIGA (problemática):');
    const [clientesAtrasoAntiga] = await connection.execute(`
      SELECT COUNT(DISTINCT c.id) as total
      FROM clientes_cobrancas c
      JOIN emprestimos e ON e.cliente_id = c.id
      WHERE e.status IN ('Ativo', 'Pendente')
        AND e.data_vencimento < CURDATE()
        AND e.status <> 'Quitado'
    `);
    console.log(`Resultado da query antiga: ${clientesAtrasoAntiga[0].total} clientes`);
    
    // 2. Testar a query nova (corrigida)
    console.log('\n✅ Query NOVA (corrigida):');
    const [clientesAtrasoNova] = await connection.execute(`
      SELECT COUNT(DISTINCT c.id) as total
      FROM clientes_cobrancas c
      JOIN emprestimos e ON e.cliente_id = c.id
      WHERE e.status IN ('Ativo', 'Pendente')
        AND e.status <> 'Quitado'
        AND (
          -- Para empréstimos de parcela única
          (e.tipo_emprestimo != 'in_installments' AND e.data_vencimento < CURDATE())
          OR
          -- Para empréstimos parcelados, verificar se há parcelas atrasadas
          (e.tipo_emprestimo = 'in_installments' AND EXISTS (
            SELECT 1 FROM parcelas p 
            WHERE p.emprestimo_id = e.id 
              AND p.data_vencimento < CURDATE() 
              AND p.status != 'Paga'
          ))
        )
    `);
    console.log(`Resultado da query nova: ${clientesAtrasoNova[0].total} clientes`);
    
    // 3. Mostrar a diferença
    const diferenca = clientesAtrasoAntiga[0].total - clientesAtrasoNova[0].total;
    console.log(`\n📈 Diferença: ${diferenca} clientes`);
    
    if (diferenca > 0) {
      console.log(`✅ Correção aplicada! Removidos ${diferenca} clientes incorretamente marcados como em atraso.`);
    } else if (diferenca < 0) {
      console.log(`⚠️  A nova query encontrou mais clientes em atraso. Verificar se há casos não cobertos.`);
    } else {
      console.log(`ℹ️  Nenhuma diferença encontrada. Pode não haver empréstimos parcelados ou todos estão corretos.`);
    }
    
    // 4. Verificar detalhes dos empréstimos que eram considerados em atraso incorretamente
    console.log('\n🔍 Empréstimos que eram considerados em atraso incorretamente:');
    const [emprestimosIncorretos] = await connection.execute(`
      SELECT e.id, e.cliente_id, e.status, e.data_vencimento, e.tipo_emprestimo, e.numero_parcelas,
             c.nome as cliente_nome
      FROM clientes_cobrancas c
      JOIN emprestimos e ON e.cliente_id = c.id
      WHERE e.status IN ('Ativo', 'Pendente')
        AND e.data_vencimento < CURDATE()
        AND e.status <> 'Quitado'
        AND NOT (
          -- Para empréstimos de parcela única
          (e.tipo_emprestimo != 'in_installments' AND e.data_vencimento < CURDATE())
          OR
          -- Para empréstimos parcelados, verificar se há parcelas atrasadas
          (e.tipo_emprestimo = 'in_installments' AND EXISTS (
            SELECT 1 FROM parcelas p 
            WHERE p.emprestimo_id = e.id 
              AND p.data_vencimento < CURDATE() 
              AND p.status != 'Paga'
          ))
        )
    `);
    
    if (emprestimosIncorretos.length > 0) {
      console.log(`Encontrados ${emprestimosIncorretos.length} empréstimos que eram considerados em atraso incorretamente:`);
      
      for (const emp of emprestimosIncorretos) {
        console.log(`\n📋 Empréstimo ID: ${emp.id}`);
        console.log(`   Cliente: ${emp.cliente_nome} (ID: ${emp.cliente_id})`);
        console.log(`   Status: ${emp.status}`);
        console.log(`   Data Vencimento: ${emp.data_vencimento}`);
        console.log(`   Tipo: ${emp.tipo_emprestimo}`);
        console.log(`   Parcelas: ${emp.numero_parcelas || 1}`);
        
        // Verificar as parcelas se for parcelado
        if (emp.tipo_emprestimo === 'in_installments' && emp.numero_parcelas > 1) {
          const [parcelas] = await connection.execute(`
            SELECT numero_parcela, data_vencimento, status
            FROM parcelas
            WHERE emprestimo_id = ?
            ORDER BY numero_parcela ASC
          `, [emp.id]);
          
          console.log(`   📦 Parcelas:`);
          const hoje = new Date();
          hoje.setHours(0, 0, 0, 0);
          
          let parcelasAtrasadas = 0;
          parcelas.forEach(p => {
            const dataVenc = new Date(p.data_vencimento);
            const atrasada = dataVenc < hoje && p.status !== 'Paga';
            if (atrasada) parcelasAtrasadas++;
            console.log(`     ${p.numero_parcela}: ${p.status} - ${p.data_vencimento} ${atrasada ? '(ATRASADA)' : ''}`);
          });
          
          console.log(`   ✅ Parcelas atrasadas: ${parcelasAtrasadas}`);
          console.log(`   ✅ Por isso não deve estar em atraso!`);
        }
      }
    } else {
      console.log('Nenhum empréstimo foi considerado em atraso incorretamente.');
    }
    
    // 5. Testar endpoint completo do dashboard
    console.log('\n🌐 Testando endpoint completo do dashboard...');
    
    // Simular a query completa do dashboard
    const [dashboardStats] = await connection.execute(`
      SELECT 
        COUNT(CASE WHEN status IN ('Ativo', 'Pendente') AND cliente_id IS NOT NULL THEN 1 END) as total_emprestimos,
        SUM(CASE WHEN status IN ('Ativo', 'Pendente') AND cliente_id IS NOT NULL THEN COALESCE(valor_inicial, valor) ELSE 0 END) as valor_total_emprestimos,
        COUNT(CASE WHEN status IN ('Ativo', 'Pendente') AND cliente_id IS NOT NULL THEN 1 END) as emprestimos_ativos,
        COUNT(CASE WHEN status = 'Quitado' AND cliente_id IS NOT NULL THEN 1 END) as emprestimos_quitados
      FROM emprestimos
    `);
    
    console.log('📊 Estatísticas do dashboard:');
    console.log(`   Total empréstimos: ${dashboardStats[0].total_emprestimos}`);
    console.log(`   Valor total investido: R$ ${Number(dashboardStats[0].valor_total_emprestimos || 0).toFixed(2)}`);
    console.log(`   Empréstimos ativos: ${dashboardStats[0].emprestimos_ativos}`);
    console.log(`   Empréstimos quitados: ${dashboardStats[0].emprestimos_quitados}`);
    console.log(`   Clientes em atraso (corrigido): ${clientesAtrasoNova[0].total}`);
    
    await connection.end();
    
    console.log('\n🎉 Teste concluído!');
    console.log('✅ A correção deve resolver o problema dos clientes em atraso incorretos.');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
}

// Executar o teste
testClientesAtrasoCorrigido(); 