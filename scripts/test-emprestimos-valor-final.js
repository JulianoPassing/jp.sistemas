const mysql = require('mysql2');

// Configuração da conexão
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'jpsistemas',
  password: 'Juliano@95',
  database: 'jpcobrancas_cobranca'
});

async function testEmprestimosValorFinal() {
  console.log('🧪 Teste - Valor Final dos Empréstimos\n');
  
  try {
    // Buscar empréstimos com cálculo de valor final
    const emprestimos = await new Promise((resolve, reject) => {
      connection.query(`
        SELECT 
          e.id,
          e.cliente_id,
          c.nome as cliente_nome,
          e.valor as valor_inicial,
          e.valor_parcela,
          e.numero_parcelas,
          e.juros_mensal,
          e.tipo_emprestimo,
          e.data_emprestimo,
          e.data_vencimento,
          e.status,
          CASE 
            WHEN e.tipo_emprestimo = 'in_installments' THEN (e.valor_parcela * e.numero_parcelas)
            ELSE e.valor * (1 + (e.juros_mensal / 100))
          END as valor_final
        FROM emprestimos e
        LEFT JOIN clientes_cobrancas c ON e.cliente_id = c.id
        ORDER BY e.id
      `, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    console.log('📊 EMPRÉSTIMOS COM VALOR FINAL CALCULADO:');
    console.log('='.repeat(80));
    
    emprestimos.forEach(emp => {
      console.log(`\n📄 ID ${emp.id}: ${emp.cliente_nome || 'N/A'}`);
      console.log(`  💰 Valor Inicial: R$ ${parseFloat(emp.valor_inicial).toFixed(2)}`);
      console.log(`  💵 Valor Final: R$ ${parseFloat(emp.valor_final).toFixed(2)}`);
      console.log(`  📈 Tipo: ${emp.tipo_emprestimo === 'in_installments' ? 'Parcelado' : 'Fixo'}`);
      
      if (emp.tipo_emprestimo === 'in_installments') {
        console.log(`  🔢 Parcelas: ${emp.numero_parcelas}x de R$ ${parseFloat(emp.valor_parcela).toFixed(2)}`);
        console.log(`  🧮 Cálculo: ${emp.numero_parcelas} × R$ ${parseFloat(emp.valor_parcela).toFixed(2)} = R$ ${parseFloat(emp.valor_final).toFixed(2)}`);
      } else {
        console.log(`  📊 Juros: ${emp.juros_mensal}% ao mês`);
        console.log(`  🧮 Cálculo: R$ ${parseFloat(emp.valor_inicial).toFixed(2)} × (1 + ${emp.juros_mensal}%) = R$ ${parseFloat(emp.valor_final).toFixed(2)}`);
      }
      
      console.log(`  📅 Empréstimo: ${emp.data_emprestimo}`);
      console.log(`  ⏰ Vencimento: ${emp.data_vencimento}`);
      console.log(`  🏷️  Status: ${emp.status}`);
      
      const diferenca = parseFloat(emp.valor_final) - parseFloat(emp.valor_inicial);
      console.log(`  💡 Diferença: R$ ${diferenca.toFixed(2)} (${diferenca >= 0 ? 'Lucro' : 'Prejuízo'})`);
    });
    
    console.log('\n' + '='.repeat(80));
    console.log('📈 RESUMO GERAL:');
    
    const totalInicial = emprestimos.reduce((sum, emp) => sum + parseFloat(emp.valor_inicial), 0);
    const totalFinal = emprestimos.reduce((sum, emp) => sum + parseFloat(emp.valor_final), 0);
    const totalLucro = totalFinal - totalInicial;
    
    console.log(`💰 Total Investido (Valor Inicial): R$ ${totalInicial.toFixed(2)}`);
    console.log(`💵 Total a Receber (Valor Final): R$ ${totalFinal.toFixed(2)}`);
    console.log(`📊 Total de Lucro: R$ ${totalLucro.toFixed(2)}`);
    console.log(`📈 Margem de Lucro: ${((totalLucro / totalInicial) * 100).toFixed(2)}%`);
    
    console.log('\n🔍 TESTE DA NOVA INTERFACE:');
    console.log('1. Abra emprestimos.html no navegador');
    console.log('2. Verifique se a tabela mostra as colunas:');
    console.log('   - Cliente');
    console.log('   - Valor Inicial');
    console.log('   - Valor Final');
    console.log('   - Data Empréstimo');
    console.log('   - Vencimento');
    console.log('   - Status');
    console.log('   - Ações');
    console.log('3. Confirme que os valores finais estão corretos');
    console.log('4. Teste os filtros de busca');
    
    console.log('\n✅ EXPECTATIVA:');
    console.log('- A tabela deve ter 7 colunas');
    console.log('- Valores finais devem ser diferentes dos iniciais quando há juros');
    console.log('- Para parcelados: Valor Final = Valor Parcela × Número de Parcelas');
    console.log('- Para fixos: Valor Final = Valor Inicial × (1 + Juros Mensal)');
    console.log('- Não deve haver duplicatas na lista');
    console.log('- Status deve estar correto baseado nas parcelas');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  } finally {
    connection.end();
  }
}

testEmprestimosValorFinal(); 