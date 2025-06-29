#!/bin/bash

# 🚀 Script de Deploy Automatizado para Vercel - J.P Sistemas
# Este script automatiza o processo de deploy no Vercel

set -e  # Para o script se houver erro

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

# Verificar se estamos no diretório correto
if [ ! -f "package.json" ]; then
    print_error "Este script deve ser executado no diretório raiz do projeto!"
    exit 1
fi

print_message "🚀 Iniciando deploy do J.P Sistemas no Vercel..."

# Passo 1: Verificar dependências
print_step "1. Verificando dependências..."
if ! command -v node &> /dev/null; then
    print_error "Node.js não está instalado!"
    print_message "Instale o Node.js 18+ em: https://nodejs.org"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    print_error "npm não está instalado!"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js 18+ é necessário! Versão atual: $(node -v)"
    exit 1
fi

print_message "✅ Node.js $(node -v) detectado"

# Passo 2: Verificar arquivo .env
print_step "2. Verificando configuração..."
if [ ! -f ".env" ]; then
    print_warning "Arquivo .env não encontrado!"
    print_message "Copiando env.example para .env..."
    cp env.example .env
    print_warning "⚠️  IMPORTANTE: Configure as variáveis no arquivo .env antes de continuar!"
    print_message "Especialmente as variáveis do banco de dados (DATABASE_PROVIDER, etc.)"
    read -p "Pressione Enter após configurar o .env..."
fi

# Passo 3: Instalar dependências
print_step "3. Instalando dependências..."
npm install
print_message "✅ Dependências instaladas"

# Passo 4: Verificar Vercel CLI
print_step "4. Verificando Vercel CLI..."
if ! command -v vercel &> /dev/null; then
    print_message "Instalando Vercel CLI..."
    npm install -g vercel
fi

print_message "✅ Vercel CLI instalado"

# Passo 5: Verificar login no Vercel
print_step "5. Verificando login no Vercel..."
if ! vercel whoami &> /dev/null; then
    print_message "Faça login no Vercel..."
    vercel login
fi

print_message "✅ Login no Vercel verificado"

# Passo 6: Build do projeto
print_step "6. Fazendo build do projeto..."
npm run build
print_message "✅ Build concluído"

# Passo 7: Deploy no Vercel
print_step "7. Fazendo deploy no Vercel..."
print_message "Iniciando deploy..."

# Deploy para preview
print_message "Deploy para preview..."
vercel

# Perguntar se quer fazer deploy para produção
read -p "Deseja fazer deploy para produção? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_message "Deploy para produção..."
    vercel --prod
    print_message "✅ Deploy para produção concluído!"
else
    print_warning "Deploy para produção não realizado"
fi

# Passo 8: Inicializar banco de dados
print_step "8. Inicializando banco de dados..."
print_message "Executando script de inicialização..."
npm run init-vercel

print_message "✅ Banco de dados inicializado"

# Passo 9: Informações finais
print_step "9. Deploy concluído!"
print_message "🎉 Seu sistema foi deployado com sucesso!"

echo
print_message "📋 Informações importantes:"
echo "   • URL do projeto: $(vercel ls | grep jpsistemas | awk '{print $2}')"
echo "   • Usuário admin: admin"
echo "   • Senha admin: admin123"
echo
print_warning "⚠️  IMPORTANTE: Altere a senha do administrador após o primeiro login!"
echo
print_message "📊 Para monitorar:"
echo "   • Acesse o painel do Vercel"
echo "   • Vá em Functions > server.js para ver logs"
echo "   • Configure domínio personalizado se necessário"
echo
print_message "🆘 Para suporte:"
echo "   • WhatsApp: https://whatsa.me/5548996852138"
echo "   • Email: suporte@jpsistemas.com"
echo
print_message "📚 Documentação:"
echo "   • Guia completo: DEPLOY-VERCEL.md"
echo "   • README: README-VERCEL.md"

print_message "✅ Deploy finalizado com sucesso!" 