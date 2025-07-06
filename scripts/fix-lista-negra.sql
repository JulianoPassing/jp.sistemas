-- Script SQL para corrigir problema da lista negra
-- Execute este script no MySQL da VPS

USE jpsistemas_cobrancas;

-- Verificar se o campo observacoes já existe
SELECT COLUMN_NAME 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'jpsistemas_cobrancas' 
AND TABLE_NAME = 'clientes_cobrancas' 
AND COLUMN_NAME = 'observacoes';

-- Adicionar campo observacoes se não existir
ALTER TABLE clientes_cobrancas 
ADD COLUMN IF NOT EXISTS observacoes TEXT AFTER status;

-- Verificar estrutura da tabela
DESCRIBE clientes_cobrancas;

-- Testar atualização de um cliente para lista negra
-- (substitua 1 pelo ID de um cliente real)
UPDATE clientes_cobrancas 
SET 
  status = 'Lista Negra',
  observacoes = 'Teste de correção da lista negra',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 1;

-- Verificar se foi atualizado
SELECT id, nome, status, observacoes 
FROM clientes_cobrancas 
WHERE id = 1;

-- Reverter o teste
UPDATE clientes_cobrancas 
SET 
  status = 'Ativo',
  observacoes = '',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 1;

-- Verificar estrutura final
SELECT 'Campo observacoes adicionado com sucesso!' as resultado; 