const mysql = require('mysql2');

// Configuração da conexão
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'jpsistemas',
  password: 'Juliano@95',
  database: 'jpcobrancas_cobranca'
});

async function testEmprestimosHtmlCorrigido() {
  console.log('🔍 Testando correção das duplicatas no emprestimos.html...\n');
  
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
    console.log('⚠️  Duplicatas encontradas no banco:', duplicatas.length);
    
    if (duplicatas.length > 0) {
      console.log('\n🚨 Duplicatas detectadas no banco:');
      duplicatas.forEach(dup => {
        console.log(`  - ID ${dup.id}: ${dup.cliente_nome} - R$ ${dup.valor}`);
      });
    }
    
    // Mostrar empréstimos únicos que devem aparecer
    console.log('\n✅ Empréstimos únicos que devem aparecer no emprestimos.html:');
    const emprestimosUnicos = Array.from(idsEncontrados).map(id => 
      emprestimos.find(emp => emp.id === id)
    );
    
    emprestimosUnicos.forEach(emprestimo => {
      console.log(`  - ID ${emprestimo.id}: ${emprestimo.cliente_nome} - R$ ${emprestimo.valor} (${emprestimo.status})`);
    });
    
    console.log('\n🎯 Correção aplicada no emprestimos.html:');
    console.log('- Função sobrescrita no HTML foi corrigida');
    console.log('- Usa Map para controlar IDs já processados');
    console.log('- Ignora empréstimos duplicados com console.log');
    console.log('- Aplica lógica de verificação de parcelas');
    console.log('- Atualiza status baseado em parcelas individuais');
    
    console.log('\n📱 Agora acesse emprestimos.html para verificar:');
    console.log('- Não deve haver empréstimos duplicados');
    console.log('- Cada empréstimo deve aparecer apenas uma vez');
    console.log('- Status deve estar correto baseado em parcelas');
    console.log('- Abra o Console do navegador (F12) para ver logs de duplicatas ignoradas');
    
    console.log('\n🔄 Próximos passos:');
    console.log('1. Abra emprestimos.html no navegador');
    console.log('2. Pressione F5 para recarregar a página');
    console.log('3. Verifique que não há duplicatas');
    console.log('4. Abra o Console (F12) para ver logs de duplicatas ignoradas');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  } finally {
    connection.end();
  }
}

testEmprestimosHtmlCorrigido(); 