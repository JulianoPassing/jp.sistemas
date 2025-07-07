const fetch = require('node-fetch');

async function testEmprestimosAPI() {
  const baseURL = 'https://jp-sistemas.com/api/cobrancas';
  
  try {
    console.log('🧪 Testando API de Empréstimos...\n');
    
    // 1. Testar GET /emprestimos
    console.log('1. Testando GET /emprestimos...');
    const emprestimosResponse = await fetch(`${baseURL}/emprestimos`);
    console.log(`   Status: ${emprestimosResponse.status}`);
    
    if (emprestimosResponse.ok) {
      const emprestimos = await emprestimosResponse.json();
      console.log(`   Total de empréstimos: ${emprestimos.length}`);
    } else {
      const error = await emprestimosResponse.text();
      console.log(`   Erro: ${error}`);
    }
    
    // 2. Testar POST /emprestimos com dados válidos
    console.log('\n2. Testando POST /emprestimos...');
    const testData = {
      cliente_id: 1,
      valor: 1000.00,
      data_emprestimo: '2024-01-15',
      data_vencimento: '2024-02-15',
      juros_mensal: 5.00,
      multa_atraso: 2.00,
      observacoes: 'Teste de criação de empréstimo'
    };
    
    console.log('   Dados de teste:', testData);
    
    const createResponse = await fetch(`${baseURL}/emprestimos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });
    
    console.log(`   Status: ${createResponse.status}`);
    
    if (createResponse.ok) {
      const result = await createResponse.json();
      console.log(`   Sucesso: ${JSON.stringify(result)}`);
    } else {
      const error = await createResponse.text();
      console.log(`   Erro: ${error}`);
    }
    
    // 3. Verificar se o empréstimo foi criado
    console.log('\n3. Verificando se o empréstimo foi criado...');
    const emprestimosResponse2 = await fetch(`${baseURL}/emprestimos`);
    
    if (emprestimosResponse2.ok) {
      const emprestimos = await emprestimosResponse2.json();
      console.log(`   Total de empréstimos após criação: ${emprestimos.length}`);
      
      if (emprestimos.length > 0) {
        const ultimoEmprestimo = emprestimos[emprestimos.length - 1];
        console.log(`   Último empréstimo:`, {
          id: ultimoEmprestimo.id,
          cliente_id: ultimoEmprestimo.cliente_id,
          valor: ultimoEmprestimo.valor,
          status: ultimoEmprestimo.status
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
}

testEmprestimosAPI(); 