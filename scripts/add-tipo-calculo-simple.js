const mysql = require('mysql2/promise');

async function addTipoCalculoField() {
  try {
    console.log('=== ADICIONANDO CAMPO TIPO_CALCULO À TABELA EMPRÉSTIMOS ===\n');

    // Configuração do banco (ajuste conforme necessário)
    const dbConfig = {
      host: 'localhost',
      user: 'root',
      password: '', // Coloque sua senha aqui se necessário
      multipleStatements: true
    };

    const connection = await mysql.createConnection(dbConfig);

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
        
        // Usar o banco específico
        await connection.execute(`USE ${db_name}`);

        // Verificar se o campo já existe
        const [columns] = await connection.execute(`
          SELECT COLUMN_NAME 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'emprestimos' AND COLUMN_NAME = 'tipo_calculo'
        `, [db_name]);

        if (columns.length > 0) {
          console.log(`✅ Campo tipo_calculo já existe em ${db_name}`);
          continue;
        }

        // Adicionar campo tipo_calculo
        console.log(`Adicionando campo tipo_calculo em ${db_name}...`);
        await connection.execute(`
          ALTER TABLE emprestimos 
          ADD COLUMN tipo_calculo ENUM('valor_inicial', 'valor_final', 'parcela_fixa') DEFAULT 'valor_inicial'
        `);

        console.log(`✅ ${db_name} atualizado com sucesso!`);

      } catch (error) {
        console.error(`❌ Erro ao atualizar ${db_name}:`, error.message);
      }
    }

    await connection.end();
    console.log('\n=== ATUALIZAÇÃO CONCLUÍDA ===');
    console.log('\nAgora você pode testar a criação de empréstimos novamente!');

  } catch (error) {
    console.error('Erro geral:', error);
    console.log('\n🔧 INSTRUÇÕES MANUAIS:');
    console.log('Se o script não funcionou, execute manualmente no seu banco de dados:');
    console.log('\nPara cada banco cobrancas_USUARIO, execute:');
    console.log('ALTER TABLE emprestimos ADD COLUMN tipo_calculo ENUM(\'valor_inicial\', \'valor_final\', \'parcela_fixa\') DEFAULT \'valor_inicial\';');
  }
}

// Executar
addTipoCalculoField(); 