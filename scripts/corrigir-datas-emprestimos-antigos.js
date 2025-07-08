const mysql = require('mysql2/promise');

// Configuração do banco de dados
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'jpsistemas',
  password: process.env.DB_PASSWORD || 'Juliano@95',
  charset: 'utf8mb4'
};

async function corrigirDatasEmprestimosAntigos() {
  let connection;
  
  try {
    console.log('🔧 Iniciando correção de datas dos empréstimos antigos...');
    
    // Conectar ao MySQL
    connection = await mysql.createConnection(dbConfig);
    
    // Buscar todos os bancos de cobranças
    const [databases] = await connection.execute(`
      SHOW DATABASES LIKE 'jpcobrancas_%'
    `);
    
    console.log(`📋 Encontrados ${databases.length} bancos de cobranças para corrigir`);
    
    let totalEmprestimosCorrigidos = 0;
    
    for (const db of databases) {
      const dbName = db[`Database (jpcobrancas_%)`];
      console.log(`\n🔍 Processando banco: ${dbName}`);
      
      try {
        // Conectar ao banco específico
        await connection.execute(`USE \`${dbName}\``);
        
        // Buscar empréstimos onde data_emprestimo = data_vencimento
        const [emprestimosProblema] = await connection.execute(`
          SELECT id, data_emprestimo, data_vencimento, created_at
          FROM emprestimos 
          WHERE data_emprestimo = data_vencimento
        `);
        
        console.log(`  📊 Encontrados ${emprestimosProblema.length} empréstimos para corrigir`);
        
        if (emprestimosProblema.length === 0) {
          console.log('  ✅ Nenhum empréstimo precisa de correção neste banco');
          continue;
        }
        
        // Corrigir cada empréstimo
        for (const emprestimo of emprestimosProblema) {
          let novaDataEmprestimo;
          
          // Se temos created_at, usar esta data
          if (emprestimo.created_at) {
            novaDataEmprestimo = emprestimo.created_at.toISOString().split('T')[0];
          } else {
            // Caso contrário, usar uma data anterior ao vencimento
            // Assumir que foi criado 1 dia antes do vencimento
            const dataVencimento = new Date(emprestimo.data_vencimento);
            dataVencimento.setDate(dataVencimento.getDate() - 1);
            novaDataEmprestimo = dataVencimento.toISOString().split('T')[0];
          }
          
          // Atualizar o empréstimo
          await connection.execute(`
            UPDATE emprestimos 
            SET data_emprestimo = ? 
            WHERE id = ?
          `, [novaDataEmprestimo, emprestimo.id]);
          
          console.log(`    ✅ Empréstimo ID ${emprestimo.id}: ${emprestimo.data_emprestimo} → ${novaDataEmprestimo}`);
          totalEmprestimosCorrigidos++;
        }
        
      } catch (error) {
        console.error(`  ❌ Erro ao processar banco ${dbName}:`, error.message);
      }
    }
    
    console.log(`\n🎉 Correção concluída! Total de empréstimos corrigidos: ${totalEmprestimosCorrigidos}`);
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Executar apenas se chamado diretamente
if (require.main === module) {
  corrigirDatasEmprestimosAntigos()
    .then(() => {
      console.log('\n✨ Script de correção finalizado!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Erro fatal:', error);
      process.exit(1);
    });
}

module.exports = { corrigirDatasEmprestimosAntigos }; 