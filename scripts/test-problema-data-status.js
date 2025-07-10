const mysql = require('mysql2/promise');

// Configuração do banco de dados
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'jp_cobrancas',
  charset: 'utf8mb4'
};

// Simular a função formatDateForInput problemática
function formatDateForInputProblematica(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toISOString().split('T')[0];
}

// Função corrigida que não perde um dia
function formatDateForInputCorrigida(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function testProblemaDataStatus() {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('🔗 Conectado ao banco de dados');
    
    console.log('\n=== TESTE DO PROBLEMA DE DATA E STATUS ===');
    
    // 1. Testar problema de fuso horário
    console.log('\n📅 TESTE 1: Problema de Fuso Horário');
    const dataOriginal = '2024-01-15';
    const dataFormatadaProblematica = formatDateForInputProblematica(dataOriginal);
    const dataFormatadaCorrigida = formatDateForInputCorrigida(dataOriginal);
    
    console.log(`Data original: ${dataOriginal}`);
    console.log(`Formatação problemática: ${dataFormatadaProblematica}`);
    console.log(`Formatação corrigida: ${dataFormatadaCorrigida}`);
    
    if (dataFormatadaProblematica !== dataOriginal) {
      console.log('❌ PROBLEMA IDENTIFICADO: Formatação problemática altera a data!');
    } else {
      console.log('✅ Formatação funcionando corretamente');
    }
    
    // 2. Buscar empréstimos com data recente
    console.log('\n🔍 TESTE 2: Empréstimos com Problemas de Status');
    const hoje = new Date();
    const ontem = new Date(hoje);
    ontem.setDate(hoje.getDate() - 1);
    const amanha = new Date(hoje);
    amanha.setDate(hoje.getDate() + 1);
    
    console.log(`Data hoje: ${hoje.toISOString().split('T')[0]}`);
    console.log(`Data ontem: ${ontem.toISOString().split('T')[0]}`);
    console.log(`Data amanhã: ${amanha.toISOString().split('T')[0]}`);
    
    const [emprestimos] = await connection.execute(`
      SELECT e.id, e.cliente_id, e.valor, e.data_vencimento, e.status, e.tipo_emprestimo, e.numero_parcelas,
             c.nome as cliente_nome
      FROM emprestimos e
      LEFT JOIN clientes_cobrancas c ON e.cliente_id = c.id
      WHERE e.data_vencimento >= ? AND e.data_vencimento <= ?
      ORDER BY e.data_vencimento DESC
      LIMIT 10
    `, [ontem.toISOString().split('T')[0], amanha.toISOString().split('T')[0]]);
    
    console.log(`\n📋 Encontrados ${emprestimos.length} empréstimos com data próxima:`);
    
    for (const emp of emprestimos) {
      console.log(`\n${'-'.repeat(50)}`);
      console.log(`📄 Empréstimo ID: ${emp.id}`);
      console.log(`   Cliente: ${emp.cliente_nome || 'N/A'}`);
      console.log(`   Valor: R$ ${emp.valor}`);
      console.log(`   Data Vencimento: ${emp.data_vencimento}`);
      console.log(`   Status atual: ${emp.status}`);
      console.log(`   Tipo: ${emp.tipo_emprestimo || 'N/A'}`);
      console.log(`   Parcelas: ${emp.numero_parcelas || 1}`);
      
      const dataVencimento = new Date(emp.data_vencimento);
      const statusEsperado = dataVencimento < hoje ? 'Em Atraso' : 'Ativo';
      
      console.log(`   Status esperado: ${statusEsperado}`);
      
      if (emp.status !== statusEsperado) {
        console.log(`   🔥 INCONSISTÊNCIA: Status atual (${emp.status}) ≠ Status esperado (${statusEsperado})`);
      }
      
      // Verificar se tem parcelas
      if (emp.numero_parcelas > 1) {
        const [parcelas] = await connection.execute(`
          SELECT numero_parcela, valor_parcela, data_vencimento, status
          FROM parcelas
          WHERE emprestimo_id = ?
          ORDER BY numero_parcela
        `, [emp.id]);
        
        console.log(`   📋 Parcelas (${parcelas.length}):`);
        let statusParcelasCalculado = 'Ativo';
        let parcelasAtrasadas = 0;
        let parcelasPagas = 0;
        
        parcelas.forEach(parcela => {
          const dataVencParcela = new Date(parcela.data_vencimento);
          const atrasada = dataVencParcela < hoje && parcela.status !== 'Paga';
          
          if (parcela.status === 'Paga') {
            parcelasPagas++;
          } else if (atrasada) {
            parcelasAtrasadas++;
          }
          
          console.log(`     ${parcela.numero_parcela}: R$ ${parcela.valor_parcela} | ${parcela.data_vencimento} | ${parcela.status} ${atrasada ? '(ATRASADA)' : ''}`);
        });
        
        if (parcelasPagas === parcelas.length) {
          statusParcelasCalculado = 'Quitado';
        } else if (parcelasAtrasadas > 0) {
          statusParcelasCalculado = 'Em Atraso';
        }
        
        console.log(`   Status baseado em parcelas: ${statusParcelasCalculado}`);
        
        if (emp.status !== statusParcelasCalculado) {
          console.log(`   🔥 INCONSISTÊNCIA PARCELAS: Status atual (${emp.status}) ≠ Status calculado (${statusParcelasCalculado})`);
        }
      }
    }
    
    // 3. Demonstrar o problema de edição
    console.log('\n🛠️ TESTE 3: Simulação de Edição de Data');
    
    if (emprestimos.length > 0) {
      const empTeste = emprestimos[0];
      console.log(`\n📝 Simulando edição do empréstimo ID: ${empTeste.id}`);
      
      const novaData = '2024-01-15'; // Data escolhida pelo usuário
      const dataProcessadaProblematica = formatDateForInputProblematica(novaData);
      const dataProcessadaCorrigida = formatDateForInputCorrigida(novaData);
      
      console.log(`   Data escolhida pelo usuário: ${novaData}`);
      console.log(`   Data processada (problemática): ${dataProcessadaProblematica}`);
      console.log(`   Data processada (corrigida): ${dataProcessadaCorrigida}`);
      
      if (dataProcessadaProblematica !== novaData) {
        console.log(`   ❌ PROBLEMA: Data foi alterada de ${novaData} para ${dataProcessadaProblematica}`);
      }
      
      // Simular atualização no banco
      console.log('\n   📊 Simulando atualização no banco...');
      
      // Backup do status original
      const statusOriginal = empTeste.status;
      
      // Atualizar data
      await connection.execute(`
        UPDATE emprestimos 
        SET data_vencimento = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [novaData, empTeste.id]);
      
      console.log(`   ✅ Data de vencimento atualizada para: ${novaData}`);
      
      // Verificar se o status deveria mudar
      const dataNovaDate = new Date(novaData);
      const statusCalculado = dataNovaDate < hoje ? 'Em Atraso' : 'Ativo';
      
      console.log(`   Status antes da atualização: ${statusOriginal}`);
      console.log(`   Status que deveria ter: ${statusCalculado}`);
      
      if (statusOriginal !== statusCalculado) {
        console.log(`   🔥 PROBLEMA: Status deveria ser recalculado automaticamente!`);
        console.log(`   💡 SOLUÇÃO: Adicionar lógica de recálculo de status na API`);
      }
      
      // Restaurar status original
      await connection.execute(`
        UPDATE emprestimos 
        SET status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [statusOriginal, empTeste.id]);
      
      console.log(`   🔄 Status restaurado para: ${statusOriginal}`);
    }
    
    await connection.end();
    console.log('\n✅ Teste concluído!');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
    if (connection) await connection.end();
  }
}

// Executar teste
testProblemaDataStatus().catch(console.error); 