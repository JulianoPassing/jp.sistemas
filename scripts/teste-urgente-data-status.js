const mysql = require('mysql2/promise');

// Configuração do banco de dados
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'jp_cobrancas',
  charset: 'utf8mb4'
};

async function testeUrgenteDataStatus() {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('🔗 Conectado ao banco de dados');
    
    // Buscar empréstimo específico do usuário (nome "Dedé")
    const [emprestimos] = await connection.execute(`
      SELECT e.id, e.cliente_id, e.valor, e.data_vencimento, e.status, e.numero_parcelas,
             c.nome as cliente_nome
      FROM emprestimos e
      LEFT JOIN clientes_cobrancas c ON e.cliente_id = c.id
      WHERE c.nome LIKE '%Dedé%' OR c.nome LIKE '%Dede%'
      ORDER BY e.id DESC
      LIMIT 1
    `);
    
    if (emprestimos.length === 0) {
      console.log('❌ Empréstimo do Dedé não encontrado');
      return;
    }
    
    const emp = emprestimos[0];
    console.log('\n📋 EMPRÉSTIMO ENCONTRADO:');
    console.log(`   ID: ${emp.id}`);
    console.log(`   Cliente: ${emp.cliente_nome}`);
    console.log(`   Data atual: ${emp.data_vencimento}`);
    console.log(`   Status atual: ${emp.status}`);
    console.log(`   Parcelas: ${emp.numero_parcelas}`);
    
    // Testar formatação de data
    console.log('\n🔍 TESTE 1: Formatação de Data');
    const dataEscolhida = '2024-07-15';
    console.log(`   Data escolhida: ${dataEscolhida}`);
    
    // Simular problema de fuso horário
    const dataComProblema = new Date(dataEscolhida);
    const dataFormatadaProblematica = dataComProblema.toISOString().split('T')[0];
    console.log(`   Data com problema (toISOString): ${dataFormatadaProblematica}`);
    
    // Formatação corrigida
    const dataCorrigida = new Date(dataEscolhida);
    const year = dataCorrigida.getFullYear();
    const month = String(dataCorrigida.getMonth() + 1).padStart(2, '0');
    const day = String(dataCorrigida.getDate()).padStart(2, '0');
    const dataFormatadaCorrigida = `${year}-${month}-${day}`;
    console.log(`   Data corrigida: ${dataFormatadaCorrigida}`);
    
    if (dataFormatadaProblematica !== dataEscolhida) {
      console.log('   ❌ PROBLEMA: toISOString() altera a data!');
    } else {
      console.log('   ✅ toISOString() funcionou corretamente');
    }
    
    // Testar recálculo de status
    console.log('\n🔍 TESTE 2: Recálculo de Status');
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataVencimento = new Date(dataEscolhida);
    dataVencimento.setHours(0, 0, 0, 0);
    
    console.log(`   Data hoje: ${hoje.toISOString().split('T')[0]}`);
    console.log(`   Data vencimento: ${dataVencimento.toISOString().split('T')[0]}`);
    
    let statusCalculado;
    if (emp.numero_parcelas > 1) {
      console.log('   📋 Empréstimo parcelado - verificando parcelas...');
      const [parcelas] = await connection.execute(`
        SELECT COUNT(*) as total,
               SUM(CASE WHEN status = 'Paga' THEN 1 ELSE 0 END) as pagas,
               SUM(CASE WHEN data_vencimento < CURDATE() AND status != 'Paga' THEN 1 ELSE 0 END) as atrasadas
        FROM parcelas
        WHERE emprestimo_id = ?
      `, [emp.id]);
      
      console.log(`   Parcelas: ${parcelas[0].total} total, ${parcelas[0].pagas} pagas, ${parcelas[0].atrasadas} atrasadas`);
      
      if (parcelas[0].pagas === parcelas[0].total) {
        statusCalculado = 'Quitado';
      } else if (parcelas[0].atrasadas > 0) {
        statusCalculado = 'Em Atraso';
      } else {
        statusCalculado = 'Ativo';
      }
    } else {
      console.log('   📄 Empréstimo de parcela única - usando data de vencimento');
      if (dataVencimento < hoje) {
        statusCalculado = 'Em Atraso';
      } else {
        statusCalculado = 'Ativo';
      }
    }
    
    console.log(`   Status calculado: ${statusCalculado}`);
    
    // Aplicar correção
    console.log('\n🔧 TESTE 3: Aplicação da Correção');
    console.log(`   Atualizando empréstimo ${emp.id}...`);
    
    await connection.execute(`
      UPDATE emprestimos 
      SET data_vencimento = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [dataEscolhida, statusCalculado, emp.id]);
    
    console.log(`   ✅ Empréstimo atualizado:`);
    console.log(`      Data: ${dataEscolhida}`);
    console.log(`      Status: ${statusCalculado}`);
    
    // Verificar resultado
    console.log('\n🔍 TESTE 4: Verificação Final');
    const [emprestimoAtualizado] = await connection.execute(`
      SELECT data_vencimento, status FROM emprestimos WHERE id = ?
    `, [emp.id]);
    
    console.log('   Resultado no banco:');
    console.log(`      Data: ${emprestimoAtualizado[0].data_vencimento}`);
    console.log(`      Status: ${emprestimoAtualizado[0].status}`);
    
    if (emprestimoAtualizado[0].data_vencimento === dataEscolhida) {
      console.log('   ✅ Data salva corretamente!');
    } else {
      console.log('   ❌ Data não foi salva corretamente!');
    }
    
    if (emprestimoAtualizado[0].status === statusCalculado) {
      console.log('   ✅ Status atualizado corretamente!');
    } else {
      console.log('   ❌ Status não foi atualizado corretamente!');
    }
    
    await connection.end();
    console.log('\n🎉 Teste concluído!');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
    if (connection) await connection.end();
  }
}

// Executar teste
testeUrgenteDataStatus().catch(console.error); 