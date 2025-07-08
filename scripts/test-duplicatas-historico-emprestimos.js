const mysql = require('mysql2');

// Configuração da conexão
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'jpsistemas',
  password: 'Juliano@95',
  database: 'jpcobrancas_cobranca'
});

async function testDuplicatasHistoricoEmprestimos() {
  console.log('🔍 Testando duplicatas no histórico de empréstimos...\n');
  
  try {
    // Buscar empréstimos
    const emprestimos = await new Promise((resolve, reject) => {
      connection.query('SELECT * FROM emprestimos ORDER BY id', (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    console.log('📋 Total de empréstimos no banco:', emprestimos.length);
    
    // Verificar duplicatas por ID
    const idsEncontrados = new Set();
    const duplicatas = [];
    
    emprestimos.forEach(emprestimo => {
      if (idsEncontrados.has(emprestimo.id)) {
        duplicatas.push(emprestimo);
      } else {
        idsEncontrados.add(emprestimo.id);
      }
    });
    
    console.log('🔍 IDs únicos encontrados:', idsEncontrados.size);
    console.log('⚠️  Duplicatas encontradas:', duplicatas.length);
    
    if (duplicatas.length > 0) {
      console.log('\n🚨 Duplicatas detectadas:');
      duplicatas.forEach(dup => {
        console.log(`  - ID ${dup.id}: ${dup.cliente_nome} - R$ ${dup.valor}`);
      });
    }
    
    // Mostrar empréstimos únicos esperados
    console.log('\n✅ Empréstimos únicos que devem aparecer no histórico:');
    const emprestimosUnicos = Array.from(idsEncontrados).map(id => 
      emprestimos.find(emp => emp.id === id)
    );
    
    emprestimosUnicos.forEach(emprestimo => {
      console.log(`  - ID ${emprestimo.id}: ${emprestimo.cliente_nome} - R$ ${emprestimo.valor} (${emprestimo.status})`);
    });
    
    console.log('\n🎯 Correção aplicada:');
    console.log('- Usa Map para controlar IDs já processados');
    console.log('- Ignora empréstimos duplicados com console.log');
    console.log('- Garante que cada empréstimo apareça apenas uma vez');
    
    console.log('\n📱 Agora acesse emprestimos.html para verificar:');
    console.log('- Não deve haver empréstimos duplicados');
    console.log('- Cada cliente deve aparecer apenas uma vez por empréstimo');
    console.log('- Status deve estar correto baseado em parcelas');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  } finally {
    connection.end();
  }
}

testDuplicatasHistoricoEmprestimos(); 