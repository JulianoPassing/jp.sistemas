let pedidos = [];
let nextId = 1;

export default function handler(req, res) {
  res.status(200).json({ debug: true, msg: "Endpoint funcionando!" });
} 