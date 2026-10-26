# Fátima VIP

Landing de assinatura VIP com checkout Pix via **OmegaPay**.

## Stack

- Frontend: Vite + React + TanStack Router
- Backend serverless: Vercel Functions (`/api/pix/*` e `/api/webhooks/*`)

Para executar localmente: `npm install` e `npm run dev`.

## Integração OmegaPay

O backend cria cobranças Pix em:

`POST https://app.omegapayments.com.br/api/v1/gateway/pix/receive`

Autenticação pelos headers:

- `x-public-key`
- `x-secret-key`

Consulta de status:

`GET https://app.omegapayments.com.br/api/v1/gateway/transactions?id={transactionId}`

(ou `?clientIdentifier={seu_identifier}`)

Configure em **Vercel → Project → Settings → Environment Variables**:

- `OMEGAPAY_PUBLIC_KEY`: chave pública da API (painel OmegaPay)
- `OMEGAPAY_SECRET_KEY`: chave secreta da API (painel OmegaPay)
- `APP_BASE_URL`: URL HTTPS pública deste projeto, ex. `https://seu-projeto.vercel.app`

Cadastre as credenciais **somente** na Vercel. Não coloque no GitHub, no frontend ou em variáveis `VITE_*`.

Remova as variáveis antigas `ATENASPAY_API_KEY` e `ATENASPAY_WEBHOOK_SECRET` quando o deploy novo estiver funcionando.

Webhook (opcional, recomendado):

`https://SEU-DOMINIO/api/webhooks/omegapay`

O checkout não exige nome, e-mail ou CPF do comprador no frontend: o backend envia dados placeholder válidos para a OmegaPay. O sistema consulta o status periodicamente; valide com uma cobrança de teste de baixo valor antes de liberar vendas reais e confirme que o acesso só é liberado após status `paid` / `COMPLETED`.
