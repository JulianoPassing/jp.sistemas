const fetch = require('node-fetch');

async function testAuth() {
  const baseUrl = 'http://localhost:3000';
  
  console.log('🧪 Testando autenticação...\n');
  
  try {
    // 1. Teste de login
    console.log('1. Fazendo login...');
    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'teste', password: 'teste' })
    });
    
    if (!loginResponse.ok) {
      console.log('❌ Login falhou:', await loginResponse.text());
      return;
    }
    
    const loginData = await loginResponse.json();
    console.log('✅ Login bem-sucedido:', loginData.success);
    
    // Pegar cookies da resposta
    const cookies = loginResponse.headers.get('set-cookie');
    console.log('🍪 Cookies recebidos:', cookies ? 'Sim' : 'Não');
    
    // 2. Teste de verificação de usuário
    console.log('\n2. Verificando usuário autenticado...');
    const userResponse = await fetch(`${baseUrl}/api/auth/user`, {
      headers: { 'Cookie': cookies }
    });
    
    if (userResponse.ok) {
      const userData = await userResponse.json();
      console.log('✅ Usuário autenticado:', userData);
    } else {
      console.log('❌ Falha na verificação:', await userResponse.text());
    }
    
    // 3. Teste de logout
    console.log('\n3. Fazendo logout...');
    const logoutResponse = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Cookie': cookies }
    });
    
    if (logoutResponse.ok) {
      console.log('✅ Logout bem-sucedido');
    } else {
      console.log('❌ Logout falhou:', await logoutResponse.text());
    }
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  }
}

testAuth(); 