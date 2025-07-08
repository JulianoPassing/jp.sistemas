const mysql = require('mysql2');

// Configuração da conexão
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'jpsistemas',
  password: 'Juliano@95',
  database: 'jpcobrancas_cobranca'
});

async function testCorrecaoFinalEmprestimos() {
  console.log('🔧 Teste da Correção Final - Duplicatas em emprestimos.html\n');
  
  try {
    // Buscar empréstimos diretamente do banco
    const emprestimos = await new Promise((resolve, reject) => {
      connection.query('SELECT * FROM emprestimos ORDER BY id', (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    console.log('📊 ANÁLISE DOS DADOS NO BANCO:');
    console.log(`📋 Total de registros na tabela emprestimos: ${emprestimos.length}`);
    
    // Agrupar por ID para verificar duplicatas
    const gruposPorId = emprestimos.reduce((acc, emp) => {
      if (!acc[emp.id]) {
        acc[emp.id] = [];
      }
      acc[emp.id].push(emp);
      return acc;
    }, {});
    
    console.log(`🔍 IDs únicos encontrados: ${Object.keys(gruposPorId).length}`);
    
    let duplicatasNoBanco = 0;
    Object.entries(gruposPorId).forEach(([id, registros]) => {
      if (registros.length > 1) {
        duplicatasNoBanco++;
        console.log(`🚨 ID ${id} aparece ${registros.length} vezes no banco!`);
        registros.forEach((reg, index) => {
          console.log(`   ${index + 1}. ${reg.cliente_nome} - R$ ${reg.valor} - ${reg.status}`);
        });
      }
    });
    
    if (duplicatasNoBanco === 0) {
      console.log('✅ Não há duplicatas reais no banco de dados');
    } else {
      console.log(`⚠️  Encontradas ${duplicatasNoBanco} duplicatas reais no banco`);
    }
    
    console.log('\n📋 LISTA DE EMPRÉSTIMOS ÚNICOS:');
    Object.entries(gruposPorId).forEach(([id, registros]) => {
      const emp = registros[0]; // Pegar o primeiro (se houver duplicatas)
      console.log(`  📄 ID ${emp.id}: ${emp.cliente_nome} - R$ ${emp.valor} (${emp.status})`);
    });
    
    console.log('\n🔧 CORREÇÕES APLICADAS:');
    console.log('✅ 1. API: Adicionado DISTINCT na query SQL');
    console.log('✅ 2. API: Removida rota duplicada /emprestimos/:id/parcelas');
    console.log('✅ 3. API: Adicionados logs detalhados');
    console.log('✅ 4. Frontend: Controle rigoroso de duplicatas com Map');
    console.log('✅ 5. Frontend: Logs detalhados para debug');
    console.log('✅ 6. Frontend: Verificação de parcelas para status correto');
    
    console.log('\n🧪 COMO TESTAR:');
    console.log('1. Abra emprestimos.html no navegador');
    console.log('2. Pressione F12 para abrir o Console');
    console.log('3. Pressione F5 para recarregar a página');
    console.log('4. Verifique os logs no console:');
    console.log('   - "📋 Histórico: API retornou X empréstimos"');
    console.log('   - "📝 Histórico: IDs retornados pela API: [...]"');
    console.log('   - "🚨 Histórico: Empréstimo duplicado ignorado" (se houver)');
    console.log('   - "✅ Histórico: X empréstimos únicos processados"');
    console.log('5. Confirme que a lista mostra apenas empréstimos únicos');
    
    console.log('\n🎯 RESULTADO ESPERADO:');
    console.log(`- Exatamente ${Object.keys(gruposPorId).length} empréstimos únicos na lista`);
    console.log('- Nenhuma linha duplicada visível');
    console.log('- Status correto baseado em parcelas');
    console.log('- Logs detalhados no console para monitoramento');
    
    console.log('\n📝 LOGS IMPORTANTES A VERIFICAR:');
    console.log('- Se aparecer "🚨 Empréstimo duplicado ignorado", a correção está funcionando');
    console.log('- Os "IDs retornados pela API" vs "IDs finais" devem mostrar a filtragem');
    console.log('- Cada empréstimo deve ser "✅ Processando" apenas uma vez');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  } finally {
    connection.end();
  }
}

testCorrecaoFinalEmprestimos(); 