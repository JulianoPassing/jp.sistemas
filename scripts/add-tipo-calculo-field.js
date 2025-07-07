const mysql = require('mysql2/promise');
const { createCobrancasConnection } = require('../database-config.js');

async function addTipoCalculoField() {
  try {
    console.log('=== ADICIONANDO CAMPO TIPO_CALCULO À TABELA EMPRÉSTIMOS ===\n');

    // Obter conexão com o banco principal
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'jp_sistemas'
    });

    // Buscar todos os bancos de dados de cobranças
    const [databases] = await connection.execute(`
      SELECT SCHEMA_NAME as db_name 
      FROM INFORMATION_SCHEMA.SCHEMATA 
      WHERE SCHEMA_NAME LIKE 'cobrancas_%'
    `);

    console.log(`Encontrados ${databases.length} bancos de dados de cobranças`);

    for (const { db_name } of databases) {
      try {
        console.log(`\n--- Processando ${db_name} ---`);
        
        const dbConnection = await mysql.createConnection({
          host: process.env.DB_HOST || 'localhost',
          user: process.env.DB_USER || 'root',
          password: process.env.DB_PASSWORD || '',
          database: db_name
        });

        // Verificar se o campo já existe
        const [columns] = await dbConnection.execute(`
          SELECT COLUMN_NAME 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'emprestimos' AND COLUMN_NAME = 'tipo_calculo'
        `, [db_name]);

        if (columns.length > 0) {
          console.log(`✅ Campo tipo_calculo já existe em ${db_name}`);
          await dbConnection.end();
          continue;
        }

        // Adicionar campo tipo_calculo
        console.log(`Adicionando campo tipo_calculo em ${db_name}...`);
        await dbConnection.execute(`
          ALTER TABLE emprestimos 
          ADD COLUMN tipo_calculo ENUM('valor_inicial', 'valor_final', 'parcela_fixa') DEFAULT 'valor_inicial' AFTER valor_parcela
        `);

        console.log(`✅ ${db_name} atualizado com sucesso!`);
        await dbConnection.end();

      } catch (error) {
        console.error(`❌ Erro ao atualizar ${db_name}:`, error.message);
      }
    }

    await connection.end();
    console.log('\n=== ATUALIZAÇÃO CONCLUÍDA ===');

  } catch (error) {
    console.error('Erro geral:', error);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  addTipoCalculoField();
}

module.exports = { addTipoCalculoField }; 