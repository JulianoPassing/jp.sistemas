#!/bin/bash

# 🚀 Script de Deploy para Debian 12 + MariaDB + Vercel - J.P Sistemas
# Este script configura o ambiente Debian 12 para deploy no Vercel

set -e  # Para o script se houver erro

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Função para imprimir mensagens coloridas
print_message() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

print_success() {
    echo -e "${PURPLE}[SUCCESS]${NC} $1"
}

# Verificar se estamos no diretório correto
if [ ! -f "package.json" ]; then
    print_error "Este script deve ser executado no diretório raiz do projeto!"
    exit 1
fi

print_message "🚀 Configurando ambiente Debian 12 + MariaDB + Vercel..."

# Passo 1: Atualizar sistema
print_step "1. Atualizando sistema Debian..."
sudo apt update && sudo apt upgrade -y
print_success "✅ Sistema atualizado"

# Passo 2: Instalar dependências do sistema
print_step "2. Instalando dependências do sistema..."
sudo apt install -y curl wget git build-essential software-properties-common apt-transport-https ca-certificates gnupg lsb-release
print_success "✅ Dependências instaladas"

# Passo 3: Instalar Node.js 18+
print_step "3. Instalando Node.js 18+..."
if ! command -v node &> /dev/null; then
    print_message "Instalando Node.js via NodeSource..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_warning "Node.js versão antiga detectada. Atualizando..."
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
fi

print_success "✅ Node.js $(node -v) instalado"

# Passo 4: Instalar MariaDB
print_step "4. Instalando MariaDB..."
if ! command -v mysql &> /dev/null; then
    print_message "Instalando MariaDB..."
    sudo apt install -y mariadb-server mariadb-client
    sudo systemctl enable mariadb
    sudo systemctl start mariadb
    
    # Configurar MariaDB
    print_message "Configurando MariaDB..."
    sudo mysql_secure_installation
else
    print_message "MariaDB já está instalado"
fi

print_success "✅ MariaDB instalado e configurado"

# Passo 5: Configurar MariaDB para o projeto
print_step "5. Configurando MariaDB para J.P Sistemas..."
print_message "Criando usuário e bancos de dados..."

# Criar usuário e bancos
sudo mysql -e "
CREATE DATABASE IF NOT EXISTS jpsistemas_users CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS jpsistemas_sessions CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'jpsistemas'@'localhost' IDENTIFIED BY 'SuaSenhaForte123!';
GRANT ALL PRIVILEGES ON jpsistemas_users.* TO 'jpsistemas'@'localhost';
GRANT ALL PRIVILEGES ON jpsistemas_sessions.* TO 'jpsistemas'@'localhost';
GRANT CREATE ON *.* TO 'jpsistemas'@'localhost';
FLUSH PRIVILEGES;
"

print_success "✅ Bancos de dados e usuário criados"

# Passo 6: Configurar arquivo .env
print_step "6. Configurando variáveis de ambiente..."
if [ ! -f ".env" ]; then
    print_message "Criando arquivo .env..."
    cp env.example .env
    
    # Configurar para MariaDB local
    sed -i 's/DATABASE_PROVIDER=.*/DATABASE_PROVIDER=local/' .env
    sed -i 's/DB_HOST=.*/DB_HOST=localhost/' .env
    sed -i 's/DB_USER=.*/DB_USER=jpsistemas/' .env
    sed -i 's/DB_PASSWORD=.*/DB_PASSWORD=SuaSenhaForte123!/' .env
    sed -i 's/DB_PORT=.*/DB_PORT=3306/' .env
    
    print_warning "⚠️  IMPORTANTE: Verifique e ajuste as configurações no arquivo .env"
else
    print_message "Arquivo .env já existe"
fi

# Passo 7: Instalar dependências do projeto
print_step "7. Instalando dependências do projeto..."
npm install
print_success "✅ Dependências instaladas"

