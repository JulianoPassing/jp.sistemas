const mysql = require('mysql2/promise');
const url = require('url');

module.exports = async (req, res) => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'julianopassing',
    password: process.env.DB_PASSWORD || 'Juliano@95',
    database: process.env.DB_NAME || 'sistemajuliano'
  });

  try {
    if (req.method === 'POST') {
      const {
        razao, cnpj, ie, endereco, bairro, cidade, estado, cep,
        email, telefone, transporte, prazo, obs
      } = req.body;

      // Validação do nome do cliente
      const nomeInvalido = !razao || typeof razao !== 'string' || ['undefined', 'n/a', 'na'].includes(razao.trim().toLowerCase()) || razao.trim() === '';
      if (nomeInvalido) {
        res.status(400).json({ error: 'Nome do cliente inválido. Não é permitido cadastrar clientes sem nome ou com nome "undefined" ou "N/A".' });
        return;
      }

      // Função utilitária para converter undefined para null
      function safeValue(value) {
        return value === undefined ? null : value;
      }

      function safeValues(values) {
        return values.map(value => safeValue(value));
      }

      const [result] = await connection.execute(
        `INSERT INTO clientes (razao, cnpj, ie, endereco, bairro, cidade, estado, cep, email, telefone, transporte, prazo, obs)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        safeValues([razao, cnpj, ie, endereco, bairro, cidade, estado, cep, email, telefone, transporte, prazo, obs])
      );
      res.status(201).json({ id: result.insertId, message: 'Cliente cadastrado com sucesso!' });
      return;
    }

    if (req.method === 'DELETE') {
      // Pega o id da URL: /api/clientes/:id
      const parsedUrl = url.parse(req.url, true);
      const id = parsedUrl.pathname.split('/').pop();
      if (!id || isNaN(Number(id))) {
        res.status(400).json({ error: 'ID inválido para exclusão.' });
        return;
      }
      await connection.execute('DELETE FROM clientes WHERE id = ?', [id]);
      res.status(200).json({ message: 'Cliente removido com sucesso!' });
      return;
    }

    // GET - listar todos os clientes
    const [rows] = await connection.execute('SELECT * FROM clientes');
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await connection.end();
  }
}; 