let pedidos = [];
let nextId = 1;

export default function handler(req, res) {
  if (req.method === 'GET') {
    res.status(200).json(pedidos);
  } else if (req.method === 'POST') {
    const pedido = {
      id: nextId++,
      ...req.body,
    };
    pedidos.push(pedido);
    res.status(201).json(pedido);
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