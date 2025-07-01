/**
 * Configurações de Banco de Dados para Multi-Tenancy
 * Suporte para diferentes provedores compatíveis com Vercel
 */

const databaseConfigs = {
  // PlanetScale (Recomendado para Vercel)
  planetscale: {
    host: process.env.PLANETSCALE_HOST || 'aws.connect.psdb.cloud',
    user: process.env.PLANETSCALE_USERNAME,
    password: process.env.PLANETSCALE_PASSWORD,
    ssl: {
      rejectUnauthorized: true
    },
    charset: 'utf8mb4'
  },

  // Railway
  railway: {
    host: process.env.RAILWAY_HOST,
    user: process.env.RAILWAY_USERNAME,
    password: process.env.RAILWAY_PASSWORD,
    port: process.env.RAILWAY_PORT || 3306,
    charset: 'utf8mb4'
  },

  // Neon (PostgreSQL - requer adaptação)
  neon: {
    host: process.env.NEON_HOST,
    user: process.env.NEON_USERNAME,
    password: process.env.NEON_PASSWORD,
    port: process.env.NEON_PORT || 5432,
    ssl: true,
    charset: 'utf8mb4'
  },

  // Supabase (PostgreSQL - requer adaptação)
  supabase: {
    host: process.env.SUPABASE_HOST,
    user: process.env.SUPABASE_USERNAME,
    password: process.env.SUPABASE_PASSWORD,
    port: process.env.SUPABASE_PORT || 5432,
    ssl: true,
    charset: 'utf8mb4'
  },

  // Clever Cloud
  clevercloud: {
    host: process.env.CLEVERCLOUD_HOST,
    user: process.env.CLEVERCLOUD_USERNAME,
    password: process.env.CLEVERCLOUD_PASSWORD,
    port: process.env.CLEVERCLOUD_PORT || 3306,
    charset: 'utf8mb4'
  },

  // Local/Desenvolvimento
  local: () => ({
    host: process.env.DB_HOST ?? 'localhost',
    user: process.env.DB_USER ?? 'jpsistemas',
    password: process.env.DB_PASSWORD ?? 'SuaSenhaForte123!',
    port: process.env.DB_PORT ?? 3306,
    charset: 'utf8mb4'
  }),
};

// Determinar qual configuração usar
function getDatabaseConfig() {
  const provider = process.env.DATABASE_PROVIDER || 'local';
  console.log('getDatabaseConfig provider:', provider);
  let config = databaseConfigs[provider];
  if (typeof config === 'function') {
    config = config();
  }
  console.log('databaseConfigs[provider]:', config);
  console.log('Bloco local:', {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    charset: 'utf8mb4'
  });
  if (config) {
    return {
      ...config,
      provider
    };
  }
  console.warn(`Provedor ${provider} não encontrado, usando configuração local`);
  const fallback = typeof databaseConfigs.local === 'function' ? databaseConfigs.local() : databaseConfigs.local;
  return {
    ...fallback,
    provider: 'local'
  };
}

// Configuração para sessões
function getSessionConfig() {
  const config = getDatabaseConfig();
  
  return {
    host: config.host,
    port: config.port || 3306,
    user: config.user,
    password: config.password,
    database: 'jpsistemas_sessions',
    ssl: config.ssl,
    charset: config.charset
  };
}

// Configuração para banco de usuários
function getUsersConfig() {
  const config = getDatabaseConfig();
  console.log('getUsersConfig:', {
    host: config.host,
    user: config.user,
    password: config.password,
    database: process.env.DB_USERS_DATABASE || 'jpsistemas_users'
  });
  return {
    host: config.host,
    port: config.port || 3306,
    user: config.user,
    password: config.password,
    database: process.env.DB_USERS_DATABASE || 'jpsistemas_users',
    ssl: config.ssl,
    charset: config.charset
  };
}

// Configuração para banco específico do usuário
function getUserDatabaseConfig(username) {
  const config = getDatabaseConfig();
  const dbName = `jpsistemas_${username.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  
  return {
    host: config.host,
    port: config.port || 3306,
    user: config.user,
    password: config.password,
    database: dbName,
    ssl: config.ssl,
    charset: config.charset
  };
}

// Configuração para conexão root (criação de bancos)
function getRootConfig() {
  const config = getDatabaseConfig();
  
  return {
    host: config.host,
    port: config.port || 3306,
    user: config.user,
    password: config.password,
    ssl: config.ssl,
    charset: config.charset
  };
}

module.exports = {
  getDatabaseConfig,
  getSessionConfig,
  getUsersConfig,
  getUserDatabaseConfig,
  getRootConfig,
  databaseConfigs
}; 