const mysql = require('mysql2/promise');

console.log('🔍 Debugando problema de atraso nas cobranças...');

async function debugCobrancasAtraso() {
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
    
    // 1. Verificar empréstimos e seus status
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
      ORDER BY id DESC
    `);
    
    console.log('\n📊 Empréstimos encontrados:');
    for (const emp of emprestimos) {
      console.log(`\n💰 Empréstimo ID ${emp.id}:`);
      console.log(`   Valor: R$ ${emp.valor}`);
      console.log(`   Status: ${emp.status}`);
      console.log(`   Tipo: ${emp.tipo_emprestimo}`);
      console.log(`   Data Empréstimo: ${emp.data_emprestimo}`);
      console.log(`   Data Vencimento: ${emp.data_vencimento}`);
      
      // Verificar se está atrasado pela data do empréstimo
      const hoje = new Date();
      hoje.setHours(0,0,0,0);
      const dataVenc = new Date(emp.data_vencimento);
      const atrasadoPorData = dataVenc < hoje;
      
      console.log(`   Atrasado por data empréstimo: ${atrasadoPorData ? 'SIM' : 'NÃO'}`);
      
      // Verificar parcelas se for parcelado
      try {
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
          console.log(`   📋 Parcelas (${parcelas.length} total):`);
          
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
            
            console.log(`      Parcela ${parcela.numero_parcela}: R$ ${parcela.valor_parcela} - Venc: ${parcela.data_vencimento} - Status: ${parcela.status} ${atrasadaParcela ? '(ATRASADA)' : ''}`);
          });
          
          console.log(`   📈 Resumo das parcelas:`);
          console.log(`      Pagas: ${parcelasPagas}`);
          console.log(`      Atrasadas: ${parcelasAtrasadas}`);
          console.log(`      Pendentes em dia: ${parcelasPendentesEmDia}`);
          
          // Determinar status real
          let statusReal = '';
          if (parcelasPagas === parcelas.length) {
            statusReal = 'QUITADO';
          } else if (parcelasAtrasadas > 0) {
            statusReal = 'ATRASADO';
          } else {
            statusReal = 'EM DIA';
          }
          
          console.log(`   🎯 Status real baseado em parcelas: ${statusReal}`);
          
        } else {
          console.log(`   📋 Sem parcelas (empréstimo de parcela única)`);
          console.log(`   🎯 Status baseado em data de vencimento: ${atrasadoPorData ? 'ATRASADO' : 'EM DIA'}`);
        }
        
      } catch (error) {
        console.log(`   ❌ Erro ao verificar parcelas: ${error.message}`);
      }
    }
    
    console.log('\n🔧 Problema identificado:');
    console.log('A página cobrancas.html está usando apenas a data_vencimento do empréstimo');
    console.log('para determinar se está atrasado, mas deveria verificar as parcelas individuais.');
    
    console.log('\n💡 Solução:');
    console.log('Corrigir a lógica na função renderCobrancasEmAbertoLista() para:');
    console.log('1. Verificar se tem parcelas');
    console.log('2. Se tiver parcelas, verificar status das parcelas');
    console.log('3. Se não tiver parcelas, usar data_vencimento do empréstimo');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

debugCobrancasAtraso().catch(console.error); 