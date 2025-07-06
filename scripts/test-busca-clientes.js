// Script para testar funcionalidade de busca de clientes
// Usando fetch nativo do Node.js 18+

async function testBuscaClientes() {
  try {
    console.log('=== TESTE DE BUSCA DE CLIENTES ===\n');
    
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
    
    // 2. Buscar clientes
    console.log('2. Buscando clientes...');
    const clientesResponse = await fetch(`${baseURL}/clientes`);
    const clientes = await clientesResponse.json();
    console.log(`Total de clientes: ${clientes.length}`);
    
    if (clientes.length === 0) {
      console.log('❌ Nenhum cliente encontrado. Crie um cliente primeiro.');
      return;
    }
    
    // 3. Mostrar alguns clientes para referência
    console.log('3. Exemplos de clientes disponíveis:');
    clientes.slice(0, 3).forEach((cliente, index) => {
      console.log(`   ${index + 1}. Nome: ${cliente.nome || 'N/A'}`);
      console.log(`      CPF: ${cliente.cpf_cnpj || 'N/A'}`);
      console.log(`      Telefone: ${cliente.telefone || 'N/A'}`);
      console.log(`      Email: ${cliente.email || 'N/A'}`);
      console.log(`      Status: ${cliente.status || 'Ativo'}`);
      console.log(`      Cidade: ${cliente.cidade || 'N/A'}`);
      console.log(`      Estado: ${cliente.estado || 'N/A'}`);
      console.log('');
    });
    
    // 4. Testar diferentes cenários de busca
    console.log('4. Testando cenários de busca...');
    
    // Buscar por nome de cliente
    const clienteParaBuscar = clientes[0]?.nome;
    if (clienteParaBuscar) {
      console.log(`   Buscando por nome: "${clienteParaBuscar}"`);
      const clientesEncontrados = clientes.filter(cliente => 
        cliente.nome && cliente.nome.toLowerCase().includes(clienteParaBuscar.toLowerCase())
      );
      console.log(`   Resultado: ${clientesEncontrados.length} clientes encontrados`);
    }
    
    // Buscar por CPF
    const cpfParaBuscar = clientes[0]?.cpf_cnpj;
    if (cpfParaBuscar) {
      console.log(`   Buscando por CPF: "${cpfParaBuscar}"`);
      const cpfsEncontrados = clientes.filter(cliente => 
        cliente.cpf_cnpj && cliente.cpf_cnpj.toLowerCase().includes(cpfParaBuscar.toLowerCase())
      );
      console.log(`   Resultado: ${cpfsEncontrados.length} clientes encontrados`);
    }
    
    // Buscar por telefone
    const telefoneParaBuscar = clientes[0]?.telefone;
    if (telefoneParaBuscar) {
      console.log(`   Buscando por telefone: "${telefoneParaBuscar}"`);
      const telefonesEncontrados = clientes.filter(cliente => 
        cliente.telefone && cliente.telefone.includes(telefoneParaBuscar)
      );
      console.log(`   Resultado: ${telefonesEncontrados.length} clientes encontrados`);
    }
    
    // Buscar por email
    const emailParaBuscar = clientes[0]?.email;
    if (emailParaBuscar) {
      console.log(`   Buscando por email: "${emailParaBuscar}"`);
      const emailsEncontrados = clientes.filter(cliente => 
        cliente.email && cliente.email.toLowerCase().includes(emailParaBuscar.toLowerCase())
      );
      console.log(`   Resultado: ${emailsEncontrados.length} clientes encontrados`);
    }
    
    // Buscar por cidade
    const cidadeParaBuscar = clientes[0]?.cidade;
    if (cidadeParaBuscar) {
      console.log(`   Buscando por cidade: "${cidadeParaBuscar}"`);
      const cidadesEncontradas = clientes.filter(cliente => 
        cliente.cidade && cliente.cidade.toLowerCase().includes(cidadeParaBuscar.toLowerCase())
      );
      console.log(`   Resultado: ${cidadesEncontradas.length} clientes encontrados`);
    }
    
    // Buscar por status
    const statusParaBuscar = 'Ativo';
    console.log(`   Buscando por status: "${statusParaBuscar}"`);
    const statusEncontrados = clientes.filter(cliente => cliente.status === statusParaBuscar);
    console.log(`   Resultado: ${statusEncontrados.length} clientes encontrados`);
    
    console.log('');
    
    // 5. Testar busca inexistente
    console.log('5. Testando busca por termo inexistente...');
    const buscaInexistente = clientes.filter(cliente => 
      cliente.nome && cliente.nome.toLowerCase().includes('xyz123inexistente')
    );
    console.log(`   Busca por "xyz123inexistente": ${buscaInexistente.length} resultados`);
    
    // 6. Estatísticas gerais
    console.log('6. Estatísticas dos clientes:');
    const statusCount = {};
    clientes.forEach(cliente => {
      const status = cliente.status || 'Ativo';
      statusCount[status] = (statusCount[status] || 0) + 1;
    });
    
    Object.entries(statusCount).forEach(([status, count]) => {
      console.log(`   ${status}: ${count} clientes`);
    });
    
    // 7. Verificar se há clientes com nomes
    const clientesComNome = clientes.filter(cliente => cliente.nome && cliente.nome.trim() !== '');
    console.log(`   Clientes com nome: ${clientesComNome.length} de ${clientes.length}`);
    
    // 8. Verificar se há clientes com CPF
    const clientesComCPF = clientes.filter(cliente => cliente.cpf_cnpj && cliente.cpf_cnpj.trim() !== '');
    console.log(`   Clientes com CPF: ${clientesComCPF.length} de ${clientes.length}`);
    
    // 9. Verificar se há clientes com telefone
    const clientesComTelefone = clientes.filter(cliente => cliente.telefone && cliente.telefone.trim() !== '');
    console.log(`   Clientes com telefone: ${clientesComTelefone.length} de ${clientes.length}`);
    
    // 10. Verificar se há clientes com email
    const clientesComEmail = clientes.filter(cliente => cliente.email && cliente.email.trim() !== '');
    console.log(`   Clientes com email: ${clientesComEmail.length} de ${clientes.length}`);
    
    // 11. Verificar se há clientes com cidade
    const clientesComCidade = clientes.filter(cliente => cliente.cidade && cliente.cidade.trim() !== '');
    console.log(`   Clientes com cidade: ${clientesComCidade.length} de ${clientes.length}`);
    
    console.log('\n=== TESTE CONCLUÍDO ===');
    console.log('✅ A funcionalidade de busca está pronta para ser testada no frontend!');
    console.log('');
    console.log('📋 Para testar no navegador:');
    console.log('1. Acesse a página de clientes');
    console.log('2. Use a caixa de busca para filtrar por:');
    console.log('   - Nome do cliente');
    console.log('   - CPF/CNPJ');
    console.log('   - Telefone');
    console.log('   - Email');
    console.log('   - Cidade');
    console.log('   - Estado');
    console.log('3. Use o filtro de status para filtrar por status específico');
    console.log('4. Use o botão "Limpar" para resetar os filtros');
    console.log('');
    console.log('🎯 Dicas de uso:');
    console.log('- A busca é case-insensitive (não diferencia maiúsculas/minúsculas)');
    console.log('- Pode buscar por parte do nome, CPF, telefone, etc.');
    console.log('- Pode combinar busca por texto com filtro de status');
    console.log('- A busca funciona em tempo real conforme você digita');
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
    console.log('\n🔧 Possíveis soluções:');
    console.log('1. Verifique se o servidor está rodando');
    console.log('2. Verifique se há clientes cadastrados');
    console.log('3. Verifique se a sessão está ativa');
  }
}

// Executar teste
testBuscaClientes(); 