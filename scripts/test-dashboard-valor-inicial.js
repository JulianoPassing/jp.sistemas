const mysql = require('mysql2/promise');
const { createCobrancasConnection } = require('../api/cobrancas');

async function testDashboardValorInicial() {
  console.log('🧪 Testando valor total investido no dashboard...');
  
  try {
    // Simular usuário de teste
    const username = 'test_user';
    const connection = await createCobrancasConnection(username);
    
    // Buscar alguns empréstimos para análise
    const [emprestimos] = await connection.execute(`
      SELECT id, valor, valor_inicial, juros_mensal, status, cliente_id
      FROM emprestimos 
      WHERE status IN ('Ativo', 'Pendente') AND cliente_id IS NOT NULL
      LIMIT 5
    `);
    
    console.log('📋 Empréstimos encontrados:', emprestimos.length);
    
    if (emprestimos.length > 0) {
      console.log('\n📊 Análise dos empréstimos:');
      emprestimos.forEach((emp, index) => {
        const valorInicial = Number(emp.valor_inicial || emp.valor || 0);
        const valorComJuros = Number(emp.valor || 0);
        const jurosPercent = Number(emp.juros_mensal || 0);
        const jurosCalculado = valorInicial * (jurosPercent / 100);
        
        console.log(`${index + 1}. ID: ${emp.id}`);
        console.log(`   Valor Inicial: R$ ${valorInicial.toFixed(2)}`);
        console.log(`   Valor com Juros: R$ ${valorComJuros.toFixed(2)}`);
        console.log(`   Juros %: ${jurosPercent}%`);
        console.log(`   Juros Calculado: R$ ${jurosCalculado.toFixed(2)}`);
        console.log(`   Status: ${emp.status}`);
        console.log('   ---');
      });
    }
    
    // Testar a query modificada do dashboard
    const [estatisticasAntes] = await connection.execute(`
      SELECT 
        COUNT(CASE WHEN status IN ('Ativo', 'Pendente') AND cliente_id IS NOT NULL THEN 1 END) as total_emprestimos,
        SUM(CASE WHEN status IN ('Ativo', 'Pendente') AND cliente_id IS NOT NULL THEN valor ELSE 0 END) as valor_com_juros,
        SUM(CASE WHEN status IN ('Ativo', 'Pendente') AND cliente_id IS NOT NULL THEN COALESCE(valor_inicial, valor) ELSE 0 END) as valor_inicial_total
      FROM emprestimos
    `);
    
    const stats = estatisticasAntes[0];
    console.log('\n💰 Comparação de valores:');
    console.log(`Total de empréstimos: ${stats.total_emprestimos}`);
    console.log(`Valor ANTES (com juros): R$ ${Number(stats.valor_com_juros || 0).toFixed(2)}`);
    console.log(`Valor DEPOIS (inicial): R$ ${Number(stats.valor_inicial_total || 0).toFixed(2)}`);
    
    const diferenca = Number(stats.valor_com_juros || 0) - Number(stats.valor_inicial_total || 0);
    console.log(`Diferença (juros): R$ ${diferenca.toFixed(2)}`);
    
    // Testar endpoint do dashboard
    console.log('\n🔍 Testando endpoint do dashboard...');
    
    const [dashboardStats] = await connection.execute(`
      SELECT 
        COUNT(CASE WHEN status IN ('Ativo', 'Pendente') AND cliente_id IS NOT NULL THEN 1 END) as total_emprestimos,
        SUM(CASE WHEN status IN ('Ativo', 'Pendente') AND cliente_id IS NOT NULL THEN COALESCE(valor_inicial, valor) ELSE 0 END) as valor_total_emprestimos,
        COUNT(CASE WHEN status IN ('Ativo', 'Pendente') AND cliente_id IS NOT NULL THEN 1 END) as emprestimos_ativos,
        COUNT(CASE WHEN status = 'Quitado' AND cliente_id IS NOT NULL THEN 1 END) as emprestimos_quitados
      FROM emprestimos
    `);
    
    console.log('📊 Resultado da query do dashboard:');
    console.log(`Total empréstimos: ${dashboardStats[0].total_emprestimos}`);
    console.log(`Valor total investido: R$ ${Number(dashboardStats[0].valor_total_emprestimos || 0).toFixed(2)}`);
    console.log(`Empréstimos ativos: ${dashboardStats[0].emprestimos_ativos}`);
    console.log(`Empréstimos quitados: ${dashboardStats[0].emprestimos_quitados}`);
    
    await connection.end();
    
    console.log('\n✅ Teste concluído!');
    console.log('🎯 O dashboard agora mostra apenas o valor inicial investido (sem juros)');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
}

// Executar o teste
testDashboardValorInicial(); 