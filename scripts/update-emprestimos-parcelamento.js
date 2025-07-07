const mysql = require('mysql2/promise');
const { getCobrancasDatabaseConfig } = require('../database-config');

async function updateEmprestimosStructure() {
  try {
    console.log('=== ATUALIZANDO ESTRUTURA DE EMPRÉSTIMOS PARA PARCELAMENTO ===');
    
    // Conectar ao banco principal
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'jpsistemas',
      password: process.env.DB_PASSWORD || 'SuaSenhaForte123!',
      charset: 'utf8mb4'
    });

    // Listar todos os bancos de cobranças
    const [databases] = await connection.execute(`
      SELECT SCHEMA_NAME 
      FROM INFORMATION_SCHEMA.SCHEMATA 
      WHERE SCHEMA_NAME LIKE 'jpsistemas_%'
    `);

    console.log(`Encontrados ${databases.length} bancos de cobranças`);

    for (const db of databases) {
      const dbName = db.SCHEMA_NAME;
      console.log(`\n--- Atualizando banco: ${dbName} ---`);
      
      try {
        // Conectar ao banco específico
        const dbConnection = await mysql.createConnection({
          host: process.env.DB_HOST || 'localhost',
          user: process.env.DB_USER || 'jpsistemas',
          password: process.env.DB_PASSWORD || 'SuaSenhaForte123!',
          database: dbName,
          charset: 'utf8mb4'
        });

        // Verificar se a tabela emprestimos existe
        const [tables] = await dbConnection.execute(`
          SELECT TABLE_NAME 
          FROM INFORMATION_SCHEMA.TABLES 
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'emprestimos'
        `, [dbName]);

        if (tables.length === 0) {
          console.log(`Tabela emprestimos não existe em ${dbName}, pulando...`);
          await dbConnection.end();
          continue;
        }

        // Verificar se os novos campos já existem
        const [columns] = await dbConnection.execute(`
          SELECT COLUMN_NAME 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'emprestimos' AND COLUMN_NAME = 'tipo_emprestimo'
        `, [dbName]);

        if (columns.length > 0) {
          console.log(`Campos de parcelamento já existem em ${dbName}, pulando...`);
          await dbConnection.end();
          continue;
        }

        // Adicionar novos campos à tabela emprestimos
        console.log('Adicionando campos de parcelamento...');
        await dbConnection.execute(`
          ALTER TABLE emprestimos 
          ADD COLUMN tipo_emprestimo ENUM('fixed', 'in_installments') DEFAULT 'fixed' AFTER observacoes,
          ADD COLUMN numero_parcelas INT DEFAULT 1 AFTER tipo_emprestimo,
          ADD COLUMN frequencia ENUM('daily', 'weekly', 'biweekly', 'monthly') DEFAULT 'monthly' AFTER numero_parcelas,
          ADD COLUMN valor_parcela DECIMAL(10,2) DEFAULT 0.00 AFTER frequencia,
          ADD INDEX idx_tipo_emprestimo (tipo_emprestimo)
        `);

        // Criar tabela de parcelas
        console.log('Criando tabela de parcelas...');
        await dbConnection.execute(`
          CREATE TABLE IF NOT EXISTS parcelas (
            id INT AUTO_INCREMENT PRIMARY KEY,
            emprestimo_id INT NOT NULL,
            numero_parcela INT NOT NULL,
            valor_parcela DECIMAL(10,2) NOT NULL,
            data_vencimento DATE NOT NULL,
            status ENUM('Pendente', 'Paga', 'Atrasada') DEFAULT 'Pendente',
            valor_pago DECIMAL(10,2) DEFAULT 0.00,
            data_pagamento DATE NULL,
            juros_aplicados DECIMAL(10,2) DEFAULT 0.00,
            multa_aplicada DECIMAL(10,2) DEFAULT 0.00,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (emprestimo_id) REFERENCES emprestimos(id) ON DELETE CASCADE,
            INDEX idx_emprestimo_id (emprestimo_id),
            INDEX idx_data_vencimento (data_vencimento),
            INDEX idx_status (status),
            UNIQUE KEY unique_emprestimo_parcela (emprestimo_id, numero_parcela)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Migrar empréstimos existentes para criar parcelas únicas
        console.log('Migrando empréstimos existentes...');
        const [emprestimos] = await dbConnection.execute(`
          SELECT id, valor, data_vencimento FROM emprestimos
        `);

        for (const emprestimo of emprestimos) {
          // Verificar se já existe parcela para este empréstimo
          const [parcelas] = await dbConnection.execute(`
            SELECT id FROM parcelas WHERE emprestimo_id = ?
          `, [emprestimo.id]);

          if (parcelas.length === 0) {
            // Criar parcela única para empréstimo existente
            await dbConnection.execute(`
              INSERT INTO parcelas (emprestimo_id, numero_parcela, valor_parcela, data_vencimento)
              VALUES (?, ?, ?, ?)
            `, [emprestimo.id, 1, emprestimo.valor, emprestimo.data_vencimento]);
          }
        }

        console.log(`✅ ${dbName} atualizado com sucesso!`);
        await dbConnection.end();

      } catch (error) {
        console.error(`❌ Erro ao atualizar ${dbName}:`, error.message);
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
  updateEmprestimosStructure();
}

module.exports = { updateEmprestimosStructure }; 