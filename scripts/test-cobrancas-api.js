// Usando fetch nativo do Node.js 18+

async function testAPI() {
  try {
    console.log('Testando API de cobranças...\n');
    
    // Testar rota de sessão
    console.log('1. Testando rota de sessão:');
    const sessionResponse = await fetch('http://localhost:3000/api/cobrancas/session');
    const sessionData = await sessionResponse.json();
    console.log('Resposta:', sessionData);
    console.log('');
    
    // Testar rota do dashboard
    console.log('2. Testando rota do dashboard:');
    const dashboardResponse = await fetch('http://localhost:3000/api/cobrancas/dashboard');
    const dashboardData = await dashboardResponse.json();
    console.log('Resposta:', JSON.stringify(dashboardData, null, 2));
    console.log('');
    
    // Testar rota de clientes
    console.log('3. Testando rota de clientes:');
    const clientesResponse = await fetch('http://localhost:3000/api/cobrancas/clientes');
    const clientesData = await clientesResponse.json();
    console.log('Total de clientes:', clientesData.length);
    console.log('');
    
  } catch (error) {
    console.error('Erro ao testar API:', error);
  }
}

testAPI(); 