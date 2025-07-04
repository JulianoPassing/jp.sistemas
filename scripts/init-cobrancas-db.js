const mysql = require('mysql2/promise');
const { getCobrancasDatabaseConfig } = require('../database-config');
require('dotenv').config();

async function initCobrancasDatabase() {
  try {
    console.log('🚀 Inicializando banco de dados de cobranças...');
    
    // Conectar como root para criar o banco
    const rootConfig = getCobrancasDatabaseConfig();
    const rootConnection = await mysql.createConnection({
      ...rootConfig,
      database: undefined // Sem especificar database para conectar como root
    });

    console.log('📦 Criando banco de dados jpsistemas_cobrancas...');
    await rootConnection.execute(`CREATE DATABASE IF NOT EXISTS \`jpsistemas_cobrancas\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    
    // Conectar ao banco criado
    const cobrancasConnection = await mysql.createConnection(getCobrancasDatabaseConfig());

    console.log('📋 Criando tabelas...');

    // Tabela de clientes
    await cobrancasConnection.execute(`
      CREATE TABLE IF NOT EXISTS clientes_cobrancas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        cpf_cnpj VARCHAR(18),
        email VARCHAR(255),
        telefone VARCHAR(20),
        endereco VARCHAR(255),
        cidade VARCHAR(100),
        estado VARCHAR(2),
        cep VARCHAR(9),
        status VARCHAR(50) DEFAULT 'Ativo',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_nome (nome),
        INDEX idx_cpf_cnpj (cpf_cnpj),
        INDEX idx_email (email),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Tabela clientes_cobrancas criada');

    // Tabela de empréstimos
    await cobrancasConnection.execute(`
      CREATE TABLE IF NOT EXISTS emprestimos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        cliente_id INT,
        valor DECIMAL(10,2) NOT NULL,
        data_emprestimo DATE NOT NULL,
        data_vencimento DATE NOT NULL,
        juros_mensal DECIMAL(5,2) DEFAULT 0.00,
        multa_atraso DECIMAL(5,2) DEFAULT 0.00,
        status VARCHAR(50) DEFAULT 'Ativo',
        observacoes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (cliente_id) REFERENCES clientes_cobrancas(id) ON DELETE SET NULL,
        INDEX idx_cliente_id (cliente_id),
        INDEX idx_data_vencimento (data_vencimento),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Tabela emprestimos criada');

    // Tabela de cobranças
    await cobrancasConnection.execute(`
      CREATE TABLE IF NOT EXISTS cobrancas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        emprestimo_id INT,
        cliente_id INT,
        valor_original DECIMAL(10,2) NOT NULL,
        valor_atualizado DECIMAL(10,2) NOT NULL,
        juros_calculados DECIMAL(10,2) DEFAULT 0.00,
        multa_calculada DECIMAL(10,2) DEFAULT 0.00,
        data_vencimento DATE NOT NULL,
        dias_atraso INT DEFAULT 0,
        status VARCHAR(50) DEFAULT 'Pendente',
        data_cobranca DATE,
        observacoes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (emprestimo_id) REFERENCES emprestimos(id) ON DELETE SET NULL,
        FOREIGN KEY (cliente_id) REFERENCES clientes_cobrancas(id) ON DELETE SET NULL,
        INDEX idx_emprestimo_id (emprestimo_id),
        INDEX idx_cliente_id (cliente_id),
        INDEX idx_data_vencimento (data_vencimento),
        INDEX idx_status (status),
        INDEX idx_dias_atraso (dias_atraso)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Tabela cobrancas criada');

    // Tabela de pagamentos
    await cobrancasConnection.execute(`
      CREATE TABLE IF NOT EXISTS pagamentos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        cobranca_id INT,
        valor_pago DECIMAL(10,2) NOT NULL,
        data_pagamento DATE NOT NULL,
        forma_pagamento VARCHAR(50),
        observacoes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cobranca_id) REFERENCES cobrancas(id) ON DELETE SET NULL,
        INDEX idx_cobranca_id (cobranca_id),
        INDEX idx_data_pagamento (data_pagamento)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Tabela pagamentos criada');

    // Inserir dados de exemplo
    console.log('📝 Inserindo dados de exemplo...');

    // Clientes de exemplo
    const [clientesResult] = await cobrancasConnection.execute(`
      INSERT IGNORE INTO clientes_cobrancas (nome, cpf_cnpj, email, telefone, endereco, cidade, estado, cep) VALUES
      ('João Silva', '123.456.789-00', 'joao@email.com', '(11) 99999-9999', 'Rua das Flores, 123', 'São Paulo', 'SP', '01234-567'),
      ('Maria Santos', '987.654.321-00', 'maria@email.com', '(11) 88888-8888', 'Av. Paulista, 456', 'São Paulo', 'SP', '01345-678'),
      ('Pedro Oliveira', '456.789.123-00', 'pedro@email.com', '(11) 77777-7777', 'Rua Augusta, 789', 'São Paulo', 'SP', '01456-789')
    `);
    console.log(`✅ ${clientesResult.affectedRows} clientes de exemplo inseridos`);

    // Empréstimos de exemplo
    const [emprestimosResult] = await cobrancasConnection.execute(`
      INSERT IGNORE INTO emprestimos (cliente_id, valor, data_emprestimo, data_vencimento, juros_mensal, multa_atraso, observacoes) VALUES
      (1, 1000.00, '2024-01-15', '2024-02-15', 2.5, 5.0, 'Empréstimo pessoal'),
      (2, 2500.00, '2024-01-20', '2024-03-20', 3.0, 7.0, 'Empréstimo para negócio'),
      (3, 800.00, '2024-02-01', '2024-03-01', 2.0, 4.0, 'Empréstimo emergencial')
    `);
    console.log(`✅ ${emprestimosResult.affectedRows} empréstimos de exemplo inseridos`);

    // Cobranças de exemplo
    const [cobrancasResult] = await cobrancasConnection.execute(`
      INSERT IGNORE INTO cobrancas (emprestimo_id, cliente_id, valor_original, valor_atualizado, data_vencimento, status) VALUES
      (1, 1, 1000.00, 1000.00, '2024-02-15', 'Pendente'),
      (2, 2, 2500.00, 2500.00, '2024-03-20', 'Pendente'),
      (3, 3, 800.00, 800.00, '2024-03-01', 'Pendente')
    `);
    console.log(`✅ ${cobrancasResult.affectedRows} cobranças de exemplo inseridas`);

    await rootConnection.end();
    await cobrancasConnection.end();
    
    console.log('🎉 Banco de dados de cobranças inicializado com sucesso!');
    console.log('📊 Dados de exemplo inseridos');
    console.log('🔗 Acesse: http://localhost:3000/jp.cobrancas/');
    
  } catch (error) {
    console.error('❌ Erro ao inicializar banco de dados de cobranças:', error);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  initCobrancasDatabase();
}

module.exports = { initCobrancasDatabase }; 