# Passo 8: Instalar Vercel CLI
print_step "8. Instalando Vercel CLI..."
if ! command -v vercel &> /dev/null; then
    sudo npm install -g vercel
fi
print_success "✅ Vercel CLI instalado"

# Passo 9: Inicializar banco de dados
print_step "9. Inicializando banco de dados..."
npm run init-vercel
print_success "✅ Banco de dados inicializado"

# Passo 10: Configurar firewall (opcional)
print_step "10. Configurando firewall..."
if command -v ufw &> /dev/null; then
    print_message "Configurando UFW..."
    sudo ufw allow ssh
    sudo ufw allow 3000
    sudo ufw --force enable
    print_success "✅ Firewall configurado"
else
    print_warning "UFW não encontrado, pulando configuração de firewall"
fi

# Passo 11: Configurar serviço systemd (opcional)
print_step "11. Configurando serviço systemd..."
if [ ! -f "/etc/systemd/system/jpsistemas.service" ]; then
    print_message "Criando serviço systemd..."
    sudo tee /etc/systemd/system/jpsistemas.service > /dev/null <<EOF
[Unit]
Description=J.P Sistemas
After=network.target mariadb.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
Environment=NODE_ENV=production
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    sudo systemctl daemon-reload
    sudo systemctl enable jpsistemas
    print_success "✅ Serviço systemd criado"
else
    print_message "Serviço systemd já existe"
fi

# Passo 12: Deploy no Vercel
print_step "12. Preparando deploy no Vercel..."
print_message "Para fazer deploy no Vercel, execute:"
echo
print_message "1. Faça login no Vercel:"
echo "   vercel login"
echo
print_message "2. Configure as variáveis de ambiente no Vercel:"
echo "   DATABASE_PROVIDER=local"
echo "   DB_HOST=localhost"
echo "   DB_USER=jpsistemas"
echo "   DB_PASSWORD=SuaSenhaForte123!"
echo "   DB_PORT=3306"
echo "   NODE_ENV=production"
echo "   JWT_SECRET=SeuJWTSecretMuitoForte123!"
echo "   SESSION_SECRET=SeuSessionSecretMuitoForte123!"
echo
print_message "3. Faça o deploy:"
echo "   vercel"
echo "   vercel --prod"
echo

# Informações finais
print_step "13. Configuração concluída!"
print_success "🎉 Ambiente Debian 12 + MariaDB configurado com sucesso!"

echo
print_message "📋 Informações importantes:"
echo "   • MariaDB rodando em: localhost:3306"
echo "   • Usuário MariaDB: jpsistemas"
echo "   • Senha MariaDB: SuaSenhaForte123!"
echo "   • Banco de usuários: jpsistemas_users"
echo "   • Banco de sessões: jpsistemas_sessions"
echo
print_message "🔑 Credenciais de acesso:"
echo "   • Usuário admin: admin"
echo "   • Senha admin: admin123"
echo
print_warning "⚠️  IMPORTANTE:"
echo "   • Altere a senha do administrador após o primeiro login!"
echo "   • Altere a senha do MariaDB em produção!"
echo "   • Configure backup automático do MariaDB!"
echo
print_message "📊 Comandos úteis:"
echo "   • Iniciar serviço: sudo systemctl start jpsistemas"
echo "   • Parar serviço: sudo systemctl stop jpsistemas"
echo "   • Ver logs: sudo journalctl -u jpsistemas -f"
echo "   • Backup MariaDB: mysqldump -u jpsistemas -p jpsistemas_users > backup_users.sql"
echo
print_message "🆘 Para suporte:"
echo "   • WhatsApp: https://whatsa.me/5548996852138"
echo "   • Email: suporte@jpsistemas.com"
echo
print_message "📚 Documentação:"
echo "   • Guia completo: DEPLOY-VERCEL.md"
echo "   • README: README-VERCEL.md"

print_success "✅ Configuração finalizada!" 