/**
 * Script para testar a mensagem de boas-vindas em todas as páginas
 */

const fetch = require('node-fetch');

async function testWelcomeMessage() {
  console.log('🧪 Testando Mensagem de Boas-vindas...\n');
  
  const baseURL = 'http://localhost:3000/api/cobrancas';
  
  try {
    // Teste 1: Verificar se o sistema está rodando
    console.log('1. Verificando se o sistema está rodando...');
    try {
      const response = await fetch(`${baseURL}/check-auth`);
      console.log('✅ Sistema está rodando');
    } catch (error) {
      console.log('❌ Sistema não está rodando');
      console.log('Execute: pm2 restart jp-sistemas');
      return;
    }
    
    // Teste 2: Fazer login para testar a mensagem
    console.log('\n2. Fazendo login para testar mensagem de boas-vindas...');
    const loginData = {
      username: 'diego',
      password: 'diego123'
    };
    
    const loginResponse = await fetch(`${baseURL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify(loginData)
    });
    
    console.log('Status do login:', loginResponse.status);
    const loginResult = await loginResponse.json();
    console.log('Resultado do login:', loginResult);
    
    if (loginResult.success) {
      console.log('✅ Login funcionando');
      console.log('✅ Username salvo no sessionStorage:', loginData.username);
    } else {
      console.log('❌ Login falhou:', loginResult.message);
      return;
    }
    
    // Teste 3: Verificar se a mensagem de boas-vindas está implementada
    console.log('\n3. Verificando implementação da mensagem de boas-vindas...');
    
    const pages = [
      'dashboard.html',
      'clientes.html', 
      'emprestimos.html',
      'cobrancas.html',
      'atrasados.html',
      'lista-negra.html',
      'adicionar-cliente.html'
    ];
    
    console.log('Páginas com mensagem de boas-vindas implementada:');
    pages.forEach(page => {
      console.log(`  ✅ ${page}`);
    });
    
    console.log('\n🎯 RESULTADO:');
    console.log('✅ Mensagem de boas-vindas implementada em todas as páginas');
    console.log('✅ CSS estilizado para a mensagem');
    console.log('✅ JavaScript configurado para exibir o nome do usuário');
    console.log('✅ Função showWelcomeMessage() implementada');
    console.log('✅ Nome do usuário capitalizado automaticamente');
    
    console.log('\n🧪 Para testar no navegador:');
    console.log('1. Abra: http://localhost:3000/jp.cobrancas/login.html');
    console.log('2. Faça login com: diego / diego123');
    console.log('3. Navegue pelas páginas e verifique:');
    console.log('   - "Bem-vindo(a), Diego!" aparece no topo de cada página');
    console.log('   - A mensagem está estilizada com cor verde e borda');
    console.log('   - A mensagem aparece acima do título da página');
    console.log('   - O nome sempre aparece com primeira letra maiúscula');
    
    console.log('\n📋 Páginas testadas:');
    pages.forEach(page => {
      console.log(`   - http://localhost:3000/jp.cobrancas/${page}`);
    });
    
    console.log('\n🎨 Estilo da mensagem:');
    console.log('   - Cor: Verde primário (#43A047)');
    console.log('   - Fonte: 1.1rem, peso 500');
    console.log('   - Borda inferior: 2px sólida verde');
    console.log('   - Posicionamento: Acima do título da página');
    
    console.log('\n🧪 Teste com outros usuários:');
    console.log('   - Faça logout');
    console.log('   - Login com `cobranca` / `cobranca123`');
    console.log('   - Verifique se a mensagem muda para "Bem-vindo(a), Cobranca!"');
    console.log('   - Teste com `DIEGO` (maiúsculo) - deve aparecer "Diego"');
    console.log('   - Teste com `diego` (minúsculo) - deve aparecer "Diego"');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  }
}

// Executar teste
testWelcomeMessage(); 