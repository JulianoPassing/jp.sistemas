const axios = require('axios');
const mysql = require('mysql2/promise');

const API_BASE_URL = 'https://jp-sistemas.com/api/cobrancas';

async function debugSessionAuth() {
  console.log('=== DEBUG SESSÃO E AUTENTICAÇÃO ===\n');
  
  try {
    // 1. Testar endpoint de login primeiro
    console.log('1. Testando endpoint de login...');
    try {
      const loginResponse = await axios.post(`${API_BASE_URL}/login`, {
        username: 'admin', // Substitua pelo seu usuário
        password: 'admin'  // Substitua pela sua senha
      }, {
        timeout: 10000,
        validateStatus: () => true // Aceita qualquer status code
      });
      
      console.log('Status do login:', loginResponse.status);
      console.log('Headers do login:', loginResponse.headers);
      console.log('Dados do login:', loginResponse.data);
      
      // Extrair cookies se houver
      const cookies = loginResponse.headers['set-cookie'];
      console.log('Cookies recebidos:', cookies);
      
    } catch (loginError) {
      console.log('❌ Erro no login:', loginError.message);
    }
    
    // 2. Testar dashboard sem autenticação
    console.log('\n2. Testando dashboard sem autenticação...');
    try {
      const dashboardResponse = await axios.get(`${API_BASE_URL}/dashboard`, {
        timeout: 10000,
        validateStatus: () => true
      });
      
      console.log('Status do dashboard (sem auth):', dashboardResponse.status);
      console.log('Dados do dashboard (sem auth):', dashboardResponse.data);
      
    } catch (dashboardError) {
      console.log('❌ Erro no dashboard sem auth:', dashboardError.message);
    }
    
    // 3. Testar outros endpoints para verificar se o problema é geral
    console.log('\n3. Testando outros endpoints...');
    
    const endpoints = [
      '/clientes',
      '/emprestimos',
      '/cobrancas'
    ];
    
    for (const endpoint of endpoints) {
      try {
        console.log(`Testando ${endpoint}...`);
        const response = await axios.get(`${API_BASE_URL}${endpoint}`, {
          timeout: 5000,
          validateStatus: () => true
        });
        
        console.log(`${endpoint} - Status:`, response.status);
        if (response.status !== 200) {
          console.log(`${endpoint} - Erro:`, response.data);
        }
        
      } catch (error) {
        console.log(`${endpoint} - Erro de rede:`, error.message);
      }
    }
    
    // 4. Testar conectividade básica
    console.log('\n4. Testando conectividade básica...');
    try {
      const response = await axios.get('https://jp-sistemas.com', {
        timeout: 5000,
        validateStatus: () => true
      });
      
      console.log('Conectividade básica - Status:', response.status);
      
    } catch (error) {
      console.log('❌ Erro de conectividade:', error.message);
    }
    
    // 5. Testar conexão direta com banco (se possível)
    console.log('\n5. Testando conexão direta com banco...');
    try {
      const connection = await mysql.createConnection({
        host: 'localhost', // ou o host do seu banco
        user: 'jpcobrancas',
        password: 'Juliano@95',
        charset: 'utf8mb4'
      });
      
      const [result] = await connection.execute('SELECT 1 as test');
      console.log('✅ Conexão direta com banco funcionou:', result);
      
      await connection.end();
      
    } catch (dbError) {
      console.log('❌ Erro na conexão direta com banco:', dbError.message);
    }
    
    console.log('\n=== FIM DO DEBUG ===');
    
  } catch (error) {
    console.error('❌ Erro geral no debug:', error);
  }
}

// Executar o debug
debugSessionAuth(); 