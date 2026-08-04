# Schema de dados

O schema real do banco está em `schema.sql` (uma tabela `stores`, com uma
coluna `data JSONB` guardando o "miolo" de cada loja). Este arquivo só
documenta o formato desse JSON, para referência rápida — é o mesmo shape
que a API espera/retorna em `GET/PUT /api/stores/:id/data`.

```jsonc
{
  "products": [
    {
      "id": "p1a2b3c4d",
      "nome": "Camiseta Azul M",
      "cat": "Roupas",
      "barcode": "7891234567890",
      "qty": 10,
      "custo": 25.00,
      "venda": 59.90,
      "variations": [
        { "name": "P", "qty": 3 },
        { "name": "M", "qty": 5 },
        { "name": "G", "qty": 2 }
      ]
    }
  ],
  "customCats": ["Novidades", "Promoção"],
  "saleHistory": [
    {
      "id": "p9z8y7x6",
      "type": "sale",
      "label": "Venda — 2 itens",
      "items": [{ "name": "Camiseta Azul M", "qty": 1, "price": 59.90, "pid": "p1a2b3c4d", "varName": "M" }],
      "qty": 2,
      "total": 149.80,
      "payment": "Pix",
      "date": "01/03/2025, 14:32"
    }
  ],
  "config": { "lowStock": 3 },
  // Ao LER (GET), cada funcionário vem sem a senha:
  "employees": [
    { "id": "p0e1m2p3", "name": "João Silva", "created": "01/01/2025" }
  ]
}
```

**Sobre a senha dos funcionários:** ao SALVAR (`PUT`), o frontend manda um
campo `passPlain` só quando o usuário está definindo/trocando a senha do
funcionário. O backend faz o hash com bcrypt, guarda só o hash no banco, e
nunca devolve isso ao cliente — o campo simplesmente não existe nas
respostas da API.

**Tipos de movimentação no histórico:** `sale` (venda), `adjust` (ajuste
manual de estoque), `remove` (remoção de produto).

**Formas de pagamento:** Dinheiro, Cartão de Crédito, Cartão de Débito,
Pix, Fiado.
