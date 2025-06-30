let pedidos = [];
let nextId = 1;

export default function handler(req, res) {
  if (req.method === 'GET') {
    res.status(200).json(pedidos);
  } else if (req.method === 'POST') {
    try {
      let data = req.body;
      if (typeof data === 'string') {
        data = JSON.parse(data);
      }
      if (!data || typeof data !== 'object') {
        throw new Error('Body inválido ou ausente');
      }
      return res.status(200).json({ debug: true, body: data });
    } catch (error) {
      res.status(400).json({ error: 'Erro ao processar pedido', details: error.message });
    }
  } else if (req.method === 'PUT') {
    const { id } = req.query;
    const idx = pedidos.findIndex(p => String(p.id) === String(id));
    if (idx === -1) return res.status(404).json({ error: 'Pedido não encontrado' });
    pedidos[idx] = { ...pedidos[idx], ...req.body };
    res.status(200).json(pedidos[idx]);
  } else {
    res.setHeader('Allow', ['GET', 'POST', 'PUT']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 