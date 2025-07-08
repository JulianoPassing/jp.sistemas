const mysql = require('mysql2');

// Configuração da conexão
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'jpsistemas',
  password: 'Juliano@95',
  database: 'jpcobrancas_cobranca'
});

async function testHistoricoEmprestimos() {
  console.log('🔍 Testando dados para histórico de empréstimos...\n');
  
  try {
    // Buscar empréstimos
    const emprestimos = await new Promise((resolve, reject) => {
      connection.query('SELECT * FROM emprestimos ORDER BY id', (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    console.log('📋 Empréstimos encontrados:', emprestimos.length);
    
    for (const emprestimo of emprestimos) {
      console.log(`\n💰 Empréstimo ID ${emprestimo.id}:`);
      console.log(`  - Cliente: ${emprestimo.cliente_nome}`);
      console.log(`  - Valor: R$ ${emprestimo.valor}`);
      console.log(`  - Status: ${emprestimo.status}`);
      console.log(`  - Data empréstimo: ${emprestimo.data_emprestimo}`);
      console.log(`  - Data vencimento: ${emprestimo.data_vencimento}`);
      console.log(`  - Tipo: ${emprestimo.tipo_emprestimo}`);
      console.log(`  - Parcelas: ${emprestimo.numero_parcelas}`);
      
      // Buscar parcelas
      const parcelas = await new Promise((resolve, reject) => {
        connection.query(
          'SELECT * FROM parcelas WHERE emprestimo_id = ? ORDER BY numero_parcela',
          [emprestimo.id],
          (err, results) => {
            if (err) reject(err);
            else resolve(results);
          }
        );
      });
      
      console.log(`  - Parcelas encontradas: ${parcelas.length}`);
      
      if (parcelas.length > 0) {
        console.log('  📅 Parcelas:');
        
        const hoje = new Date();
        hoje.setHours(0,0,0,0);
        
        let statusReal = emprestimo.status.toUpperCase();
        let parcelasAtrasadas = 0;
        let parcelasPagas = 0;
        
        for (const parcela of parcelas) {
          const dataVencParcela = new Date(parcela.data_vencimento);
          const isAtrasada = dataVencParcela < hoje && parcela.status !== 'Paga';
          const isPaga = parcela.status === 'Paga';
          
          if (isAtrasada) parcelasAtrasadas++;
          if (isPaga) parcelasPagas++;
          
          console.log(`    ${parcela.numero_parcela}: R$ ${parcela.valor} - ${parcela.data_vencimento} - ${parcela.status} ${isAtrasada ? '(ATRASADA)' : ''}`);
        }
        
        // Determinar status correto
        if (parcelasPagas === parcelas.length) {
          statusReal = 'QUITADO';
        } else if (parcelasAtrasadas > 0) {
          statusReal = 'ATRASADO';
        } else {
          statusReal = 'ATIVO';
        }
        
        console.log(`  ✅ Status real baseado em parcelas: ${statusReal}`);
        
        if (statusReal !== emprestimo.status.toUpperCase()) {
          console.log(`  ⚠️  Status original (${emprestimo.status}) diferente do status real (${statusReal})`);
        }
        
      } else {
        // Sem parcelas - verificar por data de vencimento
        if (emprestimo.data_vencimento) {
          const dataVencimento = new Date(emprestimo.data_vencimento);
          const hoje = new Date();
          hoje.setHours(0,0,0,0);
          
          if (dataVencimento < hoje && emprestimo.status !== 'QUITADO') {
            console.log(`  ⚠️  Empréstimo vencido em ${emprestimo.data_vencimento} (sem parcelas)`);
          } else {
            console.log(`  ✅ Empréstimo em dia (sem parcelas)`);
          }
        }
      }
    }
    
    console.log('\n🎯 Teste concluído!');
    console.log('📱 Agora acesse emprestimos.html para ver o histórico com status corrigido');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  } finally {
    connection.end();
  }
}

testHistoricoEmprestimos(); 