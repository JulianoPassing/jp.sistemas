const axios = require('axios');

const API_BASE_URL = 'https://jp-sistemas.com/api/cobrancas';

async function testDashboard() {
  console.log('=== TESTE DETALHADO DO DASHBOARD ===\n');
  
  try {
    // Fazer requisição ao dashboard
    console.log('1. Fazendo requisição ao dashboard...');
    const response = await axios.get(`${API_BASE_URL}/dashboard`, {
      headers: {
        'Cookie': 'connect.sid=s%3AyourSessionId.signature', // Substitua pela sua sessão
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 30000
    });
    
    console.log('✅ Requisição bem-sucedida!');
    console.log('Status:', response.status);
    console.log('Dados recebidos:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.log('❌ Erro na requisição:');
    
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Headers:', error.response.headers);
      console.log('Data:', error.response.data);
    } else if (error.request) {
      console.log('Erro de rede:', error.message);
    } else {
      console.log('Erro:', error.message);
    }
    
    console.log('Stack trace:', error.stack);
  }
}

// Executar o teste
testDashboard(); 