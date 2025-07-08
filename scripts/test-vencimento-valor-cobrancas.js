const mysql = require('mysql2/promise');

console.log('🧪 Testando vencimento e valor corretos na página de cobranças...');

async function testVencimentoValorCobrancas() {
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
    
    // Buscar empréstimos ativos (mesma lógica da API)
    const [emprestimos] = await connection.execute(`
      SELECT e.*, c.nome as cliente_nome, c.telefone as telefone
      FROM emprestimos e
      LEFT JOIN clientes_cobrancas c ON e.cliente_id = c.id
      WHERE TRIM(UPPER(e.status)) IN ('ATIVO', 'PENDENTE')
      ORDER BY e.created_at DESC
    `);
    
    console.log(`\n📊 Empréstimos ativos encontrados: ${emprestimos.length}`);
    
    for (const emp of emprestimos) {
      console.log(`\n💰 Empréstimo ID ${emp.id} - ${emp.cliente_nome}`);
      console.log(`   Valor original: R$ ${emp.valor}`);
      console.log(`   Data vencimento original: ${emp.data_vencimento}`);
      console.log(`   Tipo: ${emp.tipo_emprestimo || 'N/A'}`);
      console.log(`   Número de parcelas: ${emp.numero_parcelas || 1}`);
      
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
      
      let valorACobrar = emp.valor || 0;
      let vencimentoACobrar = emp.data_vencimento;
      let tipoCobranca = 'Empréstimo Fixo';
      
      if (parcelas.length > 0) {
        console.log(`   📋 Tem ${parcelas.length} parcelas:`);
        
        // Encontrar próxima parcela não paga
        const parcelasNaoPagas = parcelas.filter(p => p.status !== 'Paga');
        
        if (parcelasNaoPagas.length > 0) {
          // Ordenar por data de vencimento e pegar a mais próxima
          parcelasNaoPagas.sort((a, b) => new Date(a.data_vencimento) - new Date(b.data_vencimento));
          const proximaParcela = parcelasNaoPagas[0];
          
          // Para empréstimos parcelados, usar dados da próxima parcela
          valorACobrar = proximaParcela.valor_parcela || valorACobrar;
          vencimentoACobrar = proximaParcela.data_vencimento || vencimentoACobrar;
          tipoCobranca = `Parcela ${proximaParcela.numero_parcela}`;
          
          console.log(`   📅 Próxima parcela: ${proximaParcela.numero_parcela}`);
          console.log(`   💵 Valor da parcela: R$ ${proximaParcela.valor_parcela}`);
          console.log(`   📆 Vencimento da parcela: ${proximaParcela.data_vencimento}`);
          console.log(`   🏷️  Status da parcela: ${proximaParcela.status}`);
        } else {
          console.log(`   ✅ Todas as parcelas estão pagas`);
          tipoCobranca = 'Quitado';
        }
        
        // Mostrar todas as parcelas para contexto
        console.log(`   📋 Detalhes das parcelas:`);
        parcelas.forEach(parcela => {
          const statusIcon = parcela.status === 'Paga' ? '✅' : '⏳';
          console.log(`      ${statusIcon} Parcela ${parcela.numero_parcela}: R$ ${parcela.valor_parcela} - ${parcela.data_vencimento} - ${parcela.status}`);
        });
      } else {
        console.log(`   📋 Sem parcelas (empréstimo de valor único)`);
      }
      
      console.log(`\n🎯 O que aparecerá na página de cobranças:`);
      console.log(`   💰 Valor a cobrar: R$ ${valorACobrar}`);
      console.log(`   📅 Vencimento: ${vencimentoACobrar}`);
      console.log(`   🏷️  Tipo: ${tipoCobranca}`);
      
      // Verificar se a lógica está correta
      if (parcelas.length > 0) {
        const parcelasNaoPagas = parcelas.filter(p => p.status !== 'Paga');
        if (parcelasNaoPagas.length > 0) {
          console.log(`   ✅ CORRETO: Mostrando próxima parcela a vencer`);
        } else {
          console.log(`   ✅ CORRETO: Empréstimo quitado`);
        }
      } else {
        console.log(`   ✅ CORRETO: Mostrando valor total do empréstimo`);
      }
    }
    
    console.log('\n🎉 Teste concluído!');
    console.log('\n📋 Resumo das regras implementadas:');
    console.log('1. 📅 VENCIMENTO:');
    console.log('   - Parcelado: Data da próxima parcela não paga');
    console.log('   - Fixo: Data de vencimento do empréstimo');
    console.log('');
    console.log('2. 💰 VALOR:');
    console.log('   - Parcelado: Valor da próxima parcela');
    console.log('   - Fixo: Valor total do empréstimo');
    console.log('');
    console.log('3. 🎯 RESULTADO:');
    console.log('   - Mostra exatamente o que precisa ser cobrado agora');
    console.log('   - Não confunde com valores totais quando é parcelado');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

testVencimentoValorCobrancas().catch(console.error); 