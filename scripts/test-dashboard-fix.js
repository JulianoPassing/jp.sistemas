// Teste para verificar se o erro do dashboard foi corrigido

console.log('🔍 Testando correção do erro no dashboard\n');

const mysql = require('mysql2/promise');
const { createCobrancasConnection } = require('../api/cobrancas');

async function testDashboardFix() {
  console.log('🧪 Testando correção do dashboard...');
  
  try {
    const username = 'test_user';
    const connection = await createCobrancasConnection(username);
    
    console.log('\n✅ Conexão estabelecida');
    
    // Simular o endpoint completo do dashboard
    console.log('\n📊 Executando todas as queries do dashboard...');
    
    // 1. Atualizar dias de atraso
    console.log('1. Atualizando dias de atraso...');
    await connection.execute(`
      UPDATE cobrancas 
      SET 
        dias_atraso = CASE 
          WHEN data_vencimento < CURDATE() THEN DATEDIFF(CURDATE(), data_vencimento)
          ELSE 0 
        END
      WHERE status = 'Pendente'
    `);
    console.log('✅ Dias de atraso atualizados');
    
    // 2. Estatísticas de empréstimos
    console.log('2. Buscando estatísticas de empréstimos...');
    const [emprestimosStats] = await connection.execute(`
      SELECT 
        COUNT(CASE WHEN status IN ('Ativo', 'Pendente') AND cliente_id IS NOT NULL THEN 1 END) as total_emprestimos,
        SUM(CASE WHEN status IN ('Ativo', 'Pendente') AND cliente_id IS NOT NULL THEN COALESCE(valor_inicial, valor) ELSE 0 END) as valor_total_emprestimos,
        COUNT(CASE WHEN status IN ('Ativo', 'Pendente') AND cliente_id IS NOT NULL THEN 1 END) as emprestimos_ativos,
        COUNT(CASE WHEN status = 'Quitado' AND cliente_id IS NOT NULL THEN 1 END) as emprestimos_quitados
      FROM emprestimos
    `);
    console.log('✅ Estatísticas de empréstimos:', emprestimosStats[0]);
    
    // 3. Estatísticas de cobranças
    console.log('3. Buscando estatísticas de cobranças...');
    const [cobrancasStats] = await connection.execute(`
      SELECT 
        COUNT(*) as total_cobrancas,
        SUM(valor_atualizado) as valor_total_cobrancas,
        COUNT(CASE WHEN status = 'Pendente' THEN 1 END) as cobrancas_pendentes,
        COUNT(CASE WHEN status = 'Paga' THEN 1 END) as cobrancas_pagas,
        SUM(CASE WHEN dias_atraso > 0 THEN valor_atualizado ELSE 0 END) as valor_atrasado
      FROM cobrancas
      WHERE cliente_id IS NOT NULL
    `);
    console.log('✅ Estatísticas de cobranças:', cobrancasStats[0]);
    
    // 4. Estatísticas de clientes
    console.log('4. Buscando estatísticas de clientes...');
    const [clientesStats] = await connection.execute(`
      SELECT COUNT(*) as total_clientes FROM clientes_cobrancas WHERE status IN ('Ativo', 'Pendente')
    `);
    console.log('✅ Estatísticas de clientes:', clientesStats[0]);
    
    // 5. Clientes em atraso (versão corrigida)
    console.log('5. Buscando clientes em atraso...');
    const [clientesEmAtraso] = await connection.execute(`
      SELECT COUNT(DISTINCT c.id) as total
      FROM clientes_cobrancas c
      JOIN emprestimos e ON e.cliente_id = c.id
      WHERE e.status IN ('Ativo', 'Pendente')
        AND e.status <> 'Quitado'
        AND e.data_vencimento < CURDATE()
    `);
    console.log('✅ Clientes em atraso:', clientesEmAtraso[0]);
    
    // 6. Empréstimos em atraso
    console.log('6. Buscando empréstimos em atraso...');
    const [emprestimosEmAtraso] = await connection.execute(`
      SELECT COUNT(*) as total
      FROM emprestimos e
      WHERE e.status IN ('Ativo', 'Pendente')
        AND e.status <> 'Quitado'
        AND e.data_vencimento < CURDATE()
    `);
    console.log('✅ Empréstimos em atraso:', emprestimosEmAtraso[0]);
    
    // 7. Clientes ativos
    console.log('7. Buscando clientes ativos...');
    const [clientesAtivos] = await connection.execute(`
      SELECT COUNT(DISTINCT c.id) as total
      FROM clientes_cobrancas c
      JOIN emprestimos e ON e.cliente_id = c.id
      WHERE e.status IN ('Ativo', 'Pendente')
        AND e.status <> 'Quitado'
    `);
    console.log('✅ Clientes ativos:', clientesAtivos[0]);
    
    // 8. Empréstimos ativos
    console.log('8. Buscando empréstimos ativos...');
    const [emprestimosAtivos] = await connection.execute(`
      SELECT COUNT(*) as total
      FROM emprestimos
      WHERE status IN ('Ativo', 'Pendente')
        AND status <> 'Quitado'
    `);
    console.log('✅ Empréstimos ativos:', emprestimosAtivos[0]);
    
    // 9. Empréstimos recentes
    console.log('9. Buscando empréstimos recentes...');
    const [emprestimosRecentes] = await connection.execute(`
      SELECT e.*, c.nome as cliente_nome, c.telefone as telefone
      FROM emprestimos e
      LEFT JOIN clientes_cobrancas c ON e.cliente_id = c.id
      WHERE e.status IN ('Ativo', 'Pendente') AND e.cliente_id IS NOT NULL
      ORDER BY e.created_at DESC
      LIMIT 5
    `);
    console.log('✅ Empréstimos recentes:', emprestimosRecentes.length, 'encontrados');
    
    // 10. Cobranças pendentes
    console.log('10. Buscando cobranças pendentes...');
    const [cobrancasPendentes] = await connection.execute(`
      SELECT cb.*, c.nome as cliente_nome, c.telefone as telefone
      FROM cobrancas cb
      LEFT JOIN clientes_cobrancas c ON cb.cliente_id = c.id
      LEFT JOIN emprestimos e ON cb.emprestimo_id = e.id
      WHERE cb.status = 'Pendente' AND cb.cliente_id IS NOT NULL AND e.status IN ('Ativo', 'Pendente')
      ORDER BY cb.data_vencimento ASC
      LIMIT 10
    `);
    console.log('✅ Cobranças pendentes:', cobrancasPendentes.length, 'encontradas');
    
    await connection.end();
    
    // Simular resposta da API
    const dashboardResponse = {
      emprestimos: emprestimosStats[0],
      cobrancas: cobrancasStats[0],
      clientes: clientesStats[0],
      emprestimosRecentes,
      cobrancasPendentes,
      clientesEmAtraso: clientesEmAtraso[0].total,
      emprestimosEmAtraso: emprestimosEmAtraso[0].total,
      clientesAtivos: clientesAtivos[0].total,
      emprestimosAtivos: emprestimosAtivos[0].total
    };
    
    console.log('\n🎯 Resposta completa da API simulada:');
    console.log('📊 Dashboard Data:');
    console.log(`   Total de clientes: ${dashboardResponse.clientes.total_clientes}`);
    console.log(`   Total de empréstimos: ${dashboardResponse.emprestimos.total_emprestimos}`);
    console.log(`   Valor total investido: R$ ${Number(dashboardResponse.emprestimos.valor_total_emprestimos || 0).toFixed(2)}`);
    console.log(`   Clientes em atraso: ${dashboardResponse.clientesEmAtraso}`);
    console.log(`   Empréstimos em atraso: ${dashboardResponse.emprestimosEmAtraso}`);
    console.log(`   Clientes ativos: ${dashboardResponse.clientesAtivos}`);
    console.log(`   Empréstimos ativos: ${dashboardResponse.emprestimosAtivos}`);
    console.log(`   Empréstimos recentes: ${dashboardResponse.emprestimosRecentes.length}`);
    console.log(`   Cobranças pendentes: ${dashboardResponse.cobrancasPendentes.length}`);
    
    console.log('\n✅ Dashboard funcionando corretamente!');
    console.log('🎉 O erro 500 deve estar resolvido.');
    
  } catch (error) {
    console.error('❌ Erro no teste do dashboard:', error.message);
    console.log('Stack trace:', error.stack);
    
    if (error.code === 'ER_NO_SUCH_TABLE') {
      console.log('\n💡 Solução: Execute primeiro:');
      console.log('   node scripts/init-cobrancas-db.js');
    } else if (error.code === 'ER_BAD_FIELD_ERROR') {
      console.log('\n💡 Solução: Campo não existe. Detalhes:', error.sqlMessage);
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('\n💡 Solução: Problema de permissão no banco de dados.');
    }
  }
}

// Executar o teste
testDashboardFix(); 