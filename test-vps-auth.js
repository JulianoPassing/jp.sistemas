const fetch = require('node-fetch');

async function testVPSAuth() {
  // Substitua pela URL da sua VPS
  const baseUrl = 'https://sua-vps.com'; // ou http://sua-vps.com se não tiver SSL
  
  console.log('🧪 Testando autenticação na VPS...\n');
  console.log('URL:', baseUrl);
  
  try {
    // 1. Teste de login
    console.log('\n1. Fazendo login...');
    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'teste', password: 'teste' })
    });
    
    console.log('Status do login:', loginResponse.status);
    
    if (!loginResponse.ok) {
      const errorText = await loginResponse.text();
      console.log('❌ Login falhou:', errorText);
      return;
    }
    
    const loginData = await loginResponse.json();
    console.log('✅ Login bem-sucedido:', loginData.success);
    
    // Pegar cookies da resposta
    const cookies = loginResponse.headers.get('set-cookie');
    console.log('🍪 Cookies recebidos:', cookies ? 'Sim' : 'Não');
    if (cookies) {
      console.log('Cookie:', cookies);
    }
    
    // 2. Teste de verificação de usuário
    console.log('\n2. Verificando usuário autenticado...');
    const userResponse = await fetch(`${baseUrl}/api/auth/user`, {
      headers: { 'Cookie': cookies }
    });
    
    console.log('Status da verificação:', userResponse.status);
    
    if (userResponse.ok) {
      const userData = await userResponse.json();
      console.log('✅ Usuário autenticado:', userData);
    } else {
      const errorText = await userResponse.text();
      console.log('❌ Falha na verificação:', errorText);
    }
    
    // 3. Teste de logout
    console.log('\n3. Fazendo logout...');
    const logoutResponse = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Cookie': cookies }
    });
    
    console.log('Status do logout:', logoutResponse.status);
    
    if (logoutResponse.ok) {
      console.log('✅ Logout bem-sucedido');
    } else {
      const errorText = await logoutResponse.text();
      console.log('❌ Logout falhou:', errorText);
    }
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  }
}

// Verificar se a URL foi fornecida
if (process.argv[2]) {
  const baseUrl = process.argv[2];
  console.log('Usando URL fornecida:', baseUrl);
  testVPSAuth();
} else {
  console.log('Uso: node test-vps-auth.js <URL_DA_VPS>');
  console.log('Exemplo: node test-vps-auth.js https://minha-vps.com');
} 