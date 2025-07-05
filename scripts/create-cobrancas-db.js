require('dotenv').config();
const mysql = require('mysql2/promise');

if (process.argv.length < 4) {
  console.error('Uso: node scripts/create-cobrancas-db.js <usuario> <senha>');
  process.exit(1);
}

const username = process.argv[2];
const userPassword = process.argv[3];
const dbName = `jpcobrancas_${username.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
const dbUser = dbName;

const rootConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'jpsistemas',
  password: process.env.DB_PASSWORD || 'Juliano@95',
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306
};

const tables = [
  `CREATE TABLE IF NOT EXISTS clientes_cobrancas (
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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS emprestimos (
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
    FOREIGN KEY (cliente_id) REFERENCES clientes_cobrancas(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS cobrancas (
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
    FOREIGN KEY (cliente_id) REFERENCES clientes_cobrancas(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS pagamentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cobranca_id INT,
    valor_pago DECIMAL(10,2) NOT NULL,
    data_pagamento DATE NOT NULL,
    forma_pagamento VARCHAR(50),
    observacoes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cobranca_id) REFERENCES cobrancas(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
];

async function main() {
  try {
    console.log(`Criando banco de dados: ${dbName}`);
    const rootConn = await mysql.createConnection(rootConfig);
    await rootConn.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    // Cria usuário e senha
    await rootConn.execute(`CREATE USER IF NOT EXISTS '${dbUser}'@'localhost' IDENTIFIED BY '${userPassword}'`);
    await rootConn.execute(`GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO '${dbUser}'@'localhost'`);
    await rootConn.execute(`FLUSH PRIVILEGES`);
    await rootConn.end();

    const userConn = await mysql.createConnection({ ...rootConfig, user: dbUser, password: userPassword, database: dbName });
    for (const sql of tables) {
      await userConn.execute(sql);
    }
    await userConn.end();

    console.log(`Banco de dados ${dbName} e usuário ${dbUser} criados com sucesso!`);
  } catch (err) {
    console.error('Erro ao criar banco:', err);
    process.exit(1);
  }
}

main(); 