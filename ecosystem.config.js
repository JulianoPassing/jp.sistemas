module.exports = {
  apps: [
    {
      name: 'jpsistemas',
      script: 'server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/jpsistemas-err.log',
      out_file: './logs/jpsistemas-out.log',
      log_file: './logs/jpsistemas-combined.log',
      time: true,
      // Configurações específicas para o sistema principal
      env_file: '.env'
    }
  ],

  // Configurações de deploy
  deploy: {
    production: {
      user: 'seu_usuario',
      host: 'seu_servidor',
      ref: 'origin/main',
      repo: 'https://github.com/seu-usuario/jp.sistemas.git',
      path: '/var/www/jpsistemas',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npm run init-cobrancas && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
}; 