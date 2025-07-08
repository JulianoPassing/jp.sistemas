const mysql = require('mysql2/promise');
const { createCobrancasConnection } = require('../api/cobrancas');

async function diagnoseClientesAtraso() {
  console.log('🔍 Diagnosticando clientes em atraso...');
  
  try {
    const username = 'test_user';
    const connection = await createCobrancasConnection(username);
    
    // 1. Verificar a query atual da API (que está retornando 1)
    console.log('\n📊 Query atual da API:');
    const [clientesEmAtrasoAPI] = await connection.execute(`
      SELECT COUNT(DISTINCT c.id) as total
      FROM clientes_cobrancas c
      JOIN emprestimos e ON e.cliente_id = c.id
      WHERE e.status IN ('Ativo', 'Pendente')
        AND e.data_vencimento < CURDATE()
        AND e.status <> 'Quitado'
    `);
    console.log(`Resultado da API: ${clientesEmAtrasoAPI[0].total} clientes em atraso`);
    
    // 2. Buscar detalhes dos empréstimos que estão sendo considerados em atraso
    console.log('\n🔍 Empréstimos considerados em atraso pela API:');
    const [emprestimosAtraso] = await connection.execute(`
      SELECT e.id, e.cliente_id, e.status, e.data_vencimento, e.tipo_emprestimo, e.numero_parcelas,
             c.nome as cliente_nome, e.valor, e.valor_inicial
      FROM clientes_cobrancas c
      JOIN emprestimos e ON e.cliente_id = c.id
      WHERE e.status IN ('Ativo', 'Pendente')
        AND e.data_vencimento < CURDATE()
        AND e.status <> 'Quitado'
      ORDER BY e.data_vencimento DESC
    `);
    
    console.log(`Encontrados ${emprestimosAtraso.length} empréstimos em atraso:`);
    
    for (const emp of emprestimosAtraso) {
      console.log(`\n📋 Empréstimo ID: ${emp.id}`);
      console.log(`   Cliente: ${emp.cliente_nome} (ID: ${emp.cliente_id})`);
      console.log(`   Status: ${emp.status}`);
      console.log(`   Data Vencimento: ${emp.data_vencimento}`);
      console.log(`   Tipo: ${emp.tipo_emprestimo}`);
      console.log(`   Parcelas: ${emp.numero_parcelas || 1}`);
      console.log(`   Valor: R$ ${Number(emp.valor || 0).toFixed(2)}`);
      
      // 3. Se for parcelado, verificar as parcelas
      if (emp.tipo_emprestimo === 'in_installments' && emp.numero_parcelas > 1) {
        console.log(`   📦 Verificando parcelas...`);
        
        const [parcelas] = await connection.execute(`
          SELECT numero_parcela, data_vencimento, status, valor_parcela
          FROM parcelas
          WHERE emprestimo_id = ?
          ORDER BY numero_parcela ASC
        `, [emp.id]);
        
        console.log(`   Total de parcelas: ${parcelas.length}`);
        
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        
        let parcelasAtrasadas = 0;
        let parcelasPagas = 0;
        let parcelasPendentes = 0;
        
        parcelas.forEach(p => {
          const dataVenc = new Date(p.data_vencimento);
          const atrasada = dataVenc < hoje && p.status !== 'Paga';
          
          if (p.status === 'Paga') {
            parcelasPagas++;
          } else if (atrasada) {
            parcelasAtrasadas++;
          } else {
            parcelasPendentes++;
          }
          
          console.log(`     Parcela ${p.numero_parcela}: ${p.status} - Venc: ${p.data_vencimento} ${atrasada ? '(ATRASADA)' : ''}`);
        });
        
        console.log(`   📊 Resumo das parcelas:`);
        console.log(`     Pagas: ${parcelasPagas}`);
        console.log(`     Atrasadas: ${parcelasAtrasadas}`);
        console.log(`     Pendentes: ${parcelasPendentes}`);
        
        // Determinar se o empréstimo deveria estar em atraso
        const deveEstarAtrasado = parcelasAtrasadas > 0;
        const estaQuitado = parcelasPagas === parcelas.length;
        
        console.log(`   ⚠️  Deve estar em atraso: ${deveEstarAtrasado ? 'SIM' : 'NÃO'}`);
        console.log(`   ✅ Está quitado: ${estaQuitado ? 'SIM' : 'NÃO'}`);
        
        if (estaQuitado) {
          console.log(`   🚨 PROBLEMA: Empréstimo está quitado mas ainda aparece como ativo!`);
        } else if (!deveEstarAtrasado) {
          console.log(`   🚨 PROBLEMA: Empréstimo não tem parcelas atrasadas mas aparece como em atraso!`);
        }
      }
    }
    
    // 4. Sugerir query corrigida
    console.log('\n🛠️  Query corrigida sugerida:');
    console.log(`
    Para empréstimos parcelados, devemos verificar se há parcelas atrasadas:
    
    SELECT COUNT(DISTINCT c.id) as total
    FROM clientes_cobrancas c
    JOIN emprestimos e ON e.cliente_id = c.id
    WHERE e.status IN ('Ativo', 'Pendente')
      AND e.status <> 'Quitado'
      AND (
        -- Para empréstimos de parcela única
        (e.tipo_emprestimo != 'in_installments' AND e.data_vencimento < CURDATE())
        OR
        -- Para empréstimos parcelados, verificar se há parcelas atrasadas
        (e.tipo_emprestimo = 'in_installments' AND EXISTS (
          SELECT 1 FROM parcelas p 
          WHERE p.emprestimo_id = e.id 
            AND p.data_vencimento < CURDATE() 
            AND p.status != 'Paga'
        ))
      )
    `);
    
    await connection.end();
    
  } catch (error) {
    console.error('❌ Erro no diagnóstico:', error);
  }
}

// Executar o diagnóstico
diagnoseClientesAtraso(); 