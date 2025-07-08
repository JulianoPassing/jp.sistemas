const mysql = require('mysql2/promise');

console.log('🧪 Testando correção da lógica de atraso nas cobranças...');

async function testCorrecaoAtraso() {
  let connection;
  
  try {
    // Conectar ao banco do usuário cobranca
    const dbConfig = {
      host: 'localhost',
      user: 'jpsistemas',
      password: 'Juliano@95',
      database: 'jpcobrancas_cobranca',
      charset: 'utf8mb4'
    };
    
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conectado ao banco jpcobrancas_cobranca');
    
    // Simular a mesma lógica que agora está no frontend
    const [emprestimos] = await connection.execute(`
      SELECT 
        id,
        valor,
        data_emprestimo,
        data_vencimento,
        status,
        tipo_emprestimo,
        numero_parcelas,
        cliente_id
      FROM emprestimos
      WHERE TRIM(UPPER(status)) IN ('ATIVO', 'PENDENTE')
      ORDER BY id DESC
    `);
    
    console.log(`\n📊 Testando lógica corrigida em ${emprestimos.length} empréstimos:`);
    
    for (const emp of emprestimos) {
      console.log(`\n💰 Empréstimo ID ${emp.id}:`);
      console.log(`   Valor: R$ ${emp.valor}`);
      console.log(`   Status BD: ${emp.status}`);
      console.log(`   Data Vencimento: ${emp.data_vencimento}`);
      
      let statusReal = emp.status.toLowerCase();
      
      // Verificar se tem parcelas
      const [parcelas] = await connection.execute(`
        SELECT 
          numero_parcela,
          valor_parcela,
          data_vencimento,
          status,
          data_pagamento
        FROM parcelas
        WHERE emprestimo_id = ?
        ORDER BY numero_parcela
      `, [emp.id]);
      
      if (parcelas.length > 0) {
        console.log(`   📋 Tem ${parcelas.length} parcelas - analisando...`);
        
        const hoje = new Date();
        hoje.setHours(0,0,0,0);
        
        let parcelasAtrasadas = 0;
        let parcelasPagas = 0;
        let parcelasPendentesEmDia = 0;
        
        parcelas.forEach(parcela => {
          const dataVencParcela = new Date(parcela.data_vencimento);
          const atrasadaParcela = dataVencParcela < hoje && parcela.status !== 'Paga';
          
          if (parcela.status === 'Paga') {
            parcelasPagas++;
          } else if (atrasadaParcela) {
            parcelasAtrasadas++;
          } else {
            parcelasPendentesEmDia++;
          }
        });
        
        // Determinar status real baseado nas parcelas
        if (parcelasPagas === parcelas.length) {
          statusReal = 'quitado';
        } else if (parcelasAtrasadas > 0) {
          statusReal = 'atrasado';
        } else {
          statusReal = 'em_dia';
        }
        
        console.log(`   📈 Parcelas: ${parcelasPagas} pagas, ${parcelasAtrasadas} atrasadas, ${parcelasPendentesEmDia} em dia`);
        
      } else {
        console.log(`   📋 Sem parcelas - usando data de vencimento do empréstimo`);
        
        const hoje = new Date();
        hoje.setHours(0,0,0,0);
        const dataVenc = new Date(emp.data_vencimento);
        
        if (dataVenc < hoje) {
          statusReal = 'atrasado';
        }
      }
      
      // Determinar badge que será exibido
      let badge = '';
      if (statusReal === 'quitado') {
        badge = 'Quitado';
      } else if (statusReal === 'atrasado' || statusReal === 'em atraso') {
        badge = 'Em Atraso';
      } else if (statusReal === 'em_dia' || statusReal === 'ativo' || statusReal === 'pendente') {
        badge = 'Em Dia';
      } else {
        badge = emp.status || '-';
      }
      
      console.log(`   🎯 Status calculado: ${statusReal}`);
      console.log(`   🏷️  Badge que será exibido: ${badge}`);
      
      // Verificar se a lógica está correta
      if (statusReal === 'atrasado' && badge === 'Em Atraso') {
        console.log(`   ✅ CORRETO: Empréstimo realmente atrasado`);
      } else if (statusReal === 'em_dia' && badge === 'Em Dia') {
        console.log(`   ✅ CORRETO: Empréstimo em dia`);
      } else if (statusReal === 'quitado' && badge === 'Quitado') {
        console.log(`   ✅ CORRETO: Empréstimo quitado`);
      } else {
        console.log(`   ⚠️  VERIFICAR: Status ${statusReal} com badge ${badge}`);
      }
    }
    
    console.log('\n🎉 Teste concluído!');
    console.log('A lógica agora verifica:');
    console.log('1. Se tem parcelas: analisa status das parcelas individuais');
    console.log('2. Se não tem parcelas: usa data de vencimento do empréstimo');
    console.log('3. Só marca como atrasado se realmente houver parcelas vencidas');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

testCorrecaoAtraso().catch(console.error); 