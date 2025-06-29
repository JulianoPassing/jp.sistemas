#!/bin/bash

# Script de Backup - Sistema J.P Sistemas (MariaDB)
# Este script faz backup de todos os bancos de dados dos usuários

# Configurações
BACKUP_PATH="${BACKUP_PATH:-/var/backups/jpsistemas}"
DB_HOST="${DB_HOST:-localhost}"
DB_USER="${DB_USER:-jpsistemas}"
DB_PASSWORD="${DB_PASSWORD:-SuaSenhaForte123!}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
DATE=$(date +%Y%m%d_%H%M%S)
LOG_FILE="/var/log/jpsistemas/backup.log"

# Criar diretórios se não existirem
mkdir -p "$BACKUP_PATH"
mkdir -p "$(dirname "$LOG_FILE")"

# Função de log
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "Iniciando backup do sistema J.P Sistemas (MariaDB)"

# Backup do banco principal (usuários e sessões)
log "Fazendo backup dos bancos principais..."
mysqldump -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" \
    --single-transaction --routines --triggers \
    --default-character-set=utf8mb4 \
    jpsistemas_users > "$BACKUP_PATH/jpsistemas_users_$DATE.sql"

mysqldump -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" \
    --single-transaction --routines --triggers \
    --default-character-set=utf8mb4 \
    jpsistemas_sessions > "$BACKUP_PATH/jpsistemas_sessions_$DATE.sql"

# Listar todos os bancos de dados dos usuários
log "Buscando bancos de dados dos usuários..."
USER_DATABASES=$(mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" \
    -e "SHOW DATABASES LIKE 'jpsistemas_%';" -s -N | grep -v "jpsistemas_users\|jpsistemas_sessions")

# Backup de cada banco de dados de usuário
for db in $USER_DATABASES; do
    log "Fazendo backup do banco: $db"
    mysqldump -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" \
        --single-transaction --routines --triggers \
        --default-character-set=utf8mb4 \
        "$db" > "$BACKUP_PATH/${db}_$DATE.sql"
    
    if [ $? -eq 0 ]; then
        log "Backup do banco $db concluído com sucesso"
    else
        log "ERRO: Falha no backup do banco $db"
    fi
done

# Compactar backups
log "Compactando backups..."
cd "$BACKUP_PATH"
tar -czf "jpsistemas_backup_$DATE.tar.gz" *.sql
rm -f *.sql

# Remover backups antigos
log "Removendo backups antigos (mais de $RETENTION_DAYS dias)..."
find "$BACKUP_PATH" -name "jpsistemas_backup_*.tar.gz" -mtime +$RETENTION_DAYS -delete

# Verificar espaço em disco
DISK_USAGE=$(df -h "$BACKUP_PATH" | tail -1 | awk '{print $5}' | sed 's/%//')
log "Uso de disco no diretório de backup: ${DISK_USAGE}%"

# Verificar tamanho do backup
BACKUP_SIZE=$(du -h "jpsistemas_backup_$DATE.tar.gz" | cut -f1)
log "Tamanho do backup: $BACKUP_SIZE"

log "Backup concluído com sucesso!"
log "Arquivo: jpsistemas_backup_$DATE.tar.gz"
log "Localização: $BACKUP_PATH"

# Enviar notificação por email (se configurado)
if [ -n "$SMTP_USER" ] && [ -n "$SMTP_PASS" ]; then
    log "Enviando notificação por email..."
    echo "Backup do sistema J.P Sistemas (MariaDB) concluído em $(date)" | \
    mail -s "Backup J.P Sistemas - $DATE" "$SMTP_USER"
fi

exit 0 