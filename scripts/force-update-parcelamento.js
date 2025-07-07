/**
 * Script para Forçar Atualização da Estrutura de Parcelamento
 * Atualiza todos os bancos mesmo se alguns campos já existirem
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

// Configuração do banco
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'jpcobrancas',
  password: process.env.DB_PASSWORD || 'Juliano@95',
  port: process.env.DB_PORT || 3306,
  charset: 'utf8mb4'
};

async function forceUpdateParcelamento() {
  console.log('=== FORÇANDO ATUALIZAÇÃO DE PARCELAMENTO ===\n');

  try {
    // Conectar ao banco principal
    const connection = await mysql.createConnection(dbConfig);
    
    // Listar todos os bancos de cobranças
    const [databases] = await connection.execute(`
      SELECT SCHEMA_NAME 
      FROM INFORMATION_SCHEMA.SCHEMATA 
      WHERE SCHEMA_NAME LIKE 'jpcobrancas_%'
    `);

    console.log(`Encontrados ${databases.length} bancos de cobranças`);

    for (const db of databases) {
      const dbName = db.SCHEMA_NAME;
      console.log(`\n--- Forçando atualização do banco: ${dbName} ---`);
      
      try {
        // Conectar ao banco específico
        const dbConnection = await mysql.createConnection({
          ...dbConfig,
          database: dbName
        });

        // Verificar estrutura atual da tabela emprestimos
        console.log('Verificando estrutura atual...');
        const [currentStructure] = await dbConnection.execute(`
          DESCRIBE emprestimos
        `);
        
        const currentColumns = currentStructure.map(col => col.Field);
        console.log('Colunas atuais:', currentColumns.join(', '));

        // Adicionar campos de parcelamento (com tratamento de erro)
        console.log('Adicionando campos de parcelamento...');
        
        const newFields = [
          'tipo_emprestimo ENUM("fixed", "in_installments") DEFAULT "fixed"',
          'numero_parcelas INT DEFAULT 1',
          'frequencia ENUM("daily", "weekly", "biweekly", "monthly") DEFAULT "monthly"',
          'valor_parcela DECIMAL(10,2) DEFAULT 0.00'
        ];

        for (const field of newFields) {
          const fieldName = field.split(' ')[0];
          if (!currentColumns.includes(fieldName)) {
            try {
              await dbConnection.execute(`ALTER TABLE emprestimos ADD COLUMN ${field} AFTER observacoes`);
              console.log(`✅ Campo ${fieldName} adicionado`);
            } catch (error) {
              if (error.code === 'ER_DUP_FIELDNAME') {
                console.log(`⚠️  Campo ${fieldName} já existe`);
              } else {
                console.error(`❌ Erro ao adicionar ${fieldName}:`, error.message);
              }
            }
          } else {
            console.log(`⚠️  Campo ${fieldName} já existe`);
          }
        }

        // Adicionar índice se não existir
        try {
          await dbConnection.execute(`ALTER TABLE emprestimos ADD INDEX idx_tipo_emprestimo (tipo_emprestimo)`);
          console.log('✅ Índice idx_tipo_emprestimo adicionado');
        } catch (error) {
          if (error.code === 'ER_DUP_KEYNAME') {
            console.log('⚠️  Índice idx_tipo_emprestimo já existe');
          } else {
            console.error('❌ Erro ao adicionar índice:', error.message);
          }
        }

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
        console.log('✅ Tabela parcelas criada/verificada');

        // Migrar empréstimos existentes
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
            console.log(`✅ Parcela criada para empréstimo ${emprestimo.id}`);
          }
        }

        // Verificar estrutura final
        console.log('Verificando estrutura final...');
        const [finalStructure] = await dbConnection.execute(`
          DESCRIBE emprestimos
        `);
        
        const finalColumns = finalStructure.map(col => col.Field);
        const hasParcelamento = finalColumns.some(col => 
          ['tipo_emprestimo', 'numero_parcelas', 'frequencia', 'valor_parcela'].includes(col)
        );
        
        console.log(`Estrutura final: ${hasParcelamento ? '✅ Com parcelamento' : '❌ Sem parcelamento'}`);

        await dbConnection.end();
        console.log(`✅ ${dbName} atualizado com sucesso!`);

      } catch (error) {
        console.error(`❌ Erro ao atualizar ${dbName}:`, error.message);
      }
    }

    await connection.end();
    console.log('\n=== ATUALIZAÇÃO FORÇADA CONCLUÍDA ===');

  } catch (error) {
    console.error('Erro geral:', error);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  forceUpdateParcelamento();
}

module.exports = { forceUpdateParcelamento }; 