const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');
const nodemailer = require('nodemailer');
const AdmZip = require('adm-zip');
const XLSX = require('xlsx');
const { getCobrancasDatabaseConfig } = require('../database-config');
const bcrypt = require('bcryptjs');

const router = express.Router();

/** Valores DECIMAL do MySQL chegam como string; aceita também formato pt-BR (1.234,56). */
function mysqlDecimalToNumber(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = String(v).trim().replace(/\s/g, '');
  if (!s) return 0;
  if (/^-?\d+(\.\d+)?$/.test(s)) return parseFloat(s);
  if (s.includes(',')) {
    const n = parseFloat(s.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/** Texto amigável: "2 mês(es) em aberto", etc. */
function mensagemPeriodosEmAberto(periodos, frequencia) {
  const p = Math.max(0, Math.floor(Number(periodos) || 0));
  if (p < 1) return '';
  const f = String(frequencia || 'monthly').toLowerCase();
  if (f === 'daily') return p === 1 ? '1 dia em aberto' : `${p} dias em aberto`;
  if (f === 'weekly') return p === 1 ? '1 semana em aberto' : `${p} semanas em aberto`;
  if (f === 'biweekly') return p === 1 ? '1 quinzena em aberto' : `${p} quinzenas em aberto`;
  return p === 1 ? '1 mês em aberto' : `${p} meses em aberto`;
}

/**
 * Juros por período de atraso (mensal / semanal / quinzenal / diário):
 * Só em empréstimo de UMA cobrança (valor fixo): aplica % × períodos sobre o capital.
 * Empréstimo PARCELADO: cada cobrança é valor fixo de parcela — sem juros mensais empilhados; só multa % se houver.
 * Mensal: períodos de 30 dias corridos (CEIL), não TIMESTAMPDIFF(MONTH) — ex.: 12/03→13/04 ≈ 32 dias = 2 períodos.
 * Teto por frequência evita valor_atualizado explodir (dívidas muito antigas / datas ruins inflando o dashboard).
 * Usa a mesma expressão no UPDATE e no SELECT.
 */
const SQL_PERIODOS_ATRASO = `
  CASE WHEN cb.data_vencimento >= CURDATE() THEN 0
  ELSE LEAST(
    (
      CASE LOWER(TRIM(COALESCE(e.frequencia, 'monthly')))
        WHEN 'daily' THEN GREATEST(0, TIMESTAMPDIFF(DAY, cb.data_vencimento, CURDATE()))
        WHEN 'weekly' THEN GREATEST(0, TIMESTAMPDIFF(WEEK, cb.data_vencimento, CURDATE()))
        WHEN 'biweekly' THEN FLOOR(GREATEST(0, DATEDIFF(CURDATE(), cb.data_vencimento)) / 14)
        WHEN 'monthly' THEN CEILING(GREATEST(0, DATEDIFF(CURDATE(), cb.data_vencimento)) / 30)
        ELSE CEILING(GREATEST(0, DATEDIFF(CURDATE(), cb.data_vencimento)) / 30)
      END
    ),
    (
      CASE LOWER(TRIM(COALESCE(e.frequencia, 'monthly')))
        WHEN 'daily' THEN 3650
        WHEN 'weekly' THEN 520
        WHEN 'biweekly' THEN 260
        WHEN 'monthly' THEN 120
        ELSE 120
      END
    )
  )
  END`;

/** Parcelado: mais de uma parcela OU tipo in_installments — sem juros de mora por calendário, só multa opcional. */
const SQL_EMPRESTIMO_PARCELADO = `
  (COALESCE(e.numero_parcelas, 1) > 1 OR LOWER(TRIM(COALESCE(e.tipo_emprestimo, 'fixed'))) = 'in_installments')
`;

/** Períodos para exibição em listagens: 0 em parcelado (não há “meses de juros” empilhados por calendário). */
const SQL_PERIODOS_EM_ABERTO_LISTAGEM = `
  CASE WHEN ${SQL_EMPRESTIMO_PARCELADO.trim()}
    THEN 0
    ELSE (${SQL_PERIODOS_ATRASO})
  END`;

const SQL_UPDATE_COBRANCAS_JUROS_POR_PERIODO = `
  UPDATE cobrancas cb
  INNER JOIN emprestimos e ON e.id = cb.emprestimo_id
  SET
    cb.dias_atraso = CASE WHEN cb.data_vencimento < CURDATE() THEN DATEDIFF(CURDATE(), cb.data_vencimento) ELSE 0 END,
    cb.juros_calculados = CASE
      WHEN ${SQL_EMPRESTIMO_PARCELADO} THEN 0
      ELSE COALESCE(e.juros_mensal, 0) * (${SQL_PERIODOS_ATRASO})
    END,
    cb.multa_calculada = CASE
      WHEN cb.data_vencimento < CURDATE() AND COALESCE(e.multa_atraso, 0) > 0 THEN COALESCE(e.multa_atraso, 0)
      ELSE 0
    END,
    cb.valor_atualizado = CASE
      WHEN ${SQL_EMPRESTIMO_PARCELADO} THEN
        cb.valor_original * (
          1 + (
            CASE
              WHEN cb.data_vencimento < CURDATE() AND COALESCE(e.multa_atraso, 0) > 0 THEN COALESCE(e.multa_atraso, 0)
              ELSE 0
            END / 100
          )
        )
      ELSE
        COALESCE(NULLIF(e.valor, 0), cb.valor_original) * (
          1
          + (COALESCE(e.juros_mensal, 0) * (${SQL_PERIODOS_ATRASO}) / 100)
          + (
              CASE
                WHEN cb.data_vencimento < CURDATE() AND COALESCE(e.multa_atraso, 0) > 0 THEN COALESCE(e.multa_atraso, 0)
                ELSE 0
              END / 100
            )
        )
    END
  WHERE TRIM(UPPER(cb.status)) = 'PENDENTE'
`;

// Multer para backup por e-mail: 1 arquivo ZIP (reduz tamanho do upload e evita 413)
const uploadBackupEmail = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
}).single('backup_zip');

// Função para criar conexão com banco de cobranças do usuário
async function createCobrancasConnection(username) {
  const dbName = `jpcobrancas_${username.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'jpsistemas',
    password: process.env.DB_PASSWORD || 'Juliano@95',
    database: dbName,
    charset: 'utf8mb4'
  };
  
  try {
    const connection = await mysql.createConnection(dbConfig);
    return connection;
  } catch (error) {
    console.error(`Erro ao conectar ao banco de cobranças do usuário ${username}:`, error);
    throw error;
  }
}

/** ALTER TABLE incremental para emprestimos em bases criadas antes das colunas de parcelamento */
async function ensureEmprestimosSchemaUpToDate(connection) {
  const addCol = async (sql) => {
    try {
      await connection.execute(sql);
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') {
        console.warn('Migração emprestimos:', e.message);
      }
    }
  };
  await addCol(`
    ALTER TABLE emprestimos
    ADD COLUMN tipo_emprestimo ENUM('fixed', 'in_installments') DEFAULT 'fixed' AFTER observacoes
  `);
  await addCol(`
    ALTER TABLE emprestimos
    ADD COLUMN numero_parcelas INT DEFAULT 1 AFTER tipo_emprestimo
  `);
  await addCol(`
    ALTER TABLE emprestimos
    ADD COLUMN frequencia ENUM('daily', 'weekly', 'biweekly', 'monthly') DEFAULT 'monthly' AFTER numero_parcelas
  `);
  await addCol(`
    ALTER TABLE emprestimos
    ADD COLUMN valor_parcela DECIMAL(10,2) DEFAULT 0.00 AFTER frequencia
  `);
  await addCol(`
    ALTER TABLE emprestimos
    ADD COLUMN tipo_calculo VARCHAR(32) DEFAULT NULL AFTER valor_parcela
  `);
  try {
    const [rows] = await connection.execute(`
      SELECT COLUMN_TYPE AS ct
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'emprestimos' AND COLUMN_NAME = 'juros_mensal'
    `);
    const ct = rows[0]?.ct || '';
    if (ct.includes('5,2')) {
      await connection.execute(
        'ALTER TABLE emprestimos MODIFY COLUMN juros_mensal DECIMAL(12,6) DEFAULT 0'
      );
    }
  } catch (e) {
    console.warn('Migração juros_mensal DECIMAL:', e.message);
  }
  try {
    const [rows] = await connection.execute(`
      SELECT COLUMN_TYPE AS ct
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'emprestimos' AND COLUMN_NAME = 'multa_atraso'
    `);
    const ct = rows[0]?.ct || '';
    if (ct.includes('5,2')) {
      await connection.execute(
        'ALTER TABLE emprestimos MODIFY COLUMN multa_atraso DECIMAL(12,6) DEFAULT 0'
      );
    }
  } catch (e) {
    console.warn('Migração multa_atraso DECIMAL:', e.message);
  }
}

// Função para criar banco de dados de cobranças do usuário
async function createCobrancasDatabase(username) {
  const dbName = `jpcobrancas_${username.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  
  try {
    // Conectar como root para criar o banco
    const rootConnection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'jpsistemas',
      password: process.env.DB_PASSWORD || 'Juliano@95',
      charset: 'utf8mb4'
    });

    // Criar banco de dados
    await rootConnection.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    
    // Conectar ao banco criado
    const cobrancasConnection = await createCobrancasConnection(username);

    // Criar tabelas
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
        observacoes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_nome (nome),
        INDEX idx_cpf_cnpj (cpf_cnpj),
        INDEX idx_email (email),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await cobrancasConnection.execute(`
      CREATE TABLE IF NOT EXISTS emprestimos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        cliente_id INT,
        valor DECIMAL(10,2) NOT NULL,
        data_emprestimo DATE NOT NULL,
        data_vencimento DATE NOT NULL,
        juros_mensal DECIMAL(12,6) DEFAULT 0.000000,
        multa_atraso DECIMAL(12,6) DEFAULT 0.000000,
        status VARCHAR(50) DEFAULT 'Ativo',
        observacoes TEXT,
        tipo_emprestimo ENUM('fixed', 'in_installments') DEFAULT 'fixed',
        numero_parcelas INT DEFAULT 1,
        frequencia ENUM('daily', 'weekly', 'biweekly', 'monthly') DEFAULT 'monthly',
        valor_parcela DECIMAL(10,2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (cliente_id) REFERENCES clientes_cobrancas(id) ON DELETE SET NULL,
        INDEX idx_cliente_id (cliente_id),
        INDEX idx_data_vencimento (data_vencimento),
        INDEX idx_status (status),
        INDEX idx_tipo_emprestimo (tipo_emprestimo)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

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

    await cobrancasConnection.execute(`
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

    await cobrancasConnection.execute(`
      CREATE TABLE IF NOT EXISTS cliente_cobrancas_documentos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        cliente_id INT NOT NULL,
        nome_original VARCHAR(255) NOT NULL,
        nome_arquivo VARCHAR(255) NOT NULL,
        caminho VARCHAR(500) NOT NULL,
        tipo_mime VARCHAR(100) NOT NULL,
        tamanho INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cliente_id) REFERENCES clientes_cobrancas(id) ON DELETE CASCADE,
        INDEX idx_cliente_id (cliente_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Tabela de configurações do usuário
    await cobrancasConnection.execute(`
      CREATE TABLE IF NOT EXISTS configuracoes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        chave_pix VARCHAR(255) DEFAULT NULL,
        nome_banco_pix VARCHAR(255) DEFAULT NULL,
        msg_parcela TEXT DEFAULT NULL,
        msg_emprestimo_com_juros TEXT DEFAULT NULL,
        msg_emprestimo_sem_juros TEXT DEFAULT NULL,
        msg_parcelas_vencidas TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    // Garantir coluna nome_banco_pix em bases mais antigas
    try {
      await cobrancasConnection.execute('ALTER TABLE configuracoes ADD COLUMN nome_banco_pix VARCHAR(255) DEFAULT NULL');
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') throw e;
    }

    // Migrações emprestimos: bases antigas só tinham CREATE inicial sem parcelamento / tipo_calculo
    await ensureEmprestimosSchemaUpToDate(cobrancasConnection);

    // Inserir registro padrão de configurações se não existir
    const [configExists] = await cobrancasConnection.execute('SELECT COUNT(*) as total FROM configuracoes');
    if (configExists[0].total === 0) {
      await cobrancasConnection.execute(`
        INSERT INTO configuracoes (chave_pix, nome_banco_pix, msg_parcela, msg_emprestimo_com_juros, msg_emprestimo_sem_juros, msg_parcelas_vencidas) 
        VALUES (NULL, NULL, NULL, NULL, NULL, NULL)
      `);
    }

    await rootConnection.end();
    await cobrancasConnection.end();
    
    console.log(`Banco de dados ${dbName} criado com sucesso para o usuário ${username}`);
    return true;
  } catch (error) {
    console.error(`Erro ao criar banco de dados de cobranças para ${username}:`, error);
    throw error;
  }
}

// Middleware para inicializar banco se necessário
async function ensureDatabase(req, res, next) {
  try {
    const username = req.session.cobrancasUser;
    if (!username) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }
    await createCobrancasDatabase(username);
    next();
  } catch (error) {
    console.error('Erro ao garantir banco de dados:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

// Função para calcular próxima data de vencimento baseado na frequência
// Mensal: +1 mês mantendo o dia (com ajuste para fev 28/29 e meses de 30 dias)
// Semanal: +7 dias | Quinzenal: +14 dias | Diário: +1 dia
function calcularProximaDataVencimento(dataVencimentoAtual, frequencia) {
  const data = new Date(dataVencimentoAtual);
  const freq = frequencia || 'monthly';

  switch (freq) {
    case 'daily':
      data.setDate(data.getDate() + 1);
      break;
    case 'weekly':
      data.setDate(data.getDate() + 7);
      break;
    case 'biweekly':
      data.setDate(data.getDate() + 14);
      break;
    case 'monthly':
    default: {
      const diaAtual = data.getDate();
      const mesAtual = data.getMonth();
      const anoAtual = data.getFullYear();
      // Fevereiro dia 28/29: foi ajuste de 29/30/31 -> próximo mês volta a 31
      // Mês 30 dias (abr,jun,set,nov) dia 30: foi ajuste de 31 -> próximo mês volta a 31
      const diaAlvo = (mesAtual === 1 && diaAtual >= 28) ||  // fev 28 ou 29
        (diaAtual === 30 && [3, 5, 8, 10].includes(mesAtual))  // último dia de abr,jun,set,nov
        ? 31
        : diaAtual;

      const proxMes = mesAtual === 11 ? 0 : mesAtual + 1;
      const proxAno = mesAtual === 11 ? anoAtual + 1 : anoAtual;
      const ultimoDiaMes = new Date(proxAno, proxMes + 1, 0).getDate();
      data.setFullYear(proxAno, proxMes, Math.min(diaAlvo, ultimoDiaMes));
      break;
    }
  }

  return data;
}

// Função helper para cálculos padronizados de empréstimos
function calcularValoresEmprestimo(emprestimo) {
  const valorInicial = parseFloat(emprestimo.valor || 0);
  const valorParcela = parseFloat(emprestimo.valor_parcela || 0);
  const numeroParcelas = parseInt(emprestimo.numero_parcelas || 1);
  const jurosMensal = parseFloat(emprestimo.juros_mensal || 0);
  const tipoEmprestimo = emprestimo.tipo_emprestimo || 'fixed';
  
  let valorFinal = 0;
  let valorAtualizado = 0;
  
  if (tipoEmprestimo === 'in_installments' && valorParcela > 0 && numeroParcelas > 0) {
    // Empréstimo parcelado
    valorFinal = valorParcela * numeroParcelas;
    valorAtualizado = valorFinal;
  } else if (valorInicial > 0 && jurosMensal > 0) {
    // Empréstimo fixo com juros
    valorFinal = valorInicial * (1 + (jurosMensal / 100));
    valorAtualizado = valorFinal;
  } else {
    // Empréstimo sem juros ou dados incompletos
    valorFinal = valorInicial;
    valorAtualizado = valorInicial;
  }
  
  return {
    valor_inicial: valorInicial,
    valor_final: valorFinal,
    valor_atualizado: valorAtualizado,
    valor_parcela: valorParcela,
    numero_parcelas: numeroParcelas,
    juros_mensal: jurosMensal,
    tipo_emprestimo: tipoEmprestimo
  };
}

// Função para determinar status padronizado de empréstimo
async function determinarStatusEmprestimo(emprestimo, connection) {
  const emprestimoId = emprestimo.id;
  let status = (emprestimo.status || 'Ativo').toUpperCase();
  
  try {
    // Verificar se tem parcelas
    const [parcelas] = await connection.execute(
      'SELECT * FROM parcelas WHERE emprestimo_id = ? ORDER BY numero_parcela',
      [emprestimoId]
    );
    
    if (parcelas.length > 0) {
      // Empréstimo parcelado - verificar status das parcelas
      const hojeStr = new Date().toISOString().slice(0, 10);
      const parcelasPagas = parcelas.filter(p => p.status === 'Paga');
      const parcelasAtrasadas = parcelas.filter(p => {
        // Comparar datas como string
        return p.data_vencimento < hojeStr && p.status !== 'Paga';
      });
      
      if (parcelasPagas.length === parcelas.length) {
        status = 'QUITADO';
      } else if (parcelasAtrasadas.length > 0) {
        status = 'ATRASADO';
      } else {
        status = 'ATIVO';
      }
    } else {
      // Empréstimo de valor único - verificar data de vencimento
      const hojeStr = new Date().toISOString().slice(0, 10);
      if (status === 'QUITADO') {
        // Manter status quitado
      } else if (emprestimo.data_vencimento && emprestimo.data_vencimento < hojeStr) {
        status = 'ATRASADO';
      } else {
        status = 'ATIVO';
      }
    }
  } catch (error) {
    console.warn('Erro ao determinar status do empréstimo', emprestimoId, error.message);
  }
  
  return status;
}

// Dashboard - Versão Corrigida com Cálculos Padronizados
router.get('/dashboard', ensureDatabase, async (req, res) => {
  try {
    console.log('Dashboard: Iniciando busca de dados');
    const username = req.session.cobrancasUser;
    console.log('Dashboard: Username da sessão:', username);
    
    if (!username) {
      console.log('Dashboard: Erro - usuário não autenticado');
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }
    
    const connection = await createCobrancasConnection(username);
    console.log('Dashboard: Conexão criada com sucesso');
    
    // Valores padrão para evitar erros
    let emprestimosStats = [{ 
      total_emprestimos: 0, 
      valor_total_inicial: 0,
      valor_total_final: 0,
      emprestimos_ativos: 0, 
      emprestimos_quitados: 0 
    }];
    let cobrancasStats = [{ 
      total_cobrancas: 0, 
      valor_total_cobrancas: 0, 
      cobrancas_pendentes: 0, 
      cobrancas_pagas: 0, 
      valor_atrasado: 0 
    }];
    let clientesStats = [{ total_clientes: 0 }];
    let emprestimosRecentes = [];
    let cobrancasPendentes = [];
    let clientesEmAtraso = [{ total: 0 }];
    let emprestimosEmAtraso = [{ total: 0 }];
    let clientesAtivos = [{ total: 0 }];
    let emprestimosAtivos = [{ total: 0 }];
    
    try {
      // Juros por período (frequência do empréstimo) + multa — mesma regra do GET /cobrancas
      console.log('Dashboard: Atualizando cobranças pendentes (juros por período de atraso)');
      await connection.execute(SQL_UPDATE_COBRANCAS_JUROS_POR_PERIODO);
      console.log('Dashboard: Cobranças pendentes atualizadas');
    } catch (error) {
      console.log('Dashboard: Erro ao atualizar cobranças pendentes:', error.message);
    }

    try {
      // Estatísticas de empréstimos - Query padronizada
      console.log('Dashboard: Buscando estatísticas de empréstimos');
      
      [emprestimosStats] = await connection.execute(`
        SELECT 
          COUNT(*) as total_emprestimos,
          COALESCE(SUM(e.valor), 0) as valor_total_inicial,
          COALESCE(SUM(
            CASE 
              WHEN e.tipo_emprestimo = 'in_installments' AND e.valor_parcela > 0 AND e.numero_parcelas > 0
                THEN (e.valor_parcela * e.numero_parcelas)
              WHEN e.valor > 0 AND e.juros_mensal > 0 
                THEN e.valor * (1 + (e.juros_mensal / 100))
              ELSE COALESCE(e.valor, 0)
            END
          ), 0) as valor_total_final,
          COUNT(CASE WHEN TRIM(UPPER(e.status)) IN ('ATIVO', 'PENDENTE') THEN 1 END) as emprestimos_ativos,
          COUNT(CASE WHEN TRIM(UPPER(e.status)) = 'QUITADO' THEN 1 END) as emprestimos_quitados
        FROM emprestimos e
        WHERE e.cliente_id IS NOT NULL AND e.valor > 0
      `);
      
      console.log('Dashboard: Estatísticas de empréstimos:', emprestimosStats[0]);
    } catch (error) {
      console.log('Dashboard: Erro ao buscar estatísticas de empréstimos:', error.message);
    }

    try {
      // Valor a receber: soma valor_atualizado (juros de mora só em empréstimo fixo; parcelado = face da parcela + multa).
      console.log('Dashboard: Buscando estatísticas de cobranças');
      try {
        const [abertoRows] = await connection.execute(`
          SELECT 
            COALESCE(SUM(cb.valor_atualizado), 0) as valor_aberto,
            COALESCE(SUM(CASE WHEN cb.dias_atraso > 0 THEN cb.valor_atualizado ELSE 0 END), 0) as valor_atrasado,
            COUNT(*) as cobrancas_pendentes_abertas
          FROM cobrancas cb
          INNER JOIN emprestimos e ON cb.emprestimo_id = e.id
          WHERE cb.cliente_id IS NOT NULL
            AND TRIM(UPPER(cb.status)) = 'PENDENTE'
            AND TRIM(UPPER(e.status)) NOT IN ('QUITADO', 'CANCELADO')
        `);

        const [legacyRows] = await connection.execute(`
          SELECT COALESCE(SUM(
            CASE 
              WHEN e.tipo_emprestimo = 'in_installments' AND e.valor_parcela > 0 AND e.numero_parcelas > 0
                THEN (e.valor_parcela * e.numero_parcelas)
              WHEN e.valor > 0 AND e.juros_mensal > 0 
                THEN e.valor * (1 + (e.juros_mensal / 100))
              ELSE COALESCE(e.valor, 0)
            END
          ), 0) as valor_legacy
          FROM emprestimos e
          WHERE e.cliente_id IS NOT NULL AND e.valor > 0
            AND TRIM(UPPER(e.status)) NOT IN ('QUITADO', 'CANCELADO')
            AND NOT EXISTS (SELECT 1 FROM cobrancas c WHERE c.emprestimo_id = e.id)
        `);

        const [countRows] = await connection.execute(`
          SELECT 
            COUNT(*) as total_cobrancas,
            COUNT(CASE WHEN TRIM(UPPER(status)) = 'PENDENTE' THEN 1 END) as cobrancas_pendentes,
            COUNT(CASE WHEN TRIM(UPPER(status)) = 'PAGA' THEN 1 END) as cobrancas_pagas
          FROM cobrancas
          WHERE cliente_id IS NOT NULL
        `);

        const vAberto = mysqlDecimalToNumber(abertoRows[0].valor_aberto);
        const vLeg = mysqlDecimalToNumber(legacyRows[0].valor_legacy);
        cobrancasStats = [{
          total_cobrancas: mysqlDecimalToNumber(countRows[0].total_cobrancas),
          valor_total_cobrancas: vAberto + vLeg,
          cobrancas_pendentes: mysqlDecimalToNumber(abertoRows[0].cobrancas_pendentes_abertas),
          cobrancas_pagas: mysqlDecimalToNumber(countRows[0].cobrancas_pagas),
          valor_atrasado: mysqlDecimalToNumber(abertoRows[0].valor_atrasado)
        }];

        console.log('Dashboard: Valor a receber (soma valor_atualizado cobranças pendentes):', abertoRows[0].valor_aberto);
        console.log('Dashboard: Legado sem cobranças:', legacyRows[0].valor_legacy);
        console.log('Dashboard: Total valor a receber:', cobrancasStats[0].valor_total_cobrancas);
      } catch (innerError) {
        console.log('Dashboard: Fallback estatísticas cobranças:', innerError.message);
        [cobrancasStats] = await connection.execute(`
          SELECT 
            COUNT(*) as total_cobrancas,
            COALESCE(SUM(CASE WHEN TRIM(UPPER(status)) = 'PENDENTE' THEN valor_atualizado ELSE 0 END), 0) as valor_total_cobrancas,
            COUNT(CASE WHEN TRIM(UPPER(status)) = 'PENDENTE' THEN 1 END) as cobrancas_pendentes,
            COUNT(CASE WHEN TRIM(UPPER(status)) = 'PAGA' THEN 1 END) as cobrancas_pagas,
            COALESCE(SUM(CASE WHEN dias_atraso > 0 AND TRIM(UPPER(status)) = 'PENDENTE' THEN valor_atualizado ELSE 0 END), 0) as valor_atrasado
          FROM cobrancas
          WHERE cliente_id IS NOT NULL
        `);
      }
      console.log('Dashboard: Estatísticas de cobranças obtidas:', cobrancasStats[0]);
    } catch (error) {
      console.log('Dashboard: Erro ao buscar estatísticas de cobranças:', error.message);
    }

    try {
      // Verificar se a tabela clientes_cobrancas existe
      console.log('Dashboard: Verificando tabela clientes_cobrancas');
      const [tables] = await connection.execute(`SHOW TABLES LIKE 'clientes_cobrancas'`);
      
      if (tables.length > 0) {
        // Estatísticas de clientes - Query corrigida
        console.log('Dashboard: Buscando estatísticas de clientes');
        [clientesStats] = await connection.execute(`
          SELECT COUNT(*) as total_clientes FROM clientes_cobrancas WHERE TRIM(UPPER(status)) IN ('ATIVO', 'PENDENTE')
        `);
        console.log('Dashboard: Estatísticas de clientes obtidas:', clientesStats[0]);
      } else {
        console.log('Dashboard: Tabela clientes_cobrancas não existe, usando valor padrão');
      }
    } catch (error) {
      console.log('Dashboard: Erro ao buscar estatísticas de clientes:', error.message);
    }

    try {
      // Empréstimos recentes - Query robusta
      console.log('Dashboard: Buscando empréstimos recentes');
      
      // Tentar primeiro com status ativos conhecidos
      [emprestimosRecentes] = await connection.execute(`
        SELECT e.*, c.nome as cliente_nome, c.telefone as telefone
        FROM emprestimos e
        LEFT JOIN clientes_cobrancas c ON e.cliente_id = c.id
        WHERE e.cliente_id IS NOT NULL AND e.cliente_id > 0
          AND TRIM(UPPER(e.status)) IN ('ATIVO', 'PENDENTE', 'EM ANDAMENTO', 'VIGENTE', 'ABERTO')
        ORDER BY e.created_at DESC
        LIMIT 5
      `);
      
      // Se não encontrou nenhum, pegar os mais recentes independente do status
      if (emprestimosRecentes.length === 0) {
        console.log('Dashboard: Nenhum empréstimo ativo encontrado, buscando todos os recentes');
        [emprestimosRecentes] = await connection.execute(`
          SELECT e.*, c.nome as cliente_nome, c.telefone as telefone
          FROM emprestimos e
          LEFT JOIN clientes_cobrancas c ON e.cliente_id = c.id
          WHERE e.cliente_id IS NOT NULL AND e.cliente_id > 0
          ORDER BY e.created_at DESC
          LIMIT 5
        `);
      }
      
      console.log('Dashboard: Empréstimos recentes obtidos:', emprestimosRecentes.length);
    } catch (error) {
      console.log('Dashboard: Erro ao buscar empréstimos recentes:', error.message);
    }

    try {
      // Cobranças pendentes - Query corrigida
      console.log('Dashboard: Buscando cobranças pendentes');
      [cobrancasPendentes] = await connection.execute(`
        SELECT cb.*, c.nome as cliente_nome, c.telefone as telefone,
          e.frequencia AS emprestimo_frequencia,
          (${SQL_PERIODOS_EM_ABERTO_LISTAGEM}) AS periodos_em_aberto
        FROM cobrancas cb
        LEFT JOIN clientes_cobrancas c ON cb.cliente_id = c.id
        LEFT JOIN emprestimos e ON cb.emprestimo_id = e.id
        WHERE TRIM(UPPER(cb.status)) = 'PENDENTE' AND cb.cliente_id IS NOT NULL
          AND TRIM(UPPER(e.status)) NOT IN ('QUITADO', 'CANCELADO')
        ORDER BY cb.data_vencimento ASC
        LIMIT 10
      `);
      console.log('Dashboard: Cobranças pendentes obtidas:', cobrancasPendentes.length);
    } catch (error) {
      console.log('Dashboard: Erro ao buscar cobranças pendentes:', error.message);
    }

    try {
      // Clientes em atraso - Baseado em parcelas
      console.log('Dashboard: Buscando clientes em atraso');
      
      // Primeiro tentar com parcelas (sistema parcelado)
      try {
      [clientesEmAtraso] = await connection.execute(`
        SELECT COUNT(DISTINCT c.id) as total
        FROM clientes_cobrancas c
        JOIN emprestimos e ON e.cliente_id = c.id
          JOIN parcelas p ON p.emprestimo_id = e.id
          WHERE TRIM(UPPER(p.status)) = 'PENDENTE'
            AND p.data_vencimento < CURDATE()
            AND TRIM(UPPER(e.status)) IN ('ATIVO', 'PENDENTE')
        `);
        console.log('Dashboard: Clientes em atraso (baseado em parcelas):', clientesEmAtraso[0]);
      } catch (parcelasError) {
        // Se não há tabela parcelas, usar cobranças em atraso
        console.log('Dashboard: Tabela parcelas não encontrada, usando cobranças');
        [clientesEmAtraso] = await connection.execute(`
          SELECT COUNT(DISTINCT c.id) as total
          FROM clientes_cobrancas c
          JOIN cobrancas cb ON cb.cliente_id = c.id
          WHERE TRIM(UPPER(cb.status)) = 'PENDENTE'
            AND cb.data_vencimento < CURDATE()
            AND cb.dias_atraso > 0
      `);
        console.log('Dashboard: Clientes em atraso (baseado em cobranças):', clientesEmAtraso[0]);
      }
    } catch (error) {
      console.log('Dashboard: Erro ao buscar clientes em atraso:', error.message);
    }

    try {
      // Card do dashboard: 1 linha por empréstimo — usa vencimento do contrato (evita inflar com parcelas/cobranças)
      console.log('Dashboard: Buscando empréstimos em atraso (vencimento do empréstimo)');
      [emprestimosEmAtraso] = await connection.execute(`
        SELECT COUNT(*) AS total
        FROM emprestimos e
        WHERE e.cliente_id IS NOT NULL AND e.valor > 0
          AND TRIM(UPPER(e.status)) IN ('ATIVO', 'PENDENTE', 'EM ANDAMENTO', 'VIGENTE', 'ABERTO')
          AND TRIM(UPPER(e.status)) NOT IN ('QUITADO', 'CANCELADO')
          AND e.data_vencimento IS NOT NULL
          AND e.data_vencimento < CURDATE()
      `);
      console.log('Dashboard: Empréstimos em atraso obtidos:', emprestimosEmAtraso[0]);
    } catch (error) {
      console.log('Dashboard: Erro ao buscar empréstimos em atraso:', error.message);
    }

    try {
      // Clientes ativos - Query corrigida
      console.log('Dashboard: Buscando clientes ativos');
      [clientesAtivos] = await connection.execute(`
        SELECT COUNT(DISTINCT c.id) as total
        FROM clientes_cobrancas c
        JOIN emprestimos e ON e.cliente_id = c.id
        WHERE TRIM(UPPER(e.status)) IN ('ATIVO', 'PENDENTE')
          AND TRIM(UPPER(e.status)) <> 'QUITADO'
      `);
      console.log('Dashboard: Clientes ativos obtidos:', clientesAtivos[0]);
    } catch (error) {
      console.log('Dashboard: Erro ao buscar clientes ativos:', error.message);
    }

    try {
      // Empréstimos ativos - Query corrigida
      console.log('Dashboard: Buscando empréstimos ativos');
      [emprestimosAtivos] = await connection.execute(`
        SELECT COUNT(*) as total
        FROM emprestimos
        WHERE TRIM(UPPER(status)) IN ('ATIVO', 'PENDENTE')
          AND TRIM(UPPER(status)) <> 'QUITADO'
      `);
      console.log('Dashboard: Empréstimos ativos obtidos:', emprestimosAtivos[0]);
    } catch (error) {
      console.log('Dashboard: Erro ao buscar empréstimos ativos:', error.message);
    }

    await connection.end();
    console.log('Dashboard: Conexão fechada');

    const cobRaw = cobrancasStats[0] || {};
    const response = {
      emprestimos: {
        ...emprestimosStats[0],
        // Para compatibilidade, mapear valor_total_inicial para valor_total_emprestimos
        valor_total_emprestimos: mysqlDecimalToNumber(emprestimosStats[0].valor_total_inicial)
      },
      cobrancas: {
        ...cobRaw,
        valor_total_cobrancas: mysqlDecimalToNumber(cobRaw.valor_total_cobrancas),
        valor_atrasado: mysqlDecimalToNumber(cobRaw.valor_atrasado)
      },
      clientes: clientesStats[0],
      emprestimosRecentes,
      cobrancasPendentes,
      clientesEmAtraso: clientesEmAtraso[0].total,
      emprestimosEmAtraso: emprestimosEmAtraso[0].total,
      clientesAtivos: clientesAtivos[0].total,
      emprestimosAtivos: emprestimosAtivos[0].total
    };
    
    console.log('Dashboard: Resposta preparada com dados:', {
      emprestimos: response.emprestimos,
      cobrancas: response.cobrancas,
      clientes: response.clientes,
      emprestimosRecentes: response.emprestimosRecentes?.length || 0,
      cobrancasPendentes: response.cobrancasPendentes?.length || 0
    });
    
    res.json(response);
  } catch (error) {
    console.error('Erro ao buscar dados do dashboard:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

// Clientes
router.get('/clientes', ensureDatabase, async (req, res) => {
  try {
    const username = req.session.cobrancasUser;
    const connection = await createCobrancasConnection(username);
    const [clientes] = await connection.execute(`
      SELECT * FROM clientes_cobrancas 
      ORDER BY nome ASC
    `);
    await connection.end();
    res.json(clientes);
  } catch (error) {
    console.error('Erro ao buscar clientes:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/clientes', ensureDatabase, async (req, res) => {
  try {
    const { nome, cpf_cnpj, email, telefone, endereco, cidade, estado, cep } = req.body;
    
    // Validação do nome do cliente
    if (!nome || typeof nome !== 'string' || ['undefined', 'n/a', 'na'].includes(nome.trim().toLowerCase()) || nome.trim() === '') {
      return res.status(400).json({ error: 'Nome do cliente inválido. Não é permitido cadastrar clientes sem nome ou com nome "undefined" ou "N/A".' });
    }
    
    // Tratar valores undefined para null
    const params = [
      nome,
      cpf_cnpj || null,
      email || null,
      telefone || null,
      endereco || null,
      cidade || null,
      estado || null,
      cep || null
    ];
    
    console.log('Dados do cliente para inserção:', { nome, cpf_cnpj, email, telefone, endereco, cidade, estado, cep });
    console.log('Parâmetros tratados:', params);
    
    const username = req.session.cobrancasUser;
    const connection = await createCobrancasConnection(username);
    
    const [result] = await connection.execute(`
      INSERT INTO clientes_cobrancas (nome, cpf_cnpj, email, telefone, endereco, cidade, estado, cep)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, params);
    
    await connection.end();
    res.json({ id: result.insertId, message: 'Cliente criado com sucesso' });
  } catch (error) {
    console.error('Erro ao criar cliente:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

// Buscar parcelas de um empréstimo (rota duplicada removida - mantendo apenas a mais completa abaixo)

// Atualizar status de uma parcela específica
router.put('/emprestimos/:emprestimo_id/parcelas/:numero_parcela/status', ensureDatabase, async (req, res) => {
  try {
    const { emprestimo_id, numero_parcela } = req.params;
    const { status, data_pagamento, valor_pago, observacoes } = req.body;
    
    const username = req.session.cobrancasUser;
    const connection = await createCobrancasConnection(username);
    
    // Buscar a parcela
    const [parcelas] = await connection.execute(`
      SELECT p.*, c.id as cobranca_id
      FROM parcelas p
      LEFT JOIN cobrancas c ON c.emprestimo_id = p.emprestimo_id AND c.data_vencimento = p.data_vencimento
      WHERE p.emprestimo_id = ? AND p.numero_parcela = ?
    `, [emprestimo_id, numero_parcela]);
    
    if (parcelas.length === 0) {
      await connection.end();
      return res.status(404).json({ error: 'Parcela não encontrada' });
    }
    
    const parcela = parcelas[0];
    
    // Atualizar status da parcela
    await connection.execute(`
      UPDATE parcelas 
      SET status = ?, data_pagamento = ?, valor_pago = ?, updated_at = CURRENT_TIMESTAMP
      WHERE emprestimo_id = ? AND numero_parcela = ?
    `, [status, data_pagamento || null, valor_pago || parcela.valor_parcela, emprestimo_id, numero_parcela]);
    
    // Atualizar cobrança relacionada se existir
    if (parcela.cobranca_id) {
      await connection.execute(`
        UPDATE cobrancas 
        SET status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [status === 'Paga' ? 'Paga' : 'Pendente', parcela.cobranca_id]);
      
      // Se foi marcada como paga, registrar o pagamento
      if (status === 'Paga' && data_pagamento) {
        await connection.execute(`
          INSERT INTO pagamentos (cobranca_id, valor_pago, data_pagamento, forma_pagamento, observacoes)
          VALUES (?, ?, ?, ?, ?)
        `, [parcela.cobranca_id, valor_pago || parcela.valor_parcela, data_pagamento, 'Manual', observacoes || `Pagamento da parcela ${numero_parcela}`]);
      }
    }
    
    // Verificar se todas as parcelas estão pagas para atualizar o empréstimo
    const [todasParcelas] = await connection.execute(`
      SELECT COUNT(*) as total, SUM(CASE WHEN status = 'Paga' THEN 1 ELSE 0 END) as pagas
      FROM parcelas
      WHERE emprestimo_id = ?
    `, [emprestimo_id]);
    
    if (todasParcelas[0].total === todasParcelas[0].pagas) {
      // Todas as parcelas estão pagas, marcar empréstimo como quitado
      await connection.execute(`
        UPDATE emprestimos 
        SET status = 'Quitado', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [emprestimo_id]);
    } else {
      // Garantir que o empréstimo não esteja marcado como quitado se nem todas as parcelas estão pagas
      await connection.execute(`
        UPDATE emprestimos 
        SET status = 'Ativo', updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'Quitado'
      `, [emprestimo_id]);
    }
    
    await connection.end();
    res.json({ message: 'Status da parcela atualizado com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar status da parcela:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Atualizar data de vencimento de uma parcela específica
router.put('/emprestimos/:emprestimo_id/parcelas/:numero_parcela/data', ensureDatabase, async (req, res) => {
  try {
    const { emprestimo_id, numero_parcela } = req.params;
    const { data_vencimento } = req.body;
    
    if (!data_vencimento) {
      return res.status(400).json({ error: 'Data de vencimento é obrigatória' });
    }
    
    const username = req.session.cobrancasUser;
    const connection = await createCobrancasConnection(username);
    
    // Buscar a parcela
    const [parcelas] = await connection.execute(`
      SELECT p.*, c.id as cobranca_id
      FROM parcelas p
      LEFT JOIN cobrancas c ON c.emprestimo_id = p.emprestimo_id AND c.data_vencimento = p.data_vencimento
      WHERE p.emprestimo_id = ? AND p.numero_parcela = ?
    `, [emprestimo_id, numero_parcela]);
    
    if (parcelas.length === 0) {
      await connection.end();
      return res.status(404).json({ error: 'Parcela não encontrada' });
    }
    
    const parcela = parcelas[0];
    
    // Só permitir alterar data de parcelas não pagas
    if (parcela.status === 'Paga') {
      await connection.end();
      return res.status(400).json({ error: 'Não é possível alterar a data de uma parcela já paga' });
    }
    
    // Atualizar data de vencimento da parcela
    await connection.execute(`
      UPDATE parcelas 
      SET data_vencimento = ?, updated_at = CURRENT_TIMESTAMP
      WHERE emprestimo_id = ? AND numero_parcela = ?
    `, [data_vencimento, emprestimo_id, numero_parcela]);
    
    // Atualizar cobrança relacionada se existir
    if (parcela.cobranca_id) {
      await connection.execute(`
        UPDATE cobrancas 
        SET data_vencimento = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [data_vencimento, parcela.cobranca_id]);
    }
    
    await connection.end();
    res.json({ message: 'Data de vencimento da parcela atualizada com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar data da parcela:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Atualizar valor de uma parcela específica
router.put('/emprestimos/:emprestimo_id/parcelas/:numero_parcela/valor', ensureDatabase, async (req, res) => {
  try {
    const { emprestimo_id, numero_parcela } = req.params;
    const { valor_parcela } = req.body;
    
    const valorNum = parseFloat(valor_parcela);
    if (isNaN(valorNum) || valorNum <= 0) {
      return res.status(400).json({ error: 'Valor da parcela deve ser um número positivo' });
    }
    
    const username = req.session.cobrancasUser;
    const connection = await createCobrancasConnection(username);
    
    const [parcelas] = await connection.execute(`
      SELECT p.*, c.id as cobranca_id
      FROM parcelas p
      LEFT JOIN cobrancas c ON c.emprestimo_id = p.emprestimo_id AND c.data_vencimento = p.data_vencimento
      WHERE p.emprestimo_id = ? AND p.numero_parcela = ?
    `, [emprestimo_id, numero_parcela]);
    
    if (parcelas.length === 0) {
      await connection.end();
      return res.status(404).json({ error: 'Parcela não encontrada' });
    }
    
    const parcela = parcelas[0];
    
    if (parcela.status === 'Paga') {
      await connection.end();
      return res.status(400).json({ error: 'Não é possível alterar o valor de uma parcela já paga' });
    }
    
    await connection.execute(`
      UPDATE parcelas 
      SET valor_parcela = ?, updated_at = CURRENT_TIMESTAMP
      WHERE emprestimo_id = ? AND numero_parcela = ?
    `, [valorNum, emprestimo_id, numero_parcela]);
    
    if (parcela.cobranca_id) {
      await connection.execute(`
        UPDATE cobrancas 
        SET valor_original = ?, valor_atualizado = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [valorNum, valorNum, parcela.cobranca_id]);
    }
    
    await connection.end();
    res.json({ message: 'Valor da parcela atualizado com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar valor da parcela:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Atualizar empréstimo
router.put('/emprestimos/:id', ensureDatabase, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      cliente_id, 
      valor, 
      juros_mensal, 
      data_vencimento, 
      frequencia_pagamento, 
      numero_parcelas, 
      status: statusReq, 
      observacoes 
    } = req.body;
    
    console.log('=== ATUALIZAR EMPRÉSTIMO ===');
    console.log('ID:', id);
    console.log('Dados recebidos:', req.body);
    console.log('🔍 DEBUG - Data de vencimento recebida:', data_vencimento);
    console.log('🔍 DEBUG - Status recebido:', statusReq);
    
    // LOG EXTRA: Mostrar valor antes do update
    console.log('🟡 LOG EXTRA: Valor de data_vencimento ANTES do update:', data_vencimento);
    
    // Validação dos dados obrigatórios
    if (!cliente_id || !valor || !data_vencimento || !numero_parcelas) {
      console.log('Erro: Dados obrigatórios não informados');
      return res.status(400).json({ error: 'Dados obrigatórios não informados' });
    }
    
    const username = req.session.cobrancasUser;
    console.log('Usuário da sessão:', username);
    const connection = await createCobrancasConnection(username);
    
    // Verificar se o empréstimo existe
    const [emprestimos] = await connection.execute(
      'SELECT * FROM emprestimos WHERE id = ?',
      [id]
    );
    
    if (emprestimos.length === 0) {
      await connection.end();
      return res.status(404).json({ error: 'Empréstimo não encontrado' });
    }
    
    const emprestimoAtual = emprestimos[0];
    
    // Calcular valor final baseado no tipo de empréstimo
    let valorFinal = valor;
    const jurosMensalNum = parseFloat(juros_mensal) || 0;
    const numeroParcelasNum = parseInt(numero_parcelas) || 1;
    
    if (jurosMensalNum > 0) {
      valorFinal = valor * (1 + jurosMensalNum / 100);
    }
    
    const valorParcela = valorFinal / numeroParcelasNum;
    const tipoEmprestimo = numeroParcelasNum > 1 ? 'in_installments' : 'fixed';
    
    // Mapear frequencia_pagamento para frequencia (campo da tabela)
    const frequenciaMap = {
      'monthly': 'monthly',
      'weekly': 'weekly',
      'daily': 'daily',
      'biweekly': 'biweekly'
    };
    
    const frequencia = frequenciaMap[frequencia_pagamento] || 'monthly';
    
    // Verificar estrutura da tabela
    const [columns] = await connection.execute(
      'DESCRIBE emprestimos'
    );
    
    console.log('Estrutura da tabela emprestimos:');
    columns.forEach(col => {
      console.log(`  ${col.Field}: ${col.Type} (${col.Null === 'YES' ? 'NULL' : 'NOT NULL'})`);
    });
    
    const hasValorFinal = columns.some(col => col.Field === 'valor_final');
    const hasValorParcela = columns.some(col => col.Field === 'valor_parcela');
    const hasTipoEmprestimo = columns.some(col => col.Field === 'tipo_emprestimo');
    const hasFrequencia = columns.some(col => col.Field === 'frequencia');
    
    console.log('Campos disponíveis:', {
      hasValorFinal,
      hasValorParcela,
      hasTipoEmprestimo,
      hasFrequencia
    });
    
    // Construir query dinamicamente baseado nos campos disponíveis
    let updateFields = [
      'cliente_id = ?',
      'valor = ?',
      'juros_mensal = ?',
      'data_vencimento = ?',
      'numero_parcelas = ?',
      'status = ?',
      'observacoes = ?',
      'updated_at = CURRENT_TIMESTAMP'
    ];
    
    let updateValues = [
      cliente_id,
      valor,
      jurosMensalNum,
      data_vencimento,
      numeroParcelasNum,
      statusReq,
      observacoes
    ];
    
    // Adicionar campos opcionais se existirem
    if (hasFrequencia) {
      updateFields.push('frequencia = ?');
      updateValues.push(frequencia);
    }
    
    if (hasValorParcela) {
      updateFields.push('valor_parcela = ?');
      updateValues.push(valorParcela);
    }
    
    if (hasTipoEmprestimo) {
      updateFields.push('tipo_emprestimo = ?');
      updateValues.push(tipoEmprestimo);
    }
    
    if (hasValorFinal) {
      updateFields.push('valor_final = ?');
      updateValues.push(valorFinal);
    }
    
    // Adicionar ID no final
    updateValues.push(id);
    
    const updateQuery = `
      UPDATE emprestimos 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `;
    
    console.log('Query de atualização:', updateQuery);
    console.log('Valores:', updateValues);
    
    await connection.execute(updateQuery, updateValues);
    
    // LOG EXTRA: Buscar valor salvo no banco após update
    const [emprestimoAposUpdate] = await connection.execute('SELECT data_vencimento FROM emprestimos WHERE id = ?', [id]);
    if (emprestimoAposUpdate.length > 0) {
      console.log('🟢 LOG EXTRA: Valor de data_vencimento APÓS update:', emprestimoAposUpdate[0].data_vencimento);
    }
    
          // Se o número de parcelas mudou, atualizar as parcelas
      if (numeroParcelasNum !== emprestimoAtual.numero_parcelas) {
        // Remover parcelas antigas
        await connection.execute('DELETE FROM parcelas WHERE emprestimo_id = ?', [id]);
        
        // Criar novas parcelas se for parcelado
        if (numeroParcelasNum > 1) {
          let dataVencimentoStr = data_vencimento; // Usar string recebida
          let [ano, mes, dia] = dataVencimentoStr.split('-').map(Number);
          for (let i = 1; i <= numeroParcelasNum; i++) {
            let dataParcela = new Date(ano, mes - 1, dia);
            // Calcular data de vencimento baseada na frequência
            switch (frequencia) {
              case 'weekly':
                dataParcela.setDate(dataParcela.getDate() + (i - 1) * 7);
                break;
              case 'biweekly':
                dataParcela.setDate(dataParcela.getDate() + (i - 1) * 14);
                break;
              case 'daily':
                dataParcela.setDate(dataParcela.getDate() + (i - 1));
                break;
              case 'monthly':
              default:
                dataParcela.setMonth(dataParcela.getMonth() + (i - 1));
                break;
            }
            // Formatar para YYYY-MM-DD sem fuso
            const dataParcelaStr = `${dataParcela.getFullYear()}-${String(dataParcela.getMonth() + 1).padStart(2, '0')}-${String(dataParcela.getDate()).padStart(2, '0')}`;
            await connection.execute(`
              INSERT INTO parcelas (emprestimo_id, numero_parcela, valor_parcela, data_vencimento, status)
              VALUES (?, ?, ?, ?, ?)
            `, [id, i, valorParcela, dataParcelaStr, 'Pendente']);
          }
        }
      }
    
    // Atualizar cobranças relacionadas
    try {
      await connection.execute(`
        UPDATE cobrancas 
        SET valor_original = ?, 
            valor_atualizado = ?, 
            data_vencimento = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE emprestimo_id = ?
      `, [valor, valorFinal, data_vencimento, id]);
    } catch (cobrancaError) {
      console.warn('Erro ao atualizar cobranças relacionadas:', cobrancaError);
      // Não interromper o processo se a atualização das cobranças falhar
    }
    
    let statusResposta = statusReq;
    // ✅ CORREÇÃO: Recalcular status automaticamente quando data é alterada
    try {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const dataVencimento = new Date(data_vencimento);
      dataVencimento.setHours(0, 0, 0, 0);
      
      console.log('📅 DEBUG - Recálculo de status:');
      console.log('   Data hoje:', hoje.toISOString().split('T')[0]);
      console.log('   Data vencimento:', dataVencimento.toISOString().split('T')[0]);
      console.log('   Status atual:', statusReq);
      console.log('   É empréstimo parcelado?', numeroParcelasNum > 1);
      
      let novoStatus = statusReq;
      
      // Só recalcular se o status não foi explicitamente definido como 'Quitado'
      if (statusReq !== 'Quitado') {
        // Verificar se é empréstimo parcelado
        if (numeroParcelasNum > 1) {
          // Para empréstimos parcelados, verificar status das parcelas
          const [parcelas] = await connection.execute(`
            SELECT COUNT(*) as total,
                   SUM(CASE WHEN status = 'Paga' THEN 1 ELSE 0 END) as pagas,
                   SUM(CASE WHEN data_vencimento < CURDATE() AND status != 'Paga' THEN 1 ELSE 0 END) as atrasadas
            FROM parcelas
            WHERE emprestimo_id = ?
          `, [id]);
          
          if (parcelas[0].total > 0) {
            if (parcelas[0].pagas === parcelas[0].total) {
              novoStatus = 'Quitado';
            } else if (parcelas[0].atrasadas > 0) {
              novoStatus = 'Em Atraso';
            } else {
              novoStatus = 'Ativo';
            }
          }
        } else {
          // Para empréstimos de parcela única, usar data de vencimento
          console.log('   📄 Empréstimo de parcela única - comparando datas');
          const hojeStr = new Date().toISOString().slice(0, 10);
          if (data_vencimento < hojeStr) {
            novoStatus = 'Em Atraso';
            console.log('   ⏰ Data vencida - Status: Em Atraso');
          } else {
            novoStatus = 'Ativo';
            console.log('   ✅ Data no futuro - Status: Ativo');
          }
        }
        
        // Atualizar status se foi recalculado
        console.log('🔄 Comparando status:', { statusAnterior: statusReq, novoStatus });
        if (novoStatus !== statusReq) {
          console.log('📝 Atualizando status no banco de dados...');
          await connection.execute(`
            UPDATE emprestimos 
            SET status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [novoStatus, id]);
          
          console.log(`🔄 ATUALIZAÇÃO DE STATUS:`);
          console.log(`   Empréstimo ID: ${id}`);
          console.log(`   Status anterior: ${statusReq}`);
          console.log(`   Status novo: ${novoStatus}`);
          console.log(`   ✅ Status recalculado com sucesso!`);
          statusResposta = novoStatus;
        } else {
          console.log(`✅ Status já está correto (${statusReq}) - nenhuma atualização necessária`);
        }
      }
    } catch (statusError) {
      console.warn('Erro ao recalcular status:', statusError);
      // Não interromper o processo se o recálculo falhar
    }
    
    await connection.end();
    res.json({ 
      message: 'Empréstimo atualizado com sucesso',
      emprestimo: {
        id,
        cliente_id,
        valor,
        valor_final: valorFinal,
        valor_parcela: valorParcela,
        juros_mensal: jurosMensalNum,
        data_vencimento,
        frequencia,
        numero_parcelas: numeroParcelasNum,
        status: statusResposta,
        observacoes,
        tipo_emprestimo: tipoEmprestimo
      }
    });
    
  } catch (error) {
    console.error('Erro detalhado ao atualizar empréstimo:', error);
    console.error('Stack trace:', error.stack);
    console.error('Dados recebidos:', req.body);
    
    // Verificar se é um erro de conexão
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return res.status(503).json({ error: 'Erro de conexão com o banco de dados' });
    }
    
    // Verificar se é um erro de SQL
    if (error.code && error.code.startsWith('ER_')) {
      return res.status(400).json({ error: 'Erro de validação dos dados: ' + error.message });
    }
    
    res.status(500).json({ error: 'Erro interno do servidor: ' + error.message });
  }
});

// Empréstimos - Query padronizada
router.get('/emprestimos', ensureDatabase, async (req, res) => {
  try {
    const username = req.session.cobrancasUser;
    const connection = await createCobrancasConnection(username);
    
    // Atualizar status das parcelas atrasadas
    await connection.execute(`
      UPDATE parcelas 
      SET status = 'Atrasada' 
      WHERE status = 'Pendente' 
        AND data_vencimento < CURDATE()
    `);
    
    // Query padronizada com cálculos consistentes
    const [emprestimos] = await connection.execute(`
      SELECT DISTINCT e.*, 
             c.nome as cliente_nome, 
             c.telefone as telefone,
             COALESCE(e.valor, 0) as valor,
             COALESCE(e.juros_mensal, 0) as juros_mensal,
             COALESCE(e.numero_parcelas, 1) as numero_parcelas,
             COALESCE(e.valor_parcela, 0) as valor_parcela,
             CASE 
               WHEN e.tipo_emprestimo = 'in_installments' AND e.valor_parcela > 0 AND e.numero_parcelas > 0 
                 THEN (e.valor_parcela * e.numero_parcelas)
               WHEN e.valor > 0 AND e.juros_mensal > 0 
                 THEN e.valor * (1 + (e.juros_mensal / 100))
               ELSE COALESCE(e.valor, 0)
             END as valor_final,
             DATE_FORMAT(e.data_emprestimo, '%Y-%m-%d') as data_emprestimo_formatada,
             DATE_FORMAT(e.data_vencimento, '%Y-%m-%d') as data_vencimento_formatada
      FROM emprestimos e
      LEFT JOIN clientes_cobrancas c ON e.cliente_id = c.id
      ORDER BY e.created_at DESC
    `);
    
    // Processar cada empréstimo para garantir consistência
    const emprestimosProcessados = [];
    
    for (const emp of emprestimos) {
      // Aplicar cálculos padronizados
      const valores = calcularValoresEmprestimo(emp);
      
      // Determinar status padronizado
      const status = await determinarStatusEmprestimo(emp, connection);
      
      // Garantir que as datas estão no formato correto
      if (emp.data_emprestimo_formatada) {
        emp.data_emprestimo = emp.data_emprestimo_formatada;
      }
      if (emp.data_vencimento_formatada) {
        emp.data_vencimento = emp.data_vencimento_formatada;
      }
      
      // Aplicar valores padronizados
      emp.valor_final = valores.valor_final;
      emp.valor_inicial = valores.valor_inicial;
      emp.status = status;
      
      emprestimosProcessados.push(emp);
    }
    
    await connection.end();
    res.json(emprestimosProcessados);
  } catch (error) {
    console.error('Erro ao buscar empréstimos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Buscar empréstimo por ID (mesmo processamento da lista: status, valor_final, datas)
router.get('/emprestimos/:id', ensureDatabase, async (req, res) => {
  try {
    const { id } = req.params;
    const username = req.session.cobrancasUser;
    const connection = await createCobrancasConnection(username);

    await connection.execute(`
      UPDATE parcelas 
      SET status = 'Atrasada' 
      WHERE status = 'Pendente' 
        AND data_vencimento < CURDATE()
    `);

    const [emprestimos] = await connection.execute(`
      SELECT DISTINCT e.*, 
             c.nome as cliente_nome, 
             c.telefone as telefone,
             COALESCE(e.valor, 0) as valor,
             COALESCE(e.juros_mensal, 0) as juros_mensal,
             COALESCE(e.numero_parcelas, 1) as numero_parcelas,
             COALESCE(e.valor_parcela, 0) as valor_parcela,
             CASE 
               WHEN e.tipo_emprestimo = 'in_installments' AND e.valor_parcela > 0 AND e.numero_parcelas > 0 
                 THEN (e.valor_parcela * e.numero_parcelas)
               WHEN e.valor > 0 AND e.juros_mensal > 0 
                 THEN e.valor * (1 + (e.juros_mensal / 100))
               ELSE COALESCE(e.valor, 0)
             END as valor_final,
             DATE_FORMAT(e.data_emprestimo, '%Y-%m-%d') as data_emprestimo_formatada,
             DATE_FORMAT(e.data_vencimento, '%Y-%m-%d') as data_vencimento_formatada
      FROM emprestimos e
      LEFT JOIN clientes_cobrancas c ON e.cliente_id = c.id
      WHERE e.id = ?
    `, [id]);

    if (emprestimos.length === 0) {
      await connection.end();
      return res.status(404).json({ error: 'Empréstimo não encontrado' });
    }

    const emp = emprestimos[0];
    const valores = calcularValoresEmprestimo(emp);
    const status = await determinarStatusEmprestimo(emp, connection);
    if (emp.data_emprestimo_formatada) {
      emp.data_emprestimo = emp.data_emprestimo_formatada;
    }
    if (emp.data_vencimento_formatada) {
      emp.data_vencimento = emp.data_vencimento_formatada;
    }
    emp.valor_final = valores.valor_final;
    emp.valor_inicial = valores.valor_inicial;
    emp.status = status;

    await connection.end();
    res.json(emp);
  } catch (error) {
    console.error('Erro ao buscar empréstimo:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Informações do usuário autenticado
router.get('/usuario-info', async (req, res) => {
  try {
    const username = req.session.cobrancasUser;
    
    if (!username) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    res.json({
      username: username,
      authenticated: true
    });
  } catch (error) {
    console.error('Erro ao buscar informações do usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Estatísticas do histórico de empréstimos
router.get('/historico-emprestimos/estatisticas', ensureDatabase, async (req, res) => {
  try {
    const username = req.session.cobrancasUser;
    const connection = await createCobrancasConnection(username);
    
    // Atualizar status das parcelas atrasadas
    const [updateResult] = await connection.execute(`
      UPDATE parcelas 
      SET status = 'Atrasada' 
      WHERE status = 'Pendente' 
        AND data_vencimento < CURDATE()
    `);
    
    // Buscar estatísticas gerais
    const [stats] = await connection.execute(`
      SELECT 
        COUNT(e.id) as total_emprestimos,
        COALESCE(SUM(e.valor), 0) as valor_total_inicial,
        COALESCE(SUM(CASE 
          WHEN e.tipo_emprestimo = 'in_installments' THEN (e.valor_parcela * e.numero_parcelas)
          ELSE e.valor * (1 + (e.juros_mensal / 100))
        END), 0) as valor_total_final
      FROM emprestimos e
    `);
    
    // Contar empréstimos por status baseado nas parcelas
    const [statusStats] = await connection.execute(`
      SELECT 
        -- Empréstimos ativos: têm parcelas pendentes mas não atrasadas, OU são valor fixo e não vencidos
        COUNT(DISTINCT CASE 
          WHEN (EXISTS (SELECT 1 FROM parcelas p WHERE p.emprestimo_id = e.id AND p.status = 'Pendente')
                AND NOT EXISTS (SELECT 1 FROM parcelas p WHERE p.emprestimo_id = e.id AND p.status = 'Atrasada'))
            OR (NOT EXISTS (SELECT 1 FROM parcelas p WHERE p.emprestimo_id = e.id) 
                AND e.data_vencimento >= CURDATE() 
                AND e.status = 'Ativo')
          THEN e.id 
        END) as emprestimos_ativos,
        
        -- Empréstimos quitados: todas as parcelas pagas OU valor fixo já pago
        COUNT(DISTINCT CASE 
          WHEN (NOT EXISTS (SELECT 1 FROM parcelas p WHERE p.emprestimo_id = e.id AND p.status IN ('Pendente', 'Atrasada'))
                AND EXISTS (SELECT 1 FROM parcelas p WHERE p.emprestimo_id = e.id AND p.status = 'Paga'))
            OR (NOT EXISTS (SELECT 1 FROM parcelas p WHERE p.emprestimo_id = e.id) 
                AND e.status = 'Quitado')
          THEN e.id 
        END) as emprestimos_quitados,
        
        -- Empréstimos em atraso: têm parcelas atrasadas OU valor fixo vencido (sem pagamento)
        COUNT(DISTINCT CASE 
          WHEN EXISTS (SELECT 1 FROM parcelas p WHERE p.emprestimo_id = e.id AND p.status = 'Atrasada')
            OR (NOT EXISTS (SELECT 1 FROM parcelas p WHERE p.emprestimo_id = e.id) 
                AND e.data_vencimento < CURDATE() 
                AND e.status = 'Ativo'
                AND NOT EXISTS (SELECT 1 FROM pagamentos pg 
                               JOIN cobrancas c ON pg.cobranca_id = c.id 
                               WHERE c.emprestimo_id = e.id AND pg.valor_pago >= e.valor))
          THEN e.id 
        END) as emprestimos_atraso,
        
        -- Empréstimos sem parcelas (valor fixo)
        COUNT(CASE 
          WHEN NOT EXISTS (SELECT 1 FROM parcelas p WHERE p.emprestimo_id = e.id)
          THEN e.id 
        END) as emprestimos_valor_fixo
      FROM emprestimos e
    `);
    
    await connection.end();
    
    res.json({
      geral: stats[0],
      status: statusStats[0]
    });
  } catch (error) {
    console.error('Erro ao buscar estatísticas do histórico:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Endpoint para corrigir status inconsistentes de empréstimos
router.post('/corrigir-status-emprestimos', ensureDatabase, async (req, res) => {
  try {
    const username = req.session.cobrancasUser;
    const connection = await createCobrancasConnection(username);
    
    console.log('Iniciando correção de status de empréstimos...');
    
    // 1. Atualizar parcelas atrasadas
    const [parcelasUpdate] = await connection.execute(`
      UPDATE parcelas 
      SET status = 'Atrasada' 
      WHERE status = 'Pendente' 
        AND data_vencimento < CURDATE()
    `);
    
    console.log(`Parcelas atualizadas para atrasadas: ${parcelasUpdate.affectedRows}`);
    
    // 2. Marcar empréstimos como quitados se todas as parcelas estão pagas
    const [quitadosUpdate] = await connection.execute(`
      UPDATE emprestimos e
      SET status = 'Quitado'
      WHERE e.status = 'Ativo'
        AND EXISTS (SELECT 1 FROM parcelas p WHERE p.emprestimo_id = e.id)
        AND NOT EXISTS (SELECT 1 FROM parcelas p WHERE p.emprestimo_id = e.id AND p.status IN ('Pendente', 'Atrasada'))
    `);
    
    console.log(`Empréstimos marcados como quitados: ${quitadosUpdate.affectedRows}`);
    
    // 3. Empréstimos de valor fixo vencidos devem ser marcados como 'Em Atraso' apenas se realmente não foram pagos
    const [emprestimosValorFixoVencidos] = await connection.execute(`
      SELECT 
        e.id,
        e.cliente_id,
        c.nome as cliente_nome,
        e.data_vencimento,
        e.status,
        e.tipo_emprestimo,
        e.valor,
        COALESCE(SUM(pg.valor_pago), 0) as valor_total_pago
      FROM emprestimos e
      LEFT JOIN clientes_cobrancas c ON e.cliente_id = c.id
      LEFT JOIN cobrancas cb ON cb.emprestimo_id = e.id
      LEFT JOIN pagamentos pg ON pg.cobranca_id = cb.id
      WHERE NOT EXISTS (SELECT 1 FROM parcelas p WHERE p.emprestimo_id = e.id)
        AND e.data_vencimento < CURDATE()
        AND e.status = 'Ativo'
      GROUP BY e.id
      HAVING COALESCE(SUM(pg.valor_pago), 0) < e.valor
    `);
    
    console.log(`Empréstimos de valor fixo vencidos e não pagos encontrados: ${emprestimosValorFixoVencidos.length}`);
    
    await connection.end();
    
    res.json({
      success: true,
      correcoes: {
        parcelas_atrasadas: parcelasUpdate.affectedRows,
        emprestimos_quitados: quitadosUpdate.affectedRows,
        valor_fixo_vencidos: emprestimosValorFixoVencidos.length
      },
      emprestimos_valor_fixo_vencidos: emprestimosValorFixoVencidos
    });
  } catch (error) {
    console.error('Erro ao corrigir status de empréstimos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Histórico de pagamentos - parcelas pagas + juros pagos (mesma base do dashboard/emprestimos)
router.get('/historico-pagamentos', ensureDatabase, async (req, res) => {
  try {
    const username = req.session.cobrancasUser;
    const connection = await createCobrancasConnection(username);
    const { data_inicio, data_fim, cliente_id, tipo } = req.query;

    // 1. Pagamentos de PARCELAS ou EMPRÉSTIMO (quando marca como pago no dashboard/emprestimos)
    const [parcelasPagas] = await connection.execute(`
      SELECT 
        p.id as parcela_id,
        p.emprestimo_id,
        p.numero_parcela,
        p.valor_parcela as valor,
        p.data_pagamento,
        p.valor_pago,
        p.juros_aplicados,
        p.multa_aplicada,
        e.cliente_id,
        e.tipo_emprestimo,
        e.numero_parcelas,
        cl.nome as cliente_nome,
        e.valor as valor_inicial_emprestimo
      FROM parcelas p
      INNER JOIN emprestimos e ON p.emprestimo_id = e.id
      LEFT JOIN clientes_cobrancas cl ON e.cliente_id = cl.id
      WHERE p.status = 'Paga' AND p.data_pagamento IS NOT NULL
      ORDER BY p.data_pagamento DESC, p.emprestimo_id, p.numero_parcela
    `);

    // 2. Pagamentos de JUROS (tabela pagamentos - quando paga juros separadamente)
    const [pagamentosJuros] = await connection.execute(`
      SELECT 
        pg.id as pagamento_id,
        pg.cobranca_id,
        pg.valor_pago as valor,
        pg.data_pagamento,
        pg.forma_pagamento,
        pg.observacoes,
        c.emprestimo_id,
        c.cliente_id,
        cl.nome as cliente_nome,
        e.valor as valor_inicial_emprestimo,
        'Juros' as tipo_pagamento
      FROM pagamentos pg
      INNER JOIN cobrancas c ON pg.cobranca_id = c.id
      LEFT JOIN emprestimos e ON c.emprestimo_id = e.id
      LEFT JOIN clientes_cobrancas cl ON c.cliente_id = cl.id
      WHERE (pg.observacoes LIKE '%juros%' OR pg.observacoes LIKE '%Juros%')
      ORDER BY pg.data_pagamento DESC
    `);

    // Unificar e formatar
    const historico = [];
    parcelasPagas.forEach(p => {
      // Empréstimo valor fixo/juros (não parcelado) = mostrar "Empréstimo", não "Parcela 1"
      const ehParcelado = (p.tipo_emprestimo === 'in_installments' || p.tipo_emprestimo === 'parcelado') && (p.numero_parcelas || 0) > 1;
      const tipoPagamento = ehParcelado ? 'Parcela' : 'Empréstimo';
      const observacoes = ehParcelado ? `Parcela ${p.numero_parcela}` : 'Empréstimo';
      historico.push({
        id: `parcela_${p.parcela_id}`,
        origem: 'parcela',
        emprestimo_id: p.emprestimo_id,
        cliente_id: p.cliente_id,
        cliente_nome: p.cliente_nome || 'N/A',
        tipo_pagamento: tipoPagamento,
        numero_parcela: ehParcelado ? p.numero_parcela : null,
        valor: Number(p.valor || p.valor_pago || 0),
        data_pagamento: p.data_pagamento ? (p.data_pagamento.toISOString ? p.data_pagamento.toISOString().split('T')[0] : String(p.data_pagamento).split('T')[0]) : null,
        juros_aplicados: Number(p.juros_aplicados || 0),
        multa_aplicada: Number(p.multa_aplicada || 0),
        observacoes: observacoes
      });
    });
    pagamentosJuros.forEach(p => {
      historico.push({
        id: `pagamento_${p.pagamento_id}`,
        origem: 'pagamento',
        emprestimo_id: p.emprestimo_id,
        cliente_id: p.cliente_id,
        cliente_nome: p.cliente_nome || 'N/A',
        tipo_pagamento: 'Juros',
        valor: Number(p.valor || 0),
        data_pagamento: p.data_pagamento ? (p.data_pagamento.toISOString ? p.data_pagamento.toISOString().split('T')[0] : String(p.data_pagamento).split('T')[0]) : null,
        forma_pagamento: p.forma_pagamento,
        observacoes: p.observacoes || 'Pagamento de juros'
      });
    });

    // Ordenar por data (mais recente primeiro)
    historico.sort((a, b) => {
      const da = a.data_pagamento ? new Date(a.data_pagamento) : new Date(0);
      const db = b.data_pagamento ? new Date(b.data_pagamento) : new Date(0);
      return db - da;
    });

    // Aplicar filtros
    let resultado = historico;
    if (data_inicio) {
      resultado = resultado.filter(h => h.data_pagamento && h.data_pagamento >= data_inicio);
    }
    if (data_fim) {
      resultado = resultado.filter(h => h.data_pagamento && h.data_pagamento <= data_fim);
    }
    if (cliente_id) {
      resultado = resultado.filter(h => String(h.cliente_id) === String(cliente_id));
    }
    if (tipo) {
      resultado = resultado.filter(h => h.tipo_pagamento.toLowerCase() === tipo.toLowerCase());
    }

    await connection.end();
    res.json(resultado);
  } catch (error) {
    console.error('Erro ao buscar histórico de pagamentos:', error);
    res.status(500).json({ error: 'Erro ao buscar histórico de pagamentos' });
  }
});

// Parcelas de um empréstimo
router.get('/emprestimos/:id/parcelas', ensureDatabase, async (req, res) => {
  try {
    const { id } = req.params;
    const username = req.session.cobrancasUser;
    const connection = await createCobrancasConnection(username);
    
    // Primeiro, atualizar status das parcelas atrasadas
    await connection.execute(`
      UPDATE parcelas 
      SET status = 'Atrasada' 
      WHERE emprestimo_id = ? 
        AND status = 'Pendente' 
        AND data_vencimento < CURDATE()
    `, [id]);
    
    const [parcelas] = await connection.execute(`
      SELECT p.*, e.valor as valor_total_emprestimo, e.juros_mensal, e.multa_atraso,
             DATE_FORMAT(p.data_vencimento, '%Y-%m-%d') as data_vencimento_formatada,
             DATE_FORMAT(p.data_pagamento, '%Y-%m-%d') as data_pagamento_formatada
      FROM parcelas p
      LEFT JOIN emprestimos e ON p.emprestimo_id = e.id
      WHERE p.emprestimo_id = ?
      ORDER BY p.numero_parcela ASC
    `, [id]);
    
    // Garantir que as datas estão no formato correto
    parcelas.forEach(parcela => {
      if (parcela.data_vencimento_formatada) {
        parcela.data_vencimento = parcela.data_vencimento_formatada;
      }
      if (parcela.data_pagamento_formatada) {
        parcela.data_pagamento = parcela.data_pagamento_formatada;
      }
    });
    
    await connection.end();
    res.json(parcelas);
  } catch (error) {
    console.error('Erro ao buscar parcelas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/emprestimos', ensureDatabase, async (req, res) => {
  try {
    console.log('=== INÍCIO DA CRIAÇÃO DE EMPRÉSTIMO ===');
    console.log('Dados recebidos para criar empréstimo:', JSON.stringify(req.body, null, 2));
    console.log('Sessão do usuário:', req.session);
    console.log('Headers da requisição:', req.headers);
    
    const { 
      cliente_id, 
      valor, 
      valor_final,
      valor_parcela,
      valor_inicial_final,
      valor_inicial_parcela,
      data_emprestimo, 
      data_vencimento, 
      juros_mensal, 
      multa_atraso, 
      observacoes,
      tipo_emprestimo = 'fixed',
      numero_parcelas = 1,
      frequencia = 'monthly',
      data_primeira_parcela,
      tipo_calculo
    } = req.body;
    
    // Validação dos dados obrigatórios
    console.log('Validando dados obrigatórios...');
    console.log('cliente_id:', cliente_id, 'tipo:', typeof cliente_id);
    console.log('valor:', valor, 'tipo:', typeof valor);
    console.log('data_emprestimo:', data_emprestimo, 'tipo:', typeof data_emprestimo);
    
    if (!cliente_id || !valor || !data_emprestimo) {
      console.error('Dados obrigatórios faltando:', { cliente_id, valor, data_emprestimo });
      return res.status(400).json({ error: 'Dados obrigatórios faltando' });
    }
    
    // Validação adicional de tipos
    if (isNaN(Number(cliente_id))) {
      console.error('cliente_id deve ser um número:', cliente_id);
      return res.status(400).json({ error: 'ID do cliente inválido' });
    }
    
    if (isNaN(Number(valor))) {
      console.error('valor deve ser um número:', valor);
      return res.status(400).json({ error: 'Valor do empréstimo inválido' });
    }
    
    const username = req.session.cobrancasUser;
    console.log('Usuário autenticado:', username);
    
    const connection = await createCobrancasConnection(username);
    console.log('Conexão com banco estabelecida');
    
    // Verificar se o cliente existe
    const [clienteRows] = await connection.execute(`
      SELECT id, nome FROM clientes_cobrancas WHERE id = ?
    `, [cliente_id]);
    
    if (clienteRows.length === 0) {
      await connection.end();
      console.error('Cliente não encontrado:', cliente_id);
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }
    
    console.log('Cliente encontrado:', clienteRows[0]);
    
    // Calcular valores baseado no tipo de cálculo
    const parseDecimal = (v) => {
      if (v === null || v === undefined || v === '') return 0;
      const n = parseFloat(String(v).replace(',', '.'));
      return Number.isFinite(n) ? n : 0;
    };

    let valorInicial = parseDecimal(valor);
    let valorFinalCalculado = parseDecimal(valor_final) || valorInicial;
    let valorParcelaCalculado = parseDecimal(valor_parcela);
    let jurosMensalFinal = parseDecimal(juros_mensal);
    const multaAtrasoNorm = parseDecimal(multa_atraso);
    
    console.log('Valores recebidos do frontend:', {
      valor, valor_final, valor_parcela, valor_inicial_final, valor_inicial_parcela, tipo_calculo
    });

    // Ajustar valores baseado no tipo de cálculo
    if (tipo_calculo === 'valor_final' && valor_final) {
      // Para valor final fixo: o frontend envia valor_inicial_final e valor_final
      // valor_inicial_final é o valor que o cliente pegou emprestado
      // valor_final é o total que ele deve pagar
      valorInicial = valorInicial; // manter o valor enviado no campo 'valor'
      valorFinalCalculado = parseDecimal(valor_final);
      valorParcelaCalculado = valorFinalCalculado / parseInt(String(numero_parcelas), 10);
      jurosMensalFinal = valorInicial > 0 ? ((valorFinalCalculado - valorInicial) / valorInicial) * 100 : 0;
    } else if (tipo_calculo === 'parcela_fixa' && valor_parcela) {
      valorInicial = valorInicial; // manter o valor enviado no campo 'valor'
      valorParcelaCalculado = parseDecimal(valor_parcela);
      valorFinalCalculado = valorParcelaCalculado * parseInt(String(numero_parcelas), 10);
      jurosMensalFinal = valorInicial > 0 ? ((valorFinalCalculado - valorInicial) / valorInicial) * 100 : 0;
    } else if (tipo_calculo === 'valor_inicial') {
      valorFinalCalculado = valorInicial * (1 + jurosMensalFinal / 100);
      valorParcelaCalculado = valorFinalCalculado / parseInt(numero_parcelas, 10);
    }

    if (!Number.isFinite(jurosMensalFinal)) jurosMensalFinal = 0;
    if (!Number.isFinite(valorFinalCalculado)) valorFinalCalculado = valorInicial;
    if (!Number.isFinite(valorParcelaCalculado)) valorParcelaCalculado = 0;

    console.log('Valores calculados finais:', {
      valorInicial, valorFinalCalculado, valorParcelaCalculado, jurosMensalFinal
    });
    
    // Calcular data de vencimento baseada no tipo de empréstimo
    let dataVencimentoFinal = data_vencimento;
    if (tipo_emprestimo === 'in_installments' && data_primeira_parcela) {
      dataVencimentoFinal = data_primeira_parcela;
    }
    
    console.log('Cliente encontrado, inserindo empréstimo...');
    
    // Inserir empréstimo
    console.log('Tentando inserir empréstimo com dados:', {
      cliente_id, valor: valorInicial, data_emprestimo, data_vencimento: dataVencimentoFinal, 
      juros_mensal: jurosMensalFinal, 
      multa_atraso: multaAtrasoNorm, 
      observacoes: observacoes || '',
      tipo_emprestimo,
      numero_parcelas,
      frequencia,
      valor_parcela: valorParcelaCalculado,
      valor_final: valorFinalCalculado
    });
    
    // Verificar se a coluna tipo_calculo existe
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'emprestimos' AND COLUMN_NAME = 'tipo_calculo'
    `);
    
    let emprestimoResult;
    if (columns.length > 0) {
      // Coluna existe, incluir tipo_calculo
      [emprestimoResult] = await connection.execute(`
        INSERT INTO emprestimos (
          cliente_id, valor, data_emprestimo, data_vencimento, juros_mensal, multa_atraso, observacoes,
          tipo_emprestimo, numero_parcelas, frequencia, valor_parcela, tipo_calculo
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        cliente_id, valorInicial, data_emprestimo, dataVencimentoFinal, 
        jurosMensalFinal, multaAtrasoNorm, observacoes || '',
        tipo_emprestimo, numero_parcelas, frequencia, valorParcelaCalculado, tipo_calculo || 'valor_inicial'
      ]);
    } else {
      // Coluna não existe, inserir sem tipo_calculo
      [emprestimoResult] = await connection.execute(`
        INSERT INTO emprestimos (
          cliente_id, valor, data_emprestimo, data_vencimento, juros_mensal, multa_atraso, observacoes,
          tipo_emprestimo, numero_parcelas, frequencia, valor_parcela
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        cliente_id, valorInicial, data_emprestimo, dataVencimentoFinal, 
        jurosMensalFinal, multaAtrasoNorm, observacoes || '',
        tipo_emprestimo, numero_parcelas, frequencia, valorParcelaCalculado
      ]);
    }
    
    console.log('Empréstimo inserido com ID:', emprestimoResult.insertId);
    
    // Se for empréstimo parcelado, criar as parcelas
    if (tipo_emprestimo === 'in_installments' && parseInt(numero_parcelas) > 1) {
      console.log('Criando parcelas para empréstimo parcelado...');
      
      const dataPrimeiraParcela = new Date(data_primeira_parcela || dataVencimentoFinal);
      const parcelas = [];
      
      for (let i = 1; i <= parseInt(numero_parcelas); i++) {
        const dataVencimentoParcela = new Date(dataPrimeiraParcela);
        
        // Calcular data de vencimento baseada na frequência
        switch (frequencia) {
          case 'daily':
            dataVencimentoParcela.setDate(dataVencimentoParcela.getDate() + (i - 1));
            break;
          case 'weekly':
            dataVencimentoParcela.setDate(dataVencimentoParcela.getDate() + ((i - 1) * 7));
            break;
          case 'biweekly':
            dataVencimentoParcela.setDate(dataVencimentoParcela.getDate() + ((i - 1) * 14));
            break;
          case 'monthly':
          default:
            dataVencimentoParcela.setMonth(dataVencimentoParcela.getMonth() + (i - 1));
            break;
        }
        
        parcelas.push([
          emprestimoResult.insertId,
          i,
          valorParcelaCalculado,
          dataVencimentoParcela.toISOString().split('T')[0]
        ]);
      }
      
      // Inserir todas as parcelas
      for (const parcela of parcelas) {
        await connection.execute(`
          INSERT INTO parcelas (emprestimo_id, numero_parcela, valor_parcela, data_vencimento)
          VALUES (?, ?, ?, ?)
        `, parcela);
      }
      
      console.log(`${parcelas.length} parcelas criadas`);
    } else {
      // Para empréstimos fixos, criar uma parcela única
      await connection.execute(`
        INSERT INTO parcelas (emprestimo_id, numero_parcela, valor_parcela, data_vencimento)
        VALUES (?, ?, ?, ?)
      `, [emprestimoResult.insertId, 1, valorFinalCalculado, dataVencimentoFinal]);
      
      console.log('Parcela única criada para empréstimo fixo');
    }
    
    // Criar cobranças baseadas nas parcelas
    if (tipo_emprestimo === 'in_installments' && parseInt(numero_parcelas) > 1) {
      console.log('Criando cobranças para cada parcela...');
      
      const dataPrimeiraParcela = new Date(data_primeira_parcela || dataVencimentoFinal);
      
      for (let i = 1; i <= parseInt(numero_parcelas); i++) {
        const dataVencimentoParcela = new Date(dataPrimeiraParcela);
        
        // Calcular data de vencimento baseada na frequência
        switch (frequencia) {
          case 'daily':
            dataVencimentoParcela.setDate(dataVencimentoParcela.getDate() + (i - 1));
            break;
          case 'weekly':
            dataVencimentoParcela.setDate(dataVencimentoParcela.getDate() + ((i - 1) * 7));
            break;
          case 'biweekly':
            dataVencimentoParcela.setDate(dataVencimentoParcela.getDate() + ((i - 1) * 14));
            break;
          case 'monthly':
          default:
            dataVencimentoParcela.setMonth(dataVencimentoParcela.getMonth() + (i - 1));
            break;
        }
        
        await connection.execute(`
          INSERT INTO cobrancas (emprestimo_id, cliente_id, valor_original, valor_atualizado, data_vencimento, status)
          VALUES (?, ?, ?, ?, ?, 'Pendente')
        `, [emprestimoResult.insertId, cliente_id, valorParcelaCalculado, valorParcelaCalculado, dataVencimentoParcela.toISOString().split('T')[0]]);
      }
      
      console.log(`${numero_parcelas} cobranças criadas para as parcelas`);
    } else {
      // Para empréstimos fixos, criar uma cobrança única
      console.log('Tentando criar cobrança única com dados:', {
        emprestimo_id: emprestimoResult.insertId,
        cliente_id,
        valor_original: valorFinalCalculado,
        valor_atualizado: valorFinalCalculado,
        data_vencimento: dataVencimentoFinal
      });
      
      await connection.execute(`
        INSERT INTO cobrancas (emprestimo_id, cliente_id, valor_original, valor_atualizado, data_vencimento, status)
        VALUES (?, ?, ?, ?, ?, 'Pendente')
      `, [emprestimoResult.insertId, cliente_id, valorFinalCalculado, valorFinalCalculado, dataVencimentoFinal]);
      
      console.log('Cobrança única criada automaticamente');
    }
    
    await connection.end();
    res.json({ 
      id: emprestimoResult.insertId, 
      message: 'Empréstimo criado com sucesso',
      parcelas_criadas: tipo_emprestimo === 'in_installments' ? parseInt(numero_parcelas) : 1
    });
  } catch (error) {
    console.error('Erro ao criar empréstimo:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

// Cobranças
router.get('/cobrancas', ensureDatabase, async (req, res) => {
  try {
    const username = req.session.cobrancasUser;
    const connection = await createCobrancasConnection(username);
    await connection.execute(SQL_UPDATE_COBRANCAS_JUROS_POR_PERIODO);
    const [cobrancas] = await connection.execute(`
      SELECT cb.*, c.nome as cliente_nome, c.telefone, c.email,
        e.frequencia AS emprestimo_frequencia,
        (${SQL_PERIODOS_EM_ABERTO_LISTAGEM}) AS periodos_em_aberto
      FROM cobrancas cb
      INNER JOIN emprestimos e ON cb.emprestimo_id = e.id
      LEFT JOIN clientes_cobrancas c ON cb.cliente_id = c.id
      WHERE cb.status = 'Pendente' AND cb.cliente_id IS NOT NULL
        AND TRIM(UPPER(e.status)) NOT IN ('QUITADO', 'CANCELADO')
      ORDER BY cb.data_vencimento ASC
    `);
    await connection.end();
    const out = cobrancas.map((row) => ({
      ...row,
      mensagem_periodos_aberto: mensagemPeriodosEmAberto(row.periodos_em_aberto, row.emprestimo_frequencia)
    }));
    res.json(out);
  } catch (error) {
    console.error('Erro ao buscar cobranças:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Cobranças atrasadas
router.get('/cobrancas/atrasadas', ensureDatabase, async (req, res) => {
  try {
    const username = req.session.cobrancasUser;
    const connection = await createCobrancasConnection(username);
    await connection.execute(SQL_UPDATE_COBRANCAS_JUROS_POR_PERIODO);
    const [cobrancas] = await connection.execute(`
      SELECT cb.*, c.nome as cliente_nome, c.telefone, c.email,
        e.frequencia AS emprestimo_frequencia,
        (${SQL_PERIODOS_EM_ABERTO_LISTAGEM}) AS periodos_em_aberto
      FROM cobrancas cb
      LEFT JOIN clientes_cobrancas c ON cb.cliente_id = c.id
      LEFT JOIN emprestimos e ON cb.emprestimo_id = e.id
      WHERE cb.dias_atraso > 0 AND cb.status = 'Pendente'
      ORDER BY cb.dias_atraso DESC
    `);
    await connection.end();
    const out = cobrancas.map((row) => ({
      ...row,
      mensagem_periodos_aberto: mensagemPeriodosEmAberto(row.periodos_em_aberto, row.emprestimo_frequencia)
    }));
    res.json(out);
  } catch (error) {
    console.error('Erro ao buscar cobranças atrasadas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Registrar pagamento
router.post('/cobrancas/:id/pagamento', ensureDatabase, async (req, res) => {
  try {
    const { id } = req.params;
    const { valor_pago, data_pagamento, forma_pagamento, observacoes } = req.body;
    
    const username = req.session.cobrancasUser;
    const connection = await createCobrancasConnection(username);
    
    // Registrar pagamento
    await connection.execute(`
      INSERT INTO pagamentos (cobranca_id, valor_pago, data_pagamento, forma_pagamento, observacoes)
      VALUES (?, ?, ?, ?, ?)
    `, [id, valor_pago, data_pagamento, forma_pagamento, observacoes]);
    
    // Atualizar status da cobrança
    await connection.execute(`
      UPDATE cobrancas SET status = 'Paga' WHERE id = ?
    `, [id]);
    
    await connection.end();
    res.json({ message: 'Pagamento registrado com sucesso' });
  } catch (error) {
    console.error('Erro ao registrar pagamento:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Pagamento de juros com extensão de prazo
router.post('/emprestimos/:id/pagamento-juros', ensureDatabase, async (req, res) => {
  try {
    const { id } = req.params;
    const { valor_juros_pago, data_pagamento, forma_pagamento, observacoes } = req.body;
    
    const username = req.session.cobrancasUser;
    const connection = await createCobrancasConnection(username);
    
    // Buscar dados do empréstimo
    const [emprestimoRows] = await connection.execute(`
      SELECT e.*, c.nome as cliente_nome 
      FROM emprestimos e 
      LEFT JOIN clientes_cobrancas c ON e.cliente_id = c.id 
      WHERE e.id = ?
    `, [id]);
    
    if (emprestimoRows.length === 0) {
      await connection.end();
      return res.status(404).json({ error: 'Empréstimo não encontrado' });
    }
    
    const emprestimo = emprestimoRows[0];
    
    // Calcular juros acumulados
    const valorInicial = parseFloat(emprestimo.valor) || 0;
    const jurosMensal = parseFloat(emprestimo.juros_mensal) || 0;
    const jurosAcumulados = valorInicial * (jurosMensal / 100);
    
    // Verificar se o valor pago é suficiente para cobrir os juros
    if (parseFloat(valor_juros_pago) < jurosAcumulados) {
      await connection.end();
      return res.status(400).json({ 
        error: `Valor insuficiente. Juros acumulados: R$ ${jurosAcumulados.toFixed(2)}` 
      });
    }
    
    // Registrar pagamento de juros
    await connection.execute(`
      INSERT INTO pagamentos (cobranca_id, valor_pago, data_pagamento, forma_pagamento, observacoes)
      VALUES (?, ?, ?, ?, ?)
    `, [emprestimo.id, valor_juros_pago, data_pagamento, forma_pagamento, `Pagamento de juros: ${observacoes || ''}`]);
    
    // Calcular nova data de vencimento baseado na frequência
    // Mensal: +1 mês mantendo o dia (fev 29/30/31->28, março volta 29/30/31; meses 30 dias idem)
    // Semanal: +7 dias | Quinzenal: +14 dias | Diário: +1 dia
    const frequencia = emprestimo.frequencia || 'monthly';
    const novaDataVencimento = calcularProximaDataVencimento(emprestimo.data_vencimento, frequencia);
    console.log(`📅 Frequência: ${frequencia}, Nova data: ${novaDataVencimento.toISOString().split('T')[0]}`);
    
    // Atualizar empréstimo: nova data de vencimento, status Ativo, valor volta ao inicial
    // O valor da dívida volta ao valor inicial do empréstimo (não acumula juros)
    
    await connection.execute(`
      UPDATE emprestimos 
      SET 
        data_vencimento = ?,
        valor = ?,
        status = 'Ativo',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [novaDataVencimento.toISOString().split('T')[0], valorInicial, id]);
    
    // Atualizar cobrança relacionada
    await connection.execute(`
      UPDATE cobrancas 
      SET 
        data_vencimento = ?,
        valor_original = ?,
        valor_atualizado = ?,
        status = 'Pendente',
        updated_at = CURRENT_TIMESTAMP
      WHERE emprestimo_id = ?
    `, [novaDataVencimento.toISOString().split('T')[0], valorInicial, valorInicial, id]);
    
    await connection.end();
    
    res.json({ 
      message: 'Pagamento de juros registrado com sucesso',
      nova_data_vencimento: novaDataVencimento.toISOString().split('T')[0],
      novo_valor: valorInicial,
      juros_pagos: valor_juros_pago
    });
    
  } catch (error) {
    console.error('Erro ao registrar pagamento de juros:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota de login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    // Conecte ao banco central de usuários (ex: jpsistemas_users)
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: 'jpsistemas_users'
    });
    const [rows] = await conn.execute(
      'SELECT * FROM usuarios_cobrancas WHERE username = ?',
      [username]
    );
    await conn.end();

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Usuário ou senha inválidos.' });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Usuário ou senha inválidos.' });
    }

    // Criar banco de dados do usuário se não existir
    try {
      await createCobrancasDatabase(username);
    } catch (dbError) {
      console.error('Erro ao criar banco do usuário:', dbError);
      return res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }

    // Salva na sessão o usuário
    req.session.cobrancasUser = username;
    req.session.cobrancasDb = `jpsistemas_${username.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

    res.json({ success: true });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
});

// Rota para verificar sessão
router.get('/session', (req, res) => {
  if (req.session.cobrancasUser) {
    res.json({ 
      authenticated: true, 
      user: req.session.cobrancasUser,
      db: req.session.cobrancasDb
    });
  } else {
    res.json({ authenticated: false });
  }
});

// Rota para verificar autenticação (usada pelo frontend)
router.get('/check-auth', (req, res) => {
  if (req.session.cobrancasUser) {
    res.json({ 
      authenticated: true, 
      user: req.session.cobrancasUser,
      db: req.session.cobrancasDb
    });
  } else {
    res.status(401).json({ authenticated: false });
  }
});

// Rota para logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Erro ao fazer logout.' });
    }
    res.json({ success: true });
  });
});

// Rota para atualizar status do empréstimo
router.put('/emprestimos/:id/status', ensureDatabase, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const username = req.session.cobrancasUser;
    const connection = await createCobrancasConnection(username);
    
    // Atualizar status do empréstimo
    await connection.execute(
      'UPDATE emprestimos SET status = ? WHERE id = ?',
      [status, id]
    );
    
    // Se status for 'Em Atraso', atualiza o valor da dívida (valor = valor + juros)
    if (status === 'Em Atraso') {
      // Busca valor e juros atuais
      const [rows] = await connection.execute('SELECT valor, juros_mensal FROM emprestimos WHERE id = ?', [id]);
      if (rows.length > 0) {
        const valorAtual = parseFloat(rows[0].valor) || 0;
        const juros = parseFloat(rows[0].juros_mensal) || 0;
        const valorJuros = valorAtual * (juros / 100);
        const novoValor = valorAtual + valorJuros;
        await connection.execute('UPDATE emprestimos SET valor = ? WHERE id = ?', [novoValor, id]);
      }
    }
    
    // Se status for 'Quitado', marcar cobranças como 'Paga' E parcelas como 'Paga'
    if (status === 'Quitado') {
      // Marcar cobranças como pagas
      await connection.execute('UPDATE cobrancas SET status = ? WHERE emprestimo_id = ?', ['Paga', id]);
      
      // Marcar todas as parcelas como pagas (se existirem)
      const hoje = new Date().toISOString().split('T')[0];
      await connection.execute(`
        UPDATE parcelas 
        SET status = 'Paga', 
            data_pagamento = ?, 
            valor_pago = COALESCE(valor_pago, valor_parcela),
            updated_at = CURRENT_TIMESTAMP
        WHERE emprestimo_id = ? AND status != 'Paga'
      `, [hoje, id]);
      
      console.log(`Empréstimo ${id} marcado como quitado - todas as parcelas foram marcadas como pagas`);
    }
    
    // Se status for 'Cancelado', marcar cobranças como 'Cancelada'
    if (status === 'Cancelado') {
      await connection.execute('UPDATE cobrancas SET status = ? WHERE emprestimo_id = ?', ['Cancelada', id]);
    }
    
    await connection.end();
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao atualizar status do empréstimo:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para remover empréstimo
router.delete('/emprestimos/:id', ensureDatabase, async (req, res) => {
  try {
    const { id } = req.params;
    const username = req.session.cobrancasUser;
    const connection = await createCobrancasConnection(username);
    await connection.execute('DELETE FROM emprestimos WHERE id = ?', [id]);
    await connection.end();
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao remover empréstimo:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para gerenciar lista negra
router.put('/clientes/:id/lista-negra', ensureDatabase, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, motivo } = req.body;
    
    console.log(`DEBUG: Gerenciando lista negra para cliente ${id}`);
    console.log(`DEBUG: Status: ${status}, Motivo: ${motivo}`);
    
    const username = req.session.cobrancasUser;
    const connection = await createCobrancasConnection(username);
    
    // Verificar se o cliente existe
    const [clienteRows] = await connection.execute(`
      SELECT id, nome, status FROM clientes_cobrancas WHERE id = ?
    `, [id]);
    
    if (clienteRows.length === 0) {
      await connection.end();
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }
    
    console.log(`DEBUG: Cliente encontrado: ${clienteRows[0].nome} (Status atual: ${clienteRows[0].status})`);
    
    // Atualizar status do cliente
    await connection.execute(`
      UPDATE clientes_cobrancas 
      SET 
        status = ?,
        observacoes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [status, motivo, id]);
    
    console.log(`DEBUG: Cliente atualizado com sucesso`);
    
    await connection.end();
    res.json({ 
      message: `Cliente ${status === 'Lista Negra' ? 'adicionado à' : 'removido da'} lista negra com sucesso`,
      cliente_id: id,
      novo_status: status
    });
  } catch (error) {
    console.error('Erro ao gerenciar lista negra:', error);
    console.error('Detalhes do erro:', {
      message: error.message,
      code: error.code,
      sqlMessage: error.sqlMessage
    });
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Atualizar cliente
router.put('/clientes/:id', ensureDatabase, async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, cpf_cnpj, telefone, email, endereco, cidade, estado, cep } = req.body;
    
    if (!nome) {
      return res.status(400).json({ error: 'Nome é obrigatório.' });
    }
    
    const username = req.session.cobrancasUser;
    const connection = await createCobrancasConnection(username);
    
    // Verificar se o cliente existe
    const [existing] = await connection.execute('SELECT * FROM clientes_cobrancas WHERE id = ?', [id]);
    if (existing.length === 0) {
      await connection.end();
      return res.status(404).json({ error: 'Cliente não encontrado.' });
    }
    
    // Atualizar cliente
    await connection.execute(
      `UPDATE clientes_cobrancas SET 
        nome = ?, 
        cpf_cnpj = ?, 
        telefone = ?, 
        email = ?, 
        endereco = ?, 
        cidade = ?, 
        estado = ?, 
        cep = ?,
        updated_at = NOW()
      WHERE id = ?`,
      [nome, cpf_cnpj || null, telefone || null, email || null, endereco || null, cidade || null, estado || null, cep || null, id]
    );
    
    // Buscar cliente atualizado
    const [updated] = await connection.execute('SELECT * FROM clientes_cobrancas WHERE id = ?', [id]);
    await connection.end();
    
    res.json(updated[0]);
  } catch (error) {
    console.error('Erro ao atualizar cliente:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Remover cliente
router.delete('/clientes/:id', ensureDatabase, async (req, res) => {
  const { id } = req.params;
  try {
    const username = req.session.cobrancasUser;
    const connection = await createCobrancasConnection(username);
    // Verifica se o cliente possui empréstimos vinculados
    const [emprestimos] = await connection.execute(
      'SELECT COUNT(*) as total FROM emprestimos WHERE cliente_id = ?',
      [id]
    );
    if (emprestimos[0].total > 0) {
      await connection.end();
      return res.status(400).json({ error: 'Não é possível remover clientes com empréstimos vinculados.' });
    }
    // Remove o cliente
    await connection.execute('DELETE FROM clientes_cobrancas WHERE id = ?', [id]);
    await connection.end();
    res.json({ message: 'Cliente removido com sucesso.' });
  } catch (error) {
    console.error('Erro ao remover cliente:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// --- Documentos do cliente (PDF e imagens) - JP Cobranças ---
const uploadsCobrancasDir = path.join(__dirname, '..', 'uploads', 'cobrancas');
const allowedMimesCobrancas = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp'
];

const storageDocumentosCobrancas = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const username = (req.session && req.session.cobrancasUser) ? String(req.session.cobrancasUser).replace(/[^a-z0-9_]/g, '_') : 'default';
      const clienteId = req.params.id || '0';
      const dir = path.join(uploadsCobrancasDir, username, 'clientes', clienteId);
      await fs.mkdir(dir, { recursive: true });
      cb(null, dir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const nomeOriginal = (file.originalname || 'arquivo').replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${nomeOriginal}`);
  }
});

const uploadDocumentosCobrancas = multer({
  storage: storageDocumentosCobrancas,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (allowedMimesCobrancas.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo não permitido. Use PDF ou imagens (JPEG, PNG, GIF, WebP).'));
    }
  }
});

const SQL_CREATE_CLIENTE_COBRANCAS_DOCUMENTOS = `
  CREATE TABLE IF NOT EXISTS cliente_cobrancas_documentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cliente_id INT NOT NULL,
    nome_original VARCHAR(255) NOT NULL,
    nome_arquivo VARCHAR(255) NOT NULL,
    caminho VARCHAR(500) NOT NULL,
    tipo_mime VARCHAR(100) NOT NULL,
    tamanho INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cliente_id) REFERENCES clientes_cobrancas(id) ON DELETE CASCADE,
    INDEX idx_cliente_id (cliente_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

router.get('/clientes/:id/documentos', ensureDatabase, async (req, res) => {
  try {
    const username = req.session.cobrancasUser;
    const connection = await createCobrancasConnection(username);
    await connection.execute(SQL_CREATE_CLIENTE_COBRANCAS_DOCUMENTOS);
    const { id } = req.params;
    const [rows] = await connection.execute(
      'SELECT id, nome_original, nome_arquivo, caminho, tipo_mime, tamanho, created_at FROM cliente_cobrancas_documentos WHERE cliente_id = ? ORDER BY created_at DESC',
      [id]
    );
    await connection.end();
    res.json(rows);
  } catch (error) {
    console.error('Erro ao listar documentos cobranças:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/clientes/:id/documentos', ensureDatabase, (req, res, next) => {
  uploadDocumentosCobrancas.array('arquivo', 20)(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Arquivo muito grande. Máximo 15 MB por arquivo.' });
      }
      return res.status(400).json({ error: err.message || 'Erro no upload.' });
    }
    const files = req.files && req.files.length ? req.files : [];
    if (files.length === 0) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado. Envie um ou mais PDFs ou imagens.' });
    }
    try {
      const username = req.session.cobrancasUser;
      const connection = await createCobrancasConnection(username);
      const { id } = req.params;
      for (const file of files) {
        const caminhoRel = path.relative(path.join(uploadsCobrancasDir), file.path).replace(/\\/g, '/');
        await connection.execute(
          'INSERT INTO cliente_cobrancas_documentos (cliente_id, nome_original, nome_arquivo, caminho, tipo_mime, tamanho) VALUES (?, ?, ?, ?, ?, ?)',
          [id, file.originalname || file.filename, file.filename, caminhoRel, file.mimetype, file.size || 0]
        );
      }
      await connection.end();
      res.status(201).json({ message: files.length === 1 ? 'Documento anexado com sucesso.' : `${files.length} documentos anexados com sucesso.`, count: files.length });
    } catch (error) {
      console.error('Erro ao salvar documento cobranças:', error);
      for (const file of files) {
        try { await fs.unlink(file.path); } catch (_) {}
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });
});

router.get('/clientes/:id/documentos/:docId/arquivo', ensureDatabase, async (req, res) => {
  try {
    const username = req.session.cobrancasUser;
    const connection = await createCobrancasConnection(username);
    const { id, docId } = req.params;
    const [rows] = await connection.execute(
      'SELECT caminho, nome_original, tipo_mime FROM cliente_cobrancas_documentos WHERE id = ? AND cliente_id = ?',
      [docId, id]
    );
    await connection.end();
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Documento não encontrado.' });
    }
    const doc = rows[0];
    const fullPath = path.join(uploadsCobrancasDir, doc.caminho);
    try {
      await fs.access(fullPath);
    } catch (_) {
      return res.status(404).json({ error: 'Arquivo não encontrado no servidor.' });
    }
    res.setHeader('Content-Type', doc.tipo_mime || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.nome_original)}"`);
    res.sendFile(path.resolve(fullPath));
  } catch (error) {
    console.error('Erro ao servir documento cobranças:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.delete('/clientes/:id/documentos/:docId', ensureDatabase, async (req, res) => {
  try {
    const username = req.session.cobrancasUser;
    const connection = await createCobrancasConnection(username);
    const { id, docId } = req.params;
    const [rows] = await connection.execute(
      'SELECT caminho FROM cliente_cobrancas_documentos WHERE id = ? AND cliente_id = ?',
      [docId, id]
    );
    if (rows.length === 0) {
      await connection.end();
      return res.status(404).json({ error: 'Documento não encontrado.' });
    }
    const fullPath = path.join(uploadsCobrancasDir, rows[0].caminho);
    await connection.execute('DELETE FROM cliente_cobrancas_documentos WHERE id = ? AND cliente_id = ?', [docId, id]);
    await connection.end();
    try {
      await fs.unlink(fullPath);
    } catch (_) {}
    res.json({ message: 'Documento removido com sucesso' });
  } catch (error) {
    console.error('Erro ao remover documento cobranças:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para buscar detalhes de um cliente pelo ID
router.get('/clientes/:id', ensureDatabase, async (req, res) => {
  try {
    const { id } = req.params;
    console.log('DEBUG /clientes/:id - id recebido:', id);
    const username = req.session.cobrancasUser;
    const connection = await createCobrancasConnection(username);
    // Buscar dados do cliente
    const [rows] = await connection.execute('SELECT * FROM clientes_cobrancas WHERE id = ?', [id]);
    if (rows.length === 0) {
      await connection.end();
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }
    const cliente = rows[0];
    // Buscar empréstimos do cliente (apenas ativos e pendentes)
    const [emprestimos] = await connection.execute(
      'SELECT * FROM emprestimos WHERE cliente_id = ? AND status IN (?, ?) ORDER BY created_at DESC',
      [id, 'Ativo', 'Pendente']
    );
    console.log('DEBUG /clientes/:id - emprestimos encontrados:', emprestimos);
    // Buscar pagamentos relacionados a esses empréstimos (por cobrança)
    let pagamentos = [];
    if (emprestimos.length > 0) {
      const emprestimoIds = emprestimos.map(e => e.id);
      // Buscar cobranças desses empréstimos
      const [cobrancas] = await connection.execute(`SELECT * FROM cobrancas WHERE cliente_id = ?`, [id]);
      const cobrancaIds = cobrancas.map(c => c.id);
      if (cobrancaIds.length > 0) {
        const [pagamentosRows] = await connection.execute(`SELECT * FROM pagamentos WHERE cobranca_id IN (${cobrancaIds.map(() => '?').join(',')}) ORDER BY data_pagamento DESC`, cobrancaIds);
        pagamentos = pagamentosRows;
      }
    }
    await connection.end();
    res.json({ ...cliente, emprestimos, pagamentos });
  } catch (error) {
    console.error('Erro ao buscar cliente:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota utilitária para corrigir status de todos os empréstimos vencidos
router.post('/emprestimos/corrigir-status-vencidos', ensureDatabase, async (req, res) => {
  try {
    const username = req.session.cobrancasUser;
    const connection = await createCobrancasConnection(username);
    // Atualizar todos os empréstimos vencidos e não quitados para ATRASADO
    const hojeStr = new Date().toISOString().slice(0, 10);
    const [result] = await connection.execute(
      `UPDATE emprestimos SET status = 'ATRASADO' WHERE status != 'QUITADO' AND data_vencimento < ?`,
      [hojeStr]
    );
    await connection.end();
    res.json({ success: true, updated: result.affectedRows });
  } catch (error) {
    console.error('Erro ao corrigir status dos empréstimos vencidos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ========== CONFIGURAÇÕES DO USUÁRIO ==========

// Buscar configurações do usuário
// Requer apenas sessão (não cria banco do usuário)
function requireCobrancasSession(req, res, next) {
  if (!req.session || !req.session.cobrancasUser) {
    return res.status(401).json({ error: 'Não autenticado.' });
  }
  next();
}

async function getUsersConnection() {
  return mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'jpsistemas',
    password: process.env.DB_PASSWORD || 'Juliano@95',
    database: 'jpsistemas_users',
    charset: 'utf8mb4'
  });
}

async function ensureEmailColumnUsuariosCobrancas(connection) {
  try {
    await connection.execute('ALTER TABLE usuarios_cobrancas ADD COLUMN email VARCHAR(255) NULL');
  } catch (err) {
    if (err.code !== 'ER_DUP_FIELDNAME') throw err;
  }
}

router.get('/perfil', requireCobrancasSession, async (req, res) => {
  try {
    const conn = await getUsersConnection();
    await ensureEmailColumnUsuariosCobrancas(conn);
    const [rows] = await conn.execute(
      'SELECT username, email FROM usuarios_cobrancas WHERE username = ?',
      [req.session.cobrancasUser]
    );
    await conn.end();
    if (rows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });
    res.json({ username: rows[0].username, email: rows[0].email || '' });
  } catch (error) {
    console.error('Erro ao buscar perfil cobranças:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.put('/alterar-senha', requireCobrancasSession, async (req, res) => {
  try {
    const { senha_atual, nova_senha } = req.body;
    if (!senha_atual || !nova_senha) {
      return res.status(400).json({ error: 'Informe a senha atual e a nova senha.' });
    }
    if (nova_senha.length < 6) {
      return res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres.' });
    }
    const conn = await getUsersConnection();
    const [rows] = await conn.execute('SELECT password_hash FROM usuarios_cobrancas WHERE username = ?', [req.session.cobrancasUser]);
    if (rows.length === 0) {
      await conn.end();
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    const valid = await bcrypt.compare(senha_atual, rows[0].password_hash);
    if (!valid) {
      await conn.end();
      return res.status(401).json({ error: 'Senha atual incorreta.' });
    }
    const hash = await bcrypt.hash(nova_senha, 12);
    await conn.execute('UPDATE usuarios_cobrancas SET password_hash = ? WHERE username = ?', [hash, req.session.cobrancasUser]);
    await conn.end();
    res.json({ message: 'Senha alterada com sucesso.' });
  } catch (error) {
    console.error('Erro ao alterar senha cobranças:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.put('/alterar-email', requireCobrancasSession, async (req, res) => {
  try {
    const { email, senha_atual } = req.body;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Informe um e-mail válido.' });
    }
    if (!senha_atual) {
      return res.status(400).json({ error: 'Informe a senha atual para confirmar.' });
    }
    const conn = await getUsersConnection();
    await ensureEmailColumnUsuariosCobrancas(conn);
    const [rows] = await conn.execute('SELECT password_hash FROM usuarios_cobrancas WHERE username = ?', [req.session.cobrancasUser]);
    if (rows.length === 0) {
      await conn.end();
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    const valid = await bcrypt.compare(senha_atual, rows[0].password_hash);
    if (!valid) {
      await conn.end();
      return res.status(401).json({ error: 'Senha atual incorreta.' });
    }
    const [existing] = await conn.execute('SELECT id FROM usuarios_cobrancas WHERE email = ? AND username != ?', [email.trim(), req.session.cobrancasUser]);
    if (existing.length > 0) {
      await conn.end();
      return res.status(400).json({ error: 'Este e-mail já está em uso por outro usuário.' });
    }
    await conn.execute('UPDATE usuarios_cobrancas SET email = ? WHERE username = ?', [email.trim(), req.session.cobrancasUser]);
    await conn.end();
    res.json({ message: 'E-mail alterado com sucesso.' });
  } catch (error) {
    console.error('Erro ao alterar e-mail cobranças:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Backup por e-mail: envia do suporte.jpsistemas@gmail.com para o e-mail cadastrado do usuário
router.post('/backup-email', ensureDatabase, uploadBackupEmail, async (req, res) => {
  try {
    const username = req.session.cobrancasUser;
    const conn = await getUsersConnection();
    await ensureEmailColumnUsuariosCobrancas(conn);
    const [rows] = await conn.execute(
      'SELECT email FROM usuarios_cobrancas WHERE username = ?',
      [username]
    );
    await conn.end();
    if (rows.length === 0 || !rows[0].email || !String(rows[0].email).trim().includes('@')) {
      return res.status(400).json({
        error: 'E-mail não cadastrado.',
        message: 'Cadastre seu e-mail em Configurações > Perfil para receber o backup.'
      });
    }
    const destinoEmail = String(rows[0].email).trim();

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        error: 'Arquivo não enviado.',
        message: 'Envie o backup em um único arquivo ZIP (gerado pelo sistema).'
      });
    }

    const zip = new AdmZip(req.file.buffer);
    const entries = zip.getEntries().filter(function (e) { return !e.isDirectory; });

    const findByPattern = function (pattern) {
      const entry = entries.find(function (e) {
        const name = (e.entryName || '').split('/').pop() || '';
        return pattern.test(name);
      });
      if (!entry) return null;
      const name = (entry.entryName || '').split('/').pop() || 'arquivo';
      return { filename: name, content: entry.getData() };
    };

    const a1 = findByPattern(/Backup_Emprestimos.*\.xlsx$/i);
    const a3 = findByPattern(/Backup_Carteira_Clientes.*\.xlsx$/i);

    if (!a1 || !a3) {
      const names = entries.map(function (e) { return (e.entryName || '').split('/').pop(); });
      return res.status(400).json({
        error: 'ZIP inválido.',
        message: 'O ZIP deve conter as 2 planilhas Excel: Empréstimos e Carteira de Clientes. Encontrados: ' + (names.join(', ') || 'nenhum')
      });
    }

    const attachments = [a1, a3];

    const smtpUser = process.env.SMTP_USER || process.env.BACKUP_EMAIL_USER || 'suporte.jpsistemas@gmail.com';
    const smtpPass = process.env.SMTP_PASS || process.env.BACKUP_EMAIL_APP_PASSWORD;
    if (!smtpPass) {
      return res.status(503).json({
        error: 'Serviço de e-mail não configurado.',
        message: 'O administrador precisa configurar BACKUP_EMAIL_APP_PASSWORD (ou SMTP_PASS) no servidor.'
      });
    }

    const dataHora = new Date().toLocaleString('pt-BR', {
      dateStyle: 'long',
      timeStyle: 'medium'
    });

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Backup JP-Cobranças</title>
</head>
<body style="margin:0; padding:0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f7fa;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f7fa;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); overflow: hidden;">
          <tr>
            <td style="background: linear-gradient(135deg, #002f4b 0%, #001425 100%); padding: 32px 40px; text-align: center;">
              <img src="https://i.imgur.com/EQ1tjZX.png" alt="JP-Cobranças" width="180" height="auto" style="max-height: 60px; object-fit: contain;" />
              <h1 style="margin: 16px 0 0 0; color: #ffffff; font-size: 22px; font-weight: 600;">Backup do Sistema</h1>
              <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Seus dados foram exportados com sucesso</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 40px;">
              <p style="margin: 0 0 16px 0; color: #374151; font-size: 15px; line-height: 1.6;">Olá, <strong>${username}</strong>!</p>
              <p style="margin: 0 0 20px 0; color: #6b7280; font-size: 14px; line-height: 1.6;">Segue em anexo o backup solicitado, contendo:</p>
              <ul style="margin: 0 0 24px 0; padding-left: 20px; color: #4b5563; font-size: 14px; line-height: 1.8;">
                <li><strong>Backup de Empréstimos</strong> — planilha Excel</li>
                <li><strong>Carteira de Clientes</strong> — planilha Excel</li>
              </ul>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Data e hora da solicitação</p>
                    <p style="margin: 4px 0 0 0; color: #002f4b; font-size: 16px; font-weight: 600;">${dataHora}</p>
                  </td>
                </tr>
              </table>
              <p style="margin: 24px 0 0 0; color: #9ca3af; font-size: 12px;">Este e-mail foi enviado automaticamente pelo sistema JP-Cobranças. Não responda.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0; color: #94a3b8; font-size: 12px;">© ${new Date().getFullYear()} JP. Sistemas · jp-sistemas.com</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: false,
      auth: { user: smtpUser, pass: smtpPass }
    });

    await transporter.sendMail({
      from: `"JP-Cobranças Suporte" <${smtpUser}>`,
      to: destinoEmail,
      subject: `Backup JP-Cobranças — ${dataHora}`,
      html: htmlBody,
      attachments
    });

    res.json({
      success: true,
      message: 'Backup enviado com sucesso para ' + destinoEmail + '.'
    });
  } catch (err) {
    console.error('Erro ao enviar backup por e-mail:', err);
    if (err.code === 'EAUTH' || err.responseCode === 535) {
      return res.status(503).json({
        error: 'Falha na autenticação do e-mail.',
        message: 'Verifique SMTP_USER e SMTP_PASS (ou senha de app do Gmail) no servidor.'
      });
    }
    res.status(500).json({
      error: 'Erro ao enviar backup.',
      message: err.message || 'Tente novamente mais tarde.'
    });
  }
});

// Backup diário automático - chamado por cron com token
// Ex: curl -X POST "http://localhost:3000/api/cobrancas/backup-diario-enviar?token=SEU_TOKEN"
router.post('/backup-diario-enviar', async (req, res) => {
  const token = req.query.token || req.body?.token;
  const expectedToken = process.env.BACKUP_CRON_TOKEN || process.env.CRON_SECRET;
  if (!expectedToken || token !== expectedToken) {
    return res.status(403).json({ error: 'Token inválido ou não configurado.' });
  }
  const results = { enviados: 0, erros: [], ok: [] };
  try {
    const usersConn = await getUsersConnection();
    await ensureEmailColumnUsuariosCobrancas(usersConn);
    const [users] = await usersConn.execute('SELECT username, email FROM usuarios_cobrancas WHERE email IS NOT NULL AND TRIM(email) != "" AND email LIKE "%@%"');
    await usersConn.end();
    const smtpPass = process.env.SMTP_PASS || process.env.BACKUP_EMAIL_APP_PASSWORD;
    if (!smtpPass) {
      return res.status(503).json({ error: 'SMTP não configurado. Defina SMTP_PASS ou BACKUP_EMAIL_APP_PASSWORD.' });
    }
    const smtpUser = process.env.SMTP_USER || process.env.BACKUP_EMAIL_USER || 'suporte.jpsistemas@gmail.com';
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: false,
      auth: { user: smtpUser, pass: smtpPass }
    });
    for (const row of users) {
      const username = (row.username || '').trim();
      const email = (row.email || '').trim();
      if (!username || !email || !email.includes('@')) continue;
      try {
        const conn = await createCobrancasConnection(username);
        let configRows = [];
        try {
          [configRows] = await conn.execute('SELECT backup_diario_ativo FROM configuracoes LIMIT 1');
        } catch (_) {}
        const backupAtivo = configRows.length > 0 && (configRows[0].backup_diario_ativo === 1 || configRows[0].backup_diario_ativo === '1');
        if (!backupAtivo) {
          await conn.end();
          continue;
        }
        const [emprestimos] = await conn.execute(`
          SELECT e.*, c.nome as cliente_nome, c.cpf_cnpj, c.telefone, c.email as cliente_email
          FROM emprestimos e
          LEFT JOIN clientes_cobrancas c ON e.cliente_id = c.id
          ORDER BY e.created_at DESC
        `);
        const [clientes] = await conn.execute('SELECT * FROM clientes_cobrancas ORDER BY nome ASC');
        await conn.end();
        const formatDate = (d) => d ? (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10)) : '-';
        const formatMoney = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);
        const dadosEmp = (emprestimos || []).map(e => ({
          'ID': e.id, 'Cliente': e.cliente_nome || '-', 'CPF/CNPJ': e.cpf_cnpj || '-', 'Telefone': e.telefone || '-',
          'Valor': formatMoney(e.valor), 'Juros (%)': Number(e.juros_mensal || 0), 'Data Empréstimo': formatDate(e.data_emprestimo),
          'Data Vencimento': formatDate(e.data_vencimento), 'Status': e.status || '-', 'Observações': (e.observacoes || '-').substring(0, 100)
        }));
        const dadosCli = (clientes || []).map(c => ({
          'ID': c.id, 'Nome': c.nome || '-', 'CPF/CNPJ': c.cpf_cnpj || '-', 'Email': c.email || '-', 'Telefone': c.telefone || '-',
          'Endereço': c.endereco || '-', 'Cidade': c.cidade || '-', 'Estado': c.estado || '-', 'Status': c.status || 'Ativo',
          'Data Cadastro': formatDate(c.created_at)
        }));
        const dataHora = new Date();
        const nomeEmp = `Backup_Emprestimos_${dataHora.getFullYear()}-${String(dataHora.getMonth() + 1).padStart(2, '0')}-${String(dataHora.getDate()).padStart(2, '0')}_${String(dataHora.getHours()).padStart(2, '0')}${String(dataHora.getMinutes()).padStart(2, '0')}.xlsx`;
        const nomeCli = `Backup_Carteira_Clientes_${dataHora.getFullYear()}-${String(dataHora.getMonth() + 1).padStart(2, '0')}-${String(dataHora.getDate()).padStart(2, '0')}_${String(dataHora.getHours()).padStart(2, '0')}${String(dataHora.getMinutes()).padStart(2, '0')}.xlsx`;
        const wbEmp = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wbEmp, XLSX.utils.json_to_sheet(dadosEmp), 'Empréstimos');
        const wbCli = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wbCli, XLSX.utils.json_to_sheet(dadosCli), 'Carteira de Clientes');
        const bufEmp = XLSX.write(wbEmp, { bookType: 'xlsx', type: 'buffer' });
        const bufCli = XLSX.write(wbCli, { bookType: 'xlsx', type: 'buffer' });
        const zip = new AdmZip();
        zip.addFile(nomeEmp, Buffer.from(bufEmp));
        zip.addFile(nomeCli, Buffer.from(bufCli));
        const zipBuf = zip.toBuffer();
        const dataHoraStr = dataHora.toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'medium' });
        const htmlBody = `
<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:sans-serif;padding:20px;">
<h2>Backup JP-Cobranças</h2>
<p>Olá, <strong>${username}</strong>!</p>
<p>Segue em anexo o backup diário automático (Empréstimos + Carteira de Clientes).</p>
<p><strong>Data:</strong> ${dataHoraStr}</p>
<p style="color:#666;font-size:12px;">Enviado automaticamente pelo sistema JP-Cobranças.</p>
</body></html>`;
        await transporter.sendMail({
          from: `"JP-Cobranças" <${smtpUser}>`,
          to: email,
          subject: `Backup diário JP-Cobranças — ${dataHoraStr}`,
          html: htmlBody,
          attachments: [{ filename: 'backup.zip', content: zipBuf }]
        });
        results.enviados++;
        results.ok.push(username);
      } catch (err) {
        results.erros.push({ username, erro: err.message || String(err) });
        console.error('Erro backup diário para', username, err);
      }
    }
    res.json({ success: true, ...results });
  } catch (err) {
    console.error('Erro geral backup diário:', err);
    res.status(500).json({ error: err.message, ...results });
  }
});

router.get('/configuracoes', ensureDatabase, async (req, res) => {
  try {
    const username = req.session.cobrancasUser;
    const connection = await createCobrancasConnection(username);
    
    // Verificar se a tabela existe e criar se não existir
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS configuracoes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        chave_pix VARCHAR(255) DEFAULT NULL,
        nome_banco_pix VARCHAR(255) DEFAULT NULL,
        msg_parcela TEXT DEFAULT NULL,
        msg_emprestimo_com_juros TEXT DEFAULT NULL,
        msg_emprestimo_sem_juros TEXT DEFAULT NULL,
        msg_parcelas_vencidas TEXT DEFAULT NULL,
        backup_diario_ativo TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    // Garantir coluna nome_banco_pix em bases mais antigas
    try { await connection.execute('ALTER TABLE configuracoes ADD COLUMN nome_banco_pix VARCHAR(255) DEFAULT NULL'); } catch (e) { if (e.code !== 'ER_DUP_FIELDNAME') throw e; }
    try { await connection.execute('ALTER TABLE configuracoes ADD COLUMN backup_diario_ativo TINYINT(1) DEFAULT 0'); } catch (e) { if (e.code !== 'ER_DUP_FIELDNAME') throw e; }
    
    const [rows] = await connection.execute('SELECT * FROM configuracoes LIMIT 1');
    
    // Se não existir configuração, criar uma padrão
    if (rows.length === 0) {
      await connection.execute(`
        INSERT INTO configuracoes (chave_pix, nome_banco_pix, msg_parcela, msg_emprestimo_com_juros, msg_emprestimo_sem_juros, msg_parcelas_vencidas) 
        VALUES (NULL, NULL, NULL, NULL, NULL, NULL)
      `);
      const [newRows] = await connection.execute('SELECT * FROM configuracoes LIMIT 1');
      await connection.end();
      return res.json(newRows[0]);
    }
    
    await connection.end();
    res.json(rows[0]);
  } catch (error) {
    console.error('Erro ao buscar configurações:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Salvar configurações do usuário
router.put('/configuracoes', ensureDatabase, async (req, res) => {
  try {
    const { chave_pix, nome_banco_pix, msg_parcela, msg_emprestimo_com_juros, msg_emprestimo_sem_juros, msg_parcelas_vencidas, backup_diario_ativo } = req.body;
    const username = req.session.cobrancasUser;
    const connection = await createCobrancasConnection(username);
    
    // Verificar se existe registro
    const [rows] = await connection.execute('SELECT id FROM configuracoes LIMIT 1');
    
    if (rows.length === 0) {
      await connection.execute(`
        INSERT INTO configuracoes (chave_pix, nome_banco_pix, msg_parcela, msg_emprestimo_com_juros, msg_emprestimo_sem_juros, msg_parcelas_vencidas, backup_diario_ativo) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [chave_pix || null, nome_banco_pix || null, msg_parcela || null, msg_emprestimo_com_juros || null, msg_emprestimo_sem_juros || null, msg_parcelas_vencidas || null, backup_diario_ativo ? 1 : 0]);
    } else {
      await connection.execute(`
        UPDATE configuracoes SET 
          chave_pix = ?, 
          nome_banco_pix = ?, 
          msg_parcela = ?, 
          msg_emprestimo_com_juros = ?, 
          msg_emprestimo_sem_juros = ?, 
          msg_parcelas_vencidas = ?,
          backup_diario_ativo = ?,
          updated_at = NOW()
        WHERE id = ?
      `, [chave_pix || null, nome_banco_pix || null, msg_parcela || null, msg_emprestimo_com_juros || null, msg_emprestimo_sem_juros || null, msg_parcelas_vencidas || null, backup_diario_ativo ? 1 : 0, rows[0].id]);
    }
    
    // Buscar configuração atualizada
    const [updated] = await connection.execute('SELECT * FROM configuracoes LIMIT 1');
    await connection.end();
    
    res.json(updated[0]);
  } catch (error) {
    console.error('Erro ao salvar configurações:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router; 