const mysql = require('mysql2/promise');

// Configuração do banco de dados
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'jp_cobrancas',
  charset: 'utf8mb4'
};

async function fixDataStatusEmprestimos() {
  let connection;
  let emprestimosCorrigidos = 0;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('🔗 Conectado ao banco de dados');
    
    console.log('\n=== CORREÇÃO DE DATAS E STATUS DOS EMPRÉSTIMOS ===');
    
    // 1. Buscar empréstimos com problemas de status
    console.log('\n🔍 Buscando empréstimos com problemas de status...');
    
    const [emprestimos] = await connection.execute(`
      SELECT e.id, e.cliente_id, e.valor, e.data_vencimento, e.status, e.tipo_emprestimo, e.numero_parcelas,
             c.nome as cliente_nome
      FROM emprestimos e
      LEFT JOIN clientes_cobrancas c ON e.cliente_id = c.id
      WHERE e.status IN ('Ativo', 'Em Atraso')
      ORDER BY e.data_vencimento
    `);
    
    console.log(`📋 Encontrados ${emprestimos.length} empréstimos para análise`);
    
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    for (const emp of emprestimos) {
      console.log(`\n${'-'.repeat(50)}`);
      console.log(`📄 Analisando empréstimo ID: ${emp.id}`);
      console.log(`   Cliente: ${emp.cliente_nome || 'N/A'}`);
      console.log(`   Data Vencimento: ${emp.data_vencimento}`);
      console.log(`   Status atual: ${emp.status}`);
      console.log(`   Parcelas: ${emp.numero_parcelas || 1}`);
      
      const dataVencimento = new Date(emp.data_vencimento);
      dataVencimento.setHours(0, 0, 0, 0);
      
      let statusCorreto = emp.status;
      let motivoCorrecao = '';
      
      // Verificar se é empréstimo parcelado
      if (emp.numero_parcelas > 1) {
        // Para empréstimos parcelados, verificar status das parcelas
        const [parcelas] = await connection.execute(`
          SELECT COUNT(*) as total,
                 SUM(CASE WHEN status = 'Paga' THEN 1 ELSE 0 END) as pagas,
                 SUM(CASE WHEN data_vencimento < CURDATE() AND status != 'Paga' THEN 1 ELSE 0 END) as atrasadas
          FROM parcelas
          WHERE emprestimo_id = ?
        `, [emp.id]);
        
        if (parcelas[0].total > 0) {
          if (parcelas[0].pagas === parcelas[0].total) {
            statusCorreto = 'Quitado';
            motivoCorrecao = 'Todas as parcelas estão pagas';
          } else if (parcelas[0].atrasadas > 0) {
            statusCorreto = 'Em Atraso';
            motivoCorrecao = `${parcelas[0].atrasadas} parcela(s) atrasada(s)`;
          } else {
            statusCorreto = 'Ativo';
            motivoCorrecao = 'Nenhuma parcela está atrasada';
          }
        }
        
        console.log(`   Parcelas: ${parcelas[0].total} total, ${parcelas[0].pagas} pagas, ${parcelas[0].atrasadas} atrasadas`);
      } else {
        // Para empréstimos de parcela única, usar data de vencimento
        if (dataVencimento < hoje) {
          statusCorreto = 'Em Atraso';
          motivoCorrecao = 'Data de vencimento passou';
        } else {
          statusCorreto = 'Ativo';
          motivoCorrecao = 'Data de vencimento no futuro';
        }
      }
      
      console.log(`   Status correto: ${statusCorreto}`);
      if (motivoCorrecao) {
        console.log(`   Motivo: ${motivoCorrecao}`);
      }
      
      // Aplicar correção se necessário
      if (statusCorreto !== emp.status) {
        console.log(`   🔧 CORREÇÃO NECESSÁRIA: ${emp.status} → ${statusCorreto}`);
        
        await connection.execute(`
          UPDATE emprestimos 
          SET status = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [statusCorreto, emp.id]);
        
        console.log(`   ✅ Status corrigido com sucesso!`);
        emprestimosCorrigidos++;
      } else {
        console.log(`   ✅ Status correto - nenhuma correção necessária`);
      }
    }
    
    console.log(`\n${'='.repeat(50)}`);
    console.log(`🎉 CORREÇÃO CONCLUÍDA!`);
    console.log(`📊 Empréstimos analisados: ${emprestimos.length}`);
    console.log(`📊 Empréstimos corrigidos: ${emprestimosCorrigidos}`);
    console.log(`📊 Empréstimos já corretos: ${emprestimos.length - emprestimosCorrigidos}`);
    
    await connection.end();
    
  } catch (error) {
    console.error('❌ Erro na correção:', error);
    if (connection) await connection.end();
    process.exit(1);
  }
}

// Executar correção
fixDataStatusEmprestimos().catch(console.error); 