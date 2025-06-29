#!/bin/bash

# 💾 Script de Backup para Debian + MariaDB - J.P Sistemas
# Este script faz backup automático de todos os bancos de dados

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

# Configurações
BACKUP_DIR="/var/backups/jpsistemas"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7
DB_USER="jpsistemas"
DB_PASSWORD="SuaSenhaForte123!"
DB_HOST="localhost"
DB_PORT="3306"

# Verificar se o diretório de backup existe
if [ ! -d "$BACKUP_DIR" ]; then
    print_message "Criando diretório de backup: $BACKUP_DIR"
    sudo mkdir -p "$BACKUP_DIR"
    sudo chown $USER:$USER "$BACKUP_DIR"
fi

print_message "🚀 Iniciando backup do J.P Sistemas..."

# Passo 1: Verificar conexão com MariaDB
print_step "1. Verificando conexão com MariaDB..."
if ! mysql -u "$DB_USER" -p"$DB_PASSWORD" -h "$DB_HOST" -P "$DB_PORT" -e "SELECT 1;" > /dev/null 2>&1; then
    print_error "Erro ao conectar com MariaDB!"
    print_message "Verifique as credenciais e se o MariaDB está rodando."
    exit 1
fi
print_message "✅ Conexão com MariaDB estabelecida"

# Passo 2: Backup dos bancos principais
print_step "2. Fazendo backup dos bancos principais..."

# Backup do banco de usuários
print_message "Backup do banco jpsistemas_users..."
mysqldump -u "$DB_USER" -p"$DB_PASSWORD" -h "$DB_HOST" -P "$DB_PORT" \
    --single-transaction --routines --triggers \
    jpsistemas_users > "$BACKUP_DIR/users_$DATE.sql"

# Backup do banco de sessões
print_message "Backup do banco jpsistemas_sessions..."
mysqldump -u "$DB_USER" -p"$DB_PASSWORD" -h "$DB_HOST" -P "$DB_PORT" \
    --single-transaction --routines --triggers \
    jpsistemas_sessions > "$BACKUP_DIR/sessions_$DATE.sql"

print_message "✅ Bancos principais backupados"

# Passo 3: Backup dos bancos de usuários
print_step "3. Fazendo backup dos bancos de usuários..."

# Listar todos os bancos que começam com jpsistemas_
USER_DBS=$(mysql -u "$DB_USER" -p"$DB_PASSWORD" -h "$DB_HOST" -P "$DB_PORT" \
    -e "SHOW DATABASES LIKE 'jpsistemas_%';" | grep -v Database)

if [ -n "$USER_DBS" ]; then
    print_message "Encontrados $(echo "$USER_DBS" | wc -l) bancos de usuários"
    
    for db in $USER_DBS; do
        if [ "$db" != "jpsistemas_users" ] && [ "$db" != "jpsistemas_sessions" ]; then
            print_message "Backup do banco $db..."
            mysqldump -u "$DB_USER" -p"$DB_PASSWORD" -h "$DB_HOST" -P "$DB_PORT" \
                --single-transaction --routines --triggers \
                "$db" > "$BACKUP_DIR/${db}_$DATE.sql"
        fi
    done
else
    print_warning "Nenhum banco de usuário encontrado"
fi

print_message "✅ Bancos de usuários backupados"

# Passo 4: Backup da estrutura do projeto
print_step "4. Fazendo backup da estrutura do projeto..."
PROJECT_BACKUP="$BACKUP_DIR/project_$DATE.tar.gz"

# Lista de arquivos/diretórios importantes para backup
tar -czf "$PROJECT_BACKUP" \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='*.log' \
    --exclude='.env' \
    --exclude='backups' \
    .

print_message "✅ Estrutura do projeto backupada"

# Passo 5: Criar arquivo de metadados
print_step "5. Criando metadados do backup..."
METADATA_FILE="$BACKUP_DIR/metadata_$DATE.json"

