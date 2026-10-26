# Fátima VIP — implantação na Vercel

## Configuração

1. Importe o repositório do GitHub e mantenha o framework Vite.
2. Em **Settings → Environment Variables**, configure:
   - `OMEGAPAY_PUBLIC_KEY`: chave pública da API (painel OmegaPay → Integrações / API Keys).
   - `OMEGAPAY_SECRET_KEY`: chave secreta da API.
   - `APP_BASE_URL`: URL HTTPS final do projeto na Vercel.
3. Não coloque credenciais no frontend, no GitHub ou em variáveis `VITE_*`.
4. (Opcional) Cadastre o webhook `https://SEU-DOMINIO/api/webhooks/omegapay` no painel OmegaPay.
5. Remova `ATENASPAY_API_KEY` e `ATENASPAY_WEBHOOK_SECRET` se ainda existirem.
6. Faça uma cobrança de teste de baixo valor. Confirme a geração do QR/copia-e-cola e que o acesso só libera quando a consulta retornar status pago (`COMPLETED` / `paid`).

## Endpoints usados

- Criar Pix: `POST https://app.omegapayments.com.br/api/v1/gateway/pix/receive`
- Consultar Pix: `GET https://app.omegapayments.com.br/api/v1/gateway/transactions?id=...`
- Webhook do projeto: `/api/webhooks/omegapay`

Headers de autenticação: `x-public-key` + `x-secret-key`.

O checkout não solicita nome, e-mail, CPF ou telefone no frontend. O backend gera dados de cliente placeholder para satisfazer a API da OmegaPay. Não considere a integração validada até testar com as chaves reais da sua conta.
