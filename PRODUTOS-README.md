# Gestão de Produtos - J.P Sistemas

## Visão Geral

O módulo de Gestão de Produtos permite gerenciar completamente o cadastro de produtos no sistema, incluindo criação, edição, exclusão e visualização de detalhes. Todos os dados são armazenados no banco de dados MySQL/MariaDB.

## Funcionalidades

### ✅ Funcionalidades Implementadas

- **Listagem de Produtos**: Visualização em tabela com todos os produtos cadastrados
- **Busca em Tempo Real**: Filtro por nome, código, categoria, etc.
- **Adicionar Produto**: Formulário completo para cadastro de novos produtos
- **Editar Produto**: Modificação de dados existentes
- **Excluir Produto**: Remoção com confirmação
- **Visualizar Detalhes**: Modal com informações completas do produto
- **Exportação**: PDF e Excel dos dados
- **Persistência**: Todos os dados salvos no banco de dados

### 📊 Campos do Produto

- **ID**: Identificador único (auto-incremento)
- **Nome**: Nome do produto (obrigatório)
- **Descrição**: Descrição detalhada
- **Preço de Custo**: Valor de aquisição
- **Preço de Venda**: Valor de venda
- **Categoria**: Categoria do produto
- **Código**: Código interno/SKU
- **Estoque**: Quantidade em estoque
- **Fornecedor**: Nome do fornecedor
- **Peso**: Peso do produto
- **Dimensões**: Dimensões (L x A x P)
- **Status**: Status do produto (Ativo/Inativo)
- **Data de Criação**: Timestamp automático
- **Data de Atualização**: Timestamp automático

## Configuração

### 1. Banco de Dados

A tabela `produtos` é criada automaticamente quando um usuário faz login pela primeira vez. A estrutura inclui:

```sql
CREATE TABLE produtos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  preco_custo DECIMAL(10,2),
  preco_venda DECIMAL(10,2),
  categoria VARCHAR(100),
  codigo VARCHAR(50),
  estoque INT DEFAULT 0,
  fornecedor VARCHAR(255),
  peso VARCHAR(50),
  dimensoes VARCHAR(100),
  status VARCHAR(50) DEFAULT 'Ativo',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### 2. Inicialização com Dados de Exemplo

Para adicionar produtos de exemplo ao banco:

```bash
npm run init-produtos
```

Este comando adicionará 5 produtos de exemplo:
- Notebook Dell Inspiron
- Mouse Wireless Logitech
- Teclado Mecânico RGB
- Monitor LG 24"
- SSD Samsung 500GB

### 3. API Endpoints

#### Listar Produtos
```
GET /api/produtos
```

#### Criar Produto
```
POST /api/produtos
Content-Type: application/json

{
  "nome": "Nome do Produto",
  "descricao": "Descrição do produto",
  "preco_custo": 100.00,
  "preco_venda": 150.00,
  "categoria": "Categoria",
  "codigo": "COD-001",
  "estoque": 10,
  "fornecedor": "Fornecedor",
  "peso": "1.5 kg",
  "dimensoes": "30 x 20 x 10 cm",
  "status": "Ativo"
}
```

#### Atualizar Produto
```
PUT /api/produtos/:id
Content-Type: application/json

{
  // Mesmos campos do POST
}
```

#### Excluir Produto
```
DELETE /api/produtos/:id
```

## Uso

### Acessando a Página

1. Faça login no sistema
2. Navegue para "Produtos" no menu principal
3. A página carregará automaticamente os produtos do banco

### Adicionando um Produto

1. Clique no botão "Novo Produto"
2. Preencha os campos desejados (apenas "Nome" é obrigatório)
3. Clique em "Adicionar"
4. O produto será salvo no banco e aparecerá na lista

### Editando um Produto

1. Clique no botão "Editar" na linha do produto
2. Modifique os campos desejados
3. Clique em "Salvar"
4. As alterações serão salvas no banco

### Excluindo um Produto

1. Clique no botão "Remover" na linha do produto
2. Confirme a exclusão
3. O produto será removido do banco

### Visualizando Detalhes

1. Clique no botão "Ver" na linha do produto
2. Um modal será aberto com todas as informações
3. Clique em "Fechar" para sair

### Buscando Produtos

1. Use o campo de busca no topo da página
2. Digite qualquer termo (nome, código, categoria, etc.)
3. A lista será filtrada em tempo real

### Exportando Dados

- **PDF**: Clique em "Exportar PDF" para baixar lista em PDF
- **Excel**: Clique em "Exportar Excel" para baixar lista em Excel

## Tecnologias Utilizadas

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Backend**: Node.js, Express.js
- **Banco de Dados**: MySQL/MariaDB
- **Bibliotecas**: jsPDF (PDF), SheetJS (Excel)

## Estrutura de Arquivos

```
├── public/
│   └── produtos.html          # Interface do usuário
├── server.js                  # Rotas da API
├── scripts/
│   └── init-produtos.js       # Script de inicialização
└── database-config.js         # Configuração do banco
```

## Segurança

- Todas as operações requerem autenticação
- Validação de dados no frontend e backend
- Proteção contra SQL Injection
- Sanitização de inputs

## Próximas Melhorias

- [ ] Upload de imagens dos produtos
- [ ] Categorias predefinidas
- [ ] Controle de estoque mínimo
- [ ] Histórico de alterações
- [ ] Relatórios avançados
- [ ] Integração com fornecedores
- [ ] Código de barras/QR Code

## Suporte

Para dúvidas ou problemas, entre em contato:
- WhatsApp: [Link do WhatsApp](https://whatsa.me/5548996852138/?t=Ol%C3%A1,%20gostaria%20de%20mais%20informa%C3%A7%C3%B5es%20sobre%20os%20sistemas.)
- Email: suporte@jpsistemas.com

---

**J.P Sistemas** - Soluções em Tecnologia 