cat > "$METADATA_FILE" << EOF
{
  "backup_date": "$(date -Iseconds)",
  "backup_type": "full",
  "system": {
    "os": "$(lsb_release -d | cut -f2)",
    "kernel": "$(uname -r)",
    "architecture": "$(uname -m)"
  },
  "database": {
    "host": "$DB_HOST",
    "port": "$DB_PORT",
    "user": "$DB_USER",
    "version": "$(mysql -u "$DB_USER" -p"$DB_PASSWORD" -h "$DB_HOST" -P "$DB_PORT" -e "SELECT VERSION();" | tail -n 1)"
  },
  "files": {
    "users_db": "users_$DATE.sql",
    "sessions_db": "sessions_$DATE.sql",
    "project": "project_$DATE.tar.gz",
    "user_dbs_count": $(echo "$USER_DBS" | grep -v "jpsistemas_users\|jpsistemas_sessions" | wc -l)
  },
  "size": {
    "users_db": "$(du -h "$BACKUP_DIR/users_$DATE.sql" | cut -f1)",
    "sessions_db": "$(du -h "$BACKUP_DIR/sessions_$DATE.sql" | cut -f1)",
    "project": "$(du -h "$PROJECT_BACKUP" | cut -f1)",
    "total": "$(du -sh "$BACKUP_DIR" | cut -f1)"
  }
}
EOF

print_message "✅ Metadados criados"

# Passo 6: Compactar todos os arquivos
print_step "6. Compactando arquivos de backup..."
FINAL_BACKUP="$BACKUP_DIR/backup_$DATE.tar.gz"

# Compactar todos os arquivos SQL e metadados
tar -czf "$FINAL_BACKUP" \
    -C "$BACKUP_DIR" \
    "users_$DATE.sql" \
    "sessions_$DATE.sql" \
    "project_$DATE.tar.gz" \
    "metadata_$DATE.json"

# Adicionar bancos de usuários se existirem
for db in $USER_DBS; do
    if [ "$db" != "jpsistemas_users" ] && [ "$db" != "jpsistemas_sessions" ]; then
        tar -rf "$FINAL_BACKUP" -C "$BACKUP_DIR" "${db}_$DATE.sql"
    fi
done

print_message "✅ Backup compactado: $FINAL_BACKUP"

# Passo 7: Limpar arquivos temporários
print_step "7. Limpando arquivos temporários..."
rm -f "$BACKUP_DIR"/*.sql
rm -f "$BACKUP_DIR/project_$DATE.tar.gz"
rm -f "$BACKUP_DIR/metadata_$DATE.json"

print_message "✅ Arquivos temporários removidos"

# Passo 8: Limpar backups antigos
print_step "8. Limpando backups antigos..."
find "$BACKUP_DIR" -name "backup_*.tar.gz" -mtime +$RETENTION_DAYS -delete
print_message "✅ Backups mais antigos que $RETENTION_DAYS dias removidos"

# Passo 9: Verificar integridade
print_step "9. Verificando integridade do backup..."
if tar -tzf "$FINAL_BACKUP" > /dev/null 2>&1; then
    print_message "✅ Backup verificado com sucesso"
else
    print_error "❌ Erro na verificação do backup!"
    exit 1
fi

# Informações finais
print_step "10. Backup concluído!"
print_message "🎉 Backup realizado com sucesso!"

echo
print_message "📋 Informações do backup:"
echo "   • Arquivo: $FINAL_BACKUP"
echo "   • Tamanho: $(du -h "$FINAL_BACKUP" | cut -f1)"
echo "   • Data: $(date)"
echo "   • Bancos de usuários: $(echo "$USER_DBS" | grep -v "jpsistemas_users\|jpsistemas_sessions" | wc -l)"
echo
print_message "📊 Estatísticas:"
echo "   • Total de backups: $(ls -1 "$BACKUP_DIR"/backup_*.tar.gz 2>/dev/null | wc -l)"
echo "   • Espaço usado: $(du -sh "$BACKUP_DIR" | cut -f1)"
echo "   • Próxima limpeza: em $RETENTION_DAYS dias"
echo
print_message "🔄 Para restaurar:"
echo "   • Extrair: tar -xzf $FINAL_BACKUP"
echo "   • Restaurar: mysql -u $DB_USER -p < users_$DATE.sql"
echo
print_message "✅ Backup finalizado com sucesso!"

# Retornar caminho do backup para uso em scripts
echo "$FINAL_BACKUP" 