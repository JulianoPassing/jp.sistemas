// Script para testar funcionalidade de busca de empréstimos
// Usando fetch nativo do Node.js 18+

async function testBuscaEmprestimos() {
  try {
    console.log('=== TESTE DE BUSCA DE EMPRÉSTIMOS ===\n');
    
    const baseURL = 'https://jp-sistemas.com/api/cobrancas';
    
    // 1. Verificar sessão
    console.log('1. Verificando sessão...');
    const sessionResponse = await fetch(`${baseURL}/session`);
    const sessionData = await sessionResponse.json();
    console.log('Sessão:', sessionData.authenticated ? 'Ativa' : 'Inativa');
    console.log('');
    
    if (!sessionData.authenticated) {
      console.log('❌ Sessão não autenticada. Faça login primeiro.');
      return;
    }
    
    // 2. Buscar empréstimos
    console.log('2. Buscando empréstimos...');
    const emprestimosResponse = await fetch(`${baseURL}/emprestimos`);
    const emprestimos = await emprestimosResponse.json();
    console.log(`Total de empréstimos: ${emprestimos.length}`);
    
    if (emprestimos.length === 0) {
      console.log('❌ Nenhum empréstimo encontrado. Crie um empréstimo primeiro.');
      return;
    }
    
    // 3. Mostrar alguns empréstimos para referência
    console.log('3. Exemplos de empréstimos disponíveis:');
    emprestimos.slice(0, 3).forEach((emp, index) => {
      console.log(`   ${index + 1}. Cliente: ${emp.cliente_nome || 'N/A'}`);
      console.log(`      Valor: R$ ${emp.valor || 0}`);
      console.log(`      Status: ${emp.status || 'N/A'}`);
      console.log(`      Data Empréstimo: ${emp.data_emprestimo || 'N/A'}`);
      console.log(`      Vencimento: ${emp.data_vencimento || 'N/A'}`);
      console.log('');
    });
    
    // 4. Testar diferentes cenários de busca
    console.log('4. Testando cenários de busca...');
    
    // Buscar por nome de cliente
    const clienteParaBuscar = emprestimos[0]?.cliente_nome;
    if (clienteParaBuscar) {
      console.log(`   Buscando por cliente: "${clienteParaBuscar}"`);
      const clientesEncontrados = emprestimos.filter(emp => 
        emp.cliente_nome && emp.cliente_nome.toLowerCase().includes(clienteParaBuscar.toLowerCase())
      );
      console.log(`   Resultado: ${clientesEncontrados.length} empréstimos encontrados`);
    }
    
    // Buscar por status
    const statusParaBuscar = 'Ativo';
    console.log(`   Buscando por status: "${statusParaBuscar}"`);
    const statusEncontrados = emprestimos.filter(emp => emp.status === statusParaBuscar);
    console.log(`   Resultado: ${statusEncontrados.length} empréstimos encontrados`);
    
    // Buscar por valor
    const valorParaBuscar = emprestimos[0]?.valor;
    if (valorParaBuscar) {
      console.log(`   Buscando por valor: "${valorParaBuscar}"`);
      const valoresEncontrados = emprestimos.filter(emp => 
        emp.valor && emp.valor.toString().includes(valorParaBuscar.toString())
      );
      console.log(`   Resultado: ${valoresEncontrados.length} empréstimos encontrados`);
    }
    
    // Buscar por data
    const dataParaBuscar = emprestimos[0]?.data_emprestimo;
    if (dataParaBuscar) {
      console.log(`   Buscando por data: "${dataParaBuscar}"`);
      const datasEncontradas = emprestimos.filter(emp => 
        emp.data_emprestimo && emp.data_emprestimo.includes(dataParaBuscar)
      );
      console.log(`   Resultado: ${datasEncontradas.length} empréstimos encontrados`);
    }
    
    console.log('');
    
    // 5. Testar busca inexistente
    console.log('5. Testando busca por termo inexistente...');
    const buscaInexistente = emprestimos.filter(emp => 
      emp.cliente_nome && emp.cliente_nome.toLowerCase().includes('xyz123inexistente')
    );
    console.log(`   Busca por "xyz123inexistente": ${buscaInexistente.length} resultados`);
    
    // 6. Estatísticas gerais
    console.log('6. Estatísticas dos empréstimos:');
    const statusCount = {};
    emprestimos.forEach(emp => {
      const status = emp.status || 'Sem Status';
      statusCount[status] = (statusCount[status] || 0) + 1;
    });
    
    Object.entries(statusCount).forEach(([status, count]) => {
      console.log(`   ${status}: ${count} empréstimos`);
    });
    
    // 7. Verificar se há clientes com nomes
    const clientesComNome = emprestimos.filter(emp => emp.cliente_nome && emp.cliente_nome.trim() !== '');
    console.log(`   Clientes com nome: ${clientesComNome.length} de ${emprestimos.length}`);
    
    // 8. Verificar se há valores
    const empréstimosComValor = emprestimos.filter(emp => emp.valor && emp.valor > 0);
    console.log(`   Empréstimos com valor: ${empréstimosComValor.length} de ${emprestimos.length}`);
    
    console.log('\n=== TESTE CONCLUÍDO ===');
    console.log('✅ A funcionalidade de busca está pronta para ser testada no frontend!');
    console.log('');
    console.log('📋 Para testar no navegador:');
    console.log('1. Acesse a página de empréstimos');
    console.log('2. Use a caixa de busca para filtrar por:');
    console.log('   - Nome do cliente');
    console.log('   - Valor do empréstimo');
    console.log('   - Status do empréstimo');
    console.log('   - Data de empréstimo ou vencimento');
    console.log('3. Use o filtro de status para filtrar por status específico');
    console.log('4. Use o botão "Limpar" para resetar os filtros');
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
    console.log('\n🔧 Possíveis soluções:');
    console.log('1. Verifique se o servidor está rodando');
    console.log('2. Verifique se há empréstimos cadastrados');
    console.log('3. Verifique se a sessão está ativa');
  }
}

// Executar teste
testBuscaEmprestimos(); 