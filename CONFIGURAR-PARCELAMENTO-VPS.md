# Configuração do Sistema de Parcelamento no VPS

## Problema Identificado

O erro `Access denied for user 'jpsistemas'@'localhost'` indica que as credenciais do banco de dados não estão configuradas corretamente no VPS.

## Solução

Execute os seguintes comandos no VPS para configurar o sistema de parcelamento:

### 1. Configuração Automática (Recomendado)

```bash
# Tornar o script executável
chmod +x scripts/setup-parcelamento-vps.sh

# Executar configuração completa
./scripts/setup-parcelamento-vps.sh
```

### 2. Configuração Manual (Se a automática falhar)

#### Passo 1: Configurar variáveis de ambiente
```bash
node scripts/setup-env-vps.js
```

#### Passo 2: Verificar MySQL
```bash
# Verificar se o MySQL está rodando
sudo systemctl status mysql

# Se não estiver rodando, iniciar
sudo systemctl start mysql
```

#### Passo 3: Verificar usuário do banco
```bash
# Conectar como root
mysql -u root -p

# No MySQL, verificar se o usuário existe
SELECT User FROM mysql.user WHERE User='jpsistemas';

# Se não existir, criar
CREATE USER 'jpsistemas'@'localhost' IDENTIFIED BY 'Juliano@95';
GRANT ALL PRIVILEGES ON *.* TO 'jpsistemas'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

#### Passo 4: Atualizar estrutura do banco
```bash
node scripts/update-emprestimos-parcelamento.js
```

## Verificação

Após a configuração, verifique se tudo está funcionando:

### 1. Testar conexão com banco
```bash
node scripts/test-parcelamento.js
```

### 2. Verificar arquivo .env
```bash
cat .env | grep DB_
```

Deve mostrar algo como:
```
DATABASE_PROVIDER=local
DB_HOST=localhost
DB_USER=jpcobrancas
DB_PASSWORD=Juliano@95
DB_PORT=3306
```

### 3. Verificar estrutura das tabelas
```bash
mysql -u jpcobrancas -p -e "USE jpcobrancas_<username>; DESCRIBE emprestimos;"
```

Deve mostrar os novos campos:
- `tipo_emprestimo`
- `numero_parcelas`
- `frequencia`
- `valor_parcela`

## Troubleshooting

### Erro: "Access denied for user 'jpsistemas'@'localhost'"

**Causa**: Usuário não existe ou senha incorreta

**Solução**:
```bash
# Conectar como root
mysql -u root -p

# Criar usuário
CREATE USER 'jpcobrancas'@'localhost' IDENTIFIED BY 'Juliano@95';
GRANT ALL PRIVILEGES ON *.* TO 'jpcobrancas'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### Erro: "Can't connect to MySQL server"

**Causa**: MySQL não está rodando

**Solução**:
```bash
sudo systemctl start mysql
sudo systemctl enable mysql
```

### Erro: "Permission denied"

**Causa**: Scripts não têm permissão de execução

**Solução**:
```bash
chmod +x scripts/*.sh
chmod +x scripts/*.js
```

## Estrutura Criada

Após a configuração, o sistema terá:

### Tabela `emprestimos` (Atualizada)
- `tipo_emprestimo` - ENUM('fixed', 'in_installments')
- `numero_parcelas` - INT
- `frequencia` - ENUM('daily', 'weekly', 'biweekly', 'monthly')
- `valor_parcela` - DECIMAL(10,2)

### Nova Tabela `parcelas`
- `id` - Chave primária
- `emprestimo_id` - Referência ao empréstimo
- `numero_parcela` - Número da parcela
- `valor_parcela` - Valor da parcela
- `data_vencimento` - Data de vencimento
- `status` - ENUM('Pendente', 'Paga', 'Atrasada')
- `valor_pago` - Valor pago
- `data_pagamento` - Data do pagamento
- `juros_aplicados` - Juros aplicados
- `multa_aplicada` - Multa aplicada

## Próximos Passos

1. **Reiniciar o servidor**:
   ```bash
   pm2 restart all
   ```

2. **Testar a funcionalidade**:
   - Acesse o sistema
   - Crie um empréstimo parcelado
   - Verifique se as parcelas são criadas corretamente

3. **Verificar logs**:
   ```bash
   pm2 logs
   ```

## Suporte

Se encontrar problemas, verifique:

1. **Logs do sistema**:
   ```bash
   pm2 logs --lines 50
   ```

2. **Status do MySQL**:
   ```bash
   sudo systemctl status mysql
   ```

3. **Conexão com banco**:
   ```bash
   mysql -u jpsistemas -p -e "SHOW DATABASES;"
   ```

4. **Arquivo .env**:
   ```bash
   cat .env
   ```

5. **Conexão com banco**:
   ```bash
   mysql -u jpcobrancas -p -e "SHOW DATABASES;"
   ``` 