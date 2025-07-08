const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

console.log('🔧 CORREÇÃO DE DATAS DE EMPRÉSTIMOS ANTIGOS');
console.log('='.repeat(50));

async function corrigirDatasEmprestimosAntigos() {
  let rootConnection;
  
  try {
    // Conectar como root para buscar bancos
    rootConnection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'jpsistemas',
      password: process.env.DB_PASSWORD || 'Juliano@95',
      charset: 'utf8mb4'
    });

    console.log('✅ Conectado ao MySQL/MariaDB');
    
    // Buscar bancos jpcobrancas_* (sintaxe compatível com MariaDB)
    const [databases] = await rootConnection.execute(`
      SELECT SCHEMA_NAME as database_name 
      FROM information_schema.SCHEMATA 
      WHERE SCHEMA_NAME LIKE 'jpcobrancas_%'
    `);
    
    console.log(`📊 Encontrados ${databases.length} bancos de cobranças:`);
    databases.forEach(db => console.log(`  - ${db.database_name}`));
    
    if (databases.length === 0) {
      console.log('❌ Nenhum banco jpcobrancas_* encontrado!');
      return;
    }
    
    let totalEmprestimosCorrigidos = 0;
    
    // Processar cada banco
    for (const database of databases) {
      const dbName = database.database_name;
      console.log(`\n🔍 Processando banco: ${dbName}`);
      
      try {
        // Conectar ao banco específico
        const connection = await mysql.createConnection({
          host: process.env.DB_HOST || 'localhost',
          user: process.env.DB_USER || 'jpsistemas',
          password: process.env.DB_PASSWORD || 'Juliano@95',
          database: dbName,
          charset: 'utf8mb4'
        });
        
        // Verificar se existe tabela emprestimos
        const [tables] = await connection.execute(`
          SELECT TABLE_NAME 
          FROM information_schema.TABLES 
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'emprestimos'
        `, [dbName]);
        
        if (tables.length === 0) {
          console.log(`  ⚠️  Tabela 'emprestimos' não encontrada em ${dbName}`);
          await connection.end();
          continue;
        }
        
        // Buscar empréstimos com datas iguais
        const [emprestimosProblema] = await connection.execute(`
          SELECT id, data_emprestimo, data_vencimento, created_at, valor, juros_mensal
          FROM emprestimos
          WHERE data_emprestimo = data_vencimento
          ORDER BY id
        `);
        
        console.log(`  📊 Encontrados ${emprestimosProblema.length} empréstimos para corrigir`);
        
        if (emprestimosProblema.length === 0) {
          console.log(`  ✅ Nenhum empréstimo precisa de correção em ${dbName}`);
          await connection.end();
          continue;
        }
        
        // Mostrar alguns exemplos antes da correção
        console.log(`  📝 Exemplos de empréstimos com problema:`);
        emprestimosProblema.slice(0, 3).forEach(emp => {
          console.log(`    - ID ${emp.id}: data_emprestimo=${emp.data_emprestimo}, data_vencimento=${emp.data_vencimento}, created_at=${emp.created_at}`);
        });
        
        // Corrigir cada empréstimo
        for (const emprestimo of emprestimosProblema) {
          let novaDataEmprestimo;
          
          if (emprestimo.created_at) {
            // Usar created_at se disponível
            novaDataEmprestimo = new Date(emprestimo.created_at);
          } else {
            // Fallback: 1 dia antes do vencimento
            const dataVencimento = new Date(emprestimo.data_vencimento);
            novaDataEmprestimo = new Date(dataVencimento);
            novaDataEmprestimo.setDate(dataVencimento.getDate() - 1);
          }
          
          // Formatar data para MySQL
          const dataFormatada = novaDataEmprestimo.toISOString().slice(0, 10);
          
          // Atualizar empréstimo
          await connection.execute(`
            UPDATE emprestimos 
            SET data_emprestimo = ? 
            WHERE id = ?
          `, [dataFormatada, emprestimo.id]);
          
          console.log(`    ✅ ID ${emprestimo.id}: data_emprestimo atualizada para ${dataFormatada}`);
          totalEmprestimosCorrigidos++;
        }
        
        await connection.end();
        console.log(`  🎉 Banco ${dbName} processado com sucesso!`);
        
      } catch (error) {
        console.error(`  ❌ Erro ao processar banco ${dbName}:`, error.message);
        continue;
      }
    }
    
    console.log(`\n${'='.repeat(50)}`);
    console.log(`🎉 CORREÇÃO CONCLUÍDA!`);
    console.log(`📊 Total de empréstimos corrigidos: ${totalEmprestimosCorrigidos}`);
    console.log(`📊 Bancos processados: ${databases.length}`);
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  } finally {
    if (rootConnection) {
      await rootConnection.end();
      console.log('🔌 Conexão encerrada');
    }
  }
}

// Executar o script
if (require.main === module) {
  corrigirDatasEmprestimosAntigos()
    .then(() => {
      console.log('\n✅ Script finalizado com sucesso!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Erro fatal:', error);
      process.exit(1);
    });
}

module.exports = { corrigirDatasEmprestimosAntigos }; 