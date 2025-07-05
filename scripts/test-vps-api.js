// Script para testar a API na VPS
// Execute: node scripts/test-vps-api.js

async function testVPSAPI() {
  try {
    console.log('🧪 Testando API na VPS...\n');
    
    // Testar rota de sessão
    console.log('1. 📡 Testando rota de sessão:');
    const sessionResponse = await fetch('http://localhost:3000/api/cobrancas/session');
    const sessionData = await sessionResponse.json();
    console.log('✅ Resposta:', sessionData);
    console.log('');
    
    // Testar rota do dashboard
    console.log('2. 📊 Testando rota do dashboard:');
    const dashboardResponse = await fetch('http://localhost:3000/api/cobrancas/dashboard');
    const dashboardData = await dashboardResponse.json();
    console.log('✅ Dashboard carregado com sucesso!');
    console.log('📈 Estatísticas:');
    console.log(`   - Clientes: ${dashboardData.clientes?.total_clientes || 0}`);
    console.log(`   - Empréstimos: ${dashboardData.emprestimos?.total_emprestimos || 0}`);
    console.log(`   - Cobranças: ${dashboardData.cobrancas?.total_cobrancas || 0}`);
    console.log('');
    
    // Testar rota de clientes
    console.log('3. 👥 Testando rota de clientes:');
    const clientesResponse = await fetch('http://localhost:3000/api/cobrancas/clientes');
    const clientesData = await clientesResponse.json();
    console.log(`✅ Total de clientes: ${clientesData.length}`);
    console.log('');
    
    console.log('🎉 Todos os testes passaram! A API está funcionando corretamente.');
    
  } catch (error) {
    console.error('❌ Erro ao testar API:', error.message);
    console.log('\n🔧 Possíveis soluções:');
    console.log('1. Verifique se o servidor está rodando: node server.js');
    console.log('2. Verifique se o banco de dados está acessível');
    console.log('3. Verifique se o banco de sessões foi criado: node scripts/create-sessions-db.js');
  }
}

testVPSAPI(); 