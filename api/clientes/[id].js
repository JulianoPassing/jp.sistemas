const mysql = require('mysql2/promise');

module.exports = async (req, res) => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'julianopassing',
    password: process.env.DB_PASSWORD || 'Juliano@95',
    database: process.env.DB_NAME || 'sistemajuliano'
  });

  try {
    const { id } = req.query;

    if (req.method === 'DELETE') {
      if (!id || isNaN(Number(id))) {
        res.status(400).json({ error: 'ID inválido para exclusão.' });
        return;
      }
      await connection.execute('DELETE FROM clientes WHERE id = ?', [id]);
      res.status(200).json({ message: 'Cliente removido com sucesso!' });
      return;
    }

    if (req.method === 'GET') {
      const [rows] = await connection.execute('SELECT * FROM clientes WHERE id = ?', [id]);
      if (rows.length === 0) {
        res.status(404).json({ error: 'Cliente não encontrado.' });
        return;
      }
      res.status(200).json(rows[0]);
      return;
    }

    if (req.method === 'PUT') {
      if (!id || isNaN(Number(id))) {
        res.status(400).json({ error: 'ID inválido para atualização.' });
        return;
      }
      
      const { nome, cpf_cnpj, telefone, email, endereco, cidade, estado, cep } = req.body;
      
      if (!nome) {
        res.status(400).json({ error: 'Nome é obrigatório.' });
        return;
      }
      
      // Verificar se o cliente existe
      const [existing] = await connection.execute('SELECT * FROM clientes WHERE id = ?', [id]);
      if (existing.length === 0) {
        res.status(404).json({ error: 'Cliente não encontrado.' });
        return;
      }
      
      // Atualizar cliente
      await connection.execute(
        `UPDATE clientes SET 
          nome = ?, 
          cpf_cnpj = ?, 
          telefone = ?, 
          email = ?, 
          endereco = ?, 
          cidade = ?, 
          estado = ?, 
          cep = ?,
          updated_at = NOW()
        WHERE id = ?`,
        [nome, cpf_cnpj || null, telefone || null, email || null, endereco || null, cidade || null, estado || null, cep || null, id]
      );
      
      // Buscar cliente atualizado
      const [updated] = await connection.execute('SELECT * FROM clientes WHERE id = ?', [id]);
      res.status(200).json(updated[0]);
      return;
    }

    res.status(405).json({ error: 'Método não permitido.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await connection.end();
  }
}; 