# WhatsApp Fashion Chatbot
Production-ready WhatsApp chatbot for a fashion e-commerce store, built with Fastify + TypeScript + Groq + Meta Cloud API.

## Overview
This project receives WhatsApp messages via Meta webhook, searches product data, builds a policy-aware AI prompt, and sends a customer reply. It is designed for agency-friendly maintenance: configuration lives in env variables and JSON files.

## Features
- Fastify webhook API (`GET /`, `GET /webhook`, `POST /webhook`)
- Meta signature verification (`X-Hub-Signature-256`)
- Rate limiting and security headers
- Product repository pattern (JSON now, Shopify-ready)
- Groq chat completion integration
- Deterministic fallback replies when AI fails/rate-limits
- Escalation flow to manager WhatsApp
- Structured logging with masked phone numbers
- Strict TypeScript and unit tests

## Tech Stack
- Node.js 20+
- TypeScript (strict)
- Fastify
- Groq SDK (`groq-sdk`)
- Meta WhatsApp Cloud API
- Zod
- Pino
- Vitest

## Project Structure
```text
src/
  app.ts
  server.ts
  config/
  handlers/
  middleware/
  services/
  types/
  utils/
data/
  products.json
  store-config.json
tests/
Dockerfile
railway.toml
```

## Environment Variables
Copy `.env.example` to `.env` and set values.

Required:
- `WHATSAPP_TOKEN`
- `WHATSAPP_PHONE_ID`
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_APP_SECRET`
- `GROQ_API_KEY`
- `GROQ_MODEL` (default: `llama-3.3-70b-versatile`)
- `MANAGER_PHONE`
- `PORT`
- `NODE_ENV`
- `LOG_LEVEL`

Optional:
- `DEMO_FORCE_FALLBACK=true|false`

The server fails fast at startup if required values are missing.

## Groq Setup
1. Sign up at [console.groq.com](https://console.groq.com).
2. Create an API key.
3. Set `GROQ_API_KEY` in `.env` or Railway Variables.
4. Set model (`GROQ_MODEL`), default is `llama-3.3-70b-versatile`.

## Local Development
```bash
npm install
cp .env.example .env
npm run dev
```

Health check:
```bash
curl http://localhost:3000/
```

## Webhook Configuration (Meta)
- Callback URL: `https://<your-domain>/webhook`
- Verify token: exact match with `WHATSAPP_VERIFY_TOKEN`

Verification test URL:
```text
https://<your-domain>/webhook?hub.mode=subscribe&hub.verify_token=<TOKEN>&hub.challenge=12345
```
Expected response body: `12345`

## Running Tests and Build
```bash
npm test
npm run build
```

## Deployment (Railway)
1. Push code to GitHub.
2. Create Railway project from the repo.
3. Add environment variables in Railway.
4. Deploy using included `Dockerfile` and `railway.toml`.
5. Configure Meta callback URL to Railway domain + `/webhook`.

## Data Management
- Store policies and branding: `data/store-config.json`
- Product catalog: `data/products.json`

No code changes needed for regular catalog/policy updates.

## AI and Fallback Behavior
Normal flow:
1. Parse incoming message.
2. Search matching products.
3. Build system prompt + user message.
4. Request Groq response.
5. Parse strict JSON reply.

Fallback flow:
- If AI fails/429/invalid JSON, deterministic reply is generated from local data.
- Escalation only when user explicitly requests human help or on hard failure paths.

## Shopify Integration (High-Level)
Current source is JSON via `JsonProductRepository`.
To integrate Shopify, implement `ProductRepository` with Shopify Admin API and swap one factory line in `createProductRepository()`.

See in-code guidance in:
- `src/services/product.service.ts`

## Troubleshooting
- Webhook verify fails: ensure callback is `/webhook` (not root `/`).
- No customer reply: check Railway logs for `WhatsApp API request failed` and HTTP status body.
- AI rate limits: check logs for AI failures; fallback replies should still respond.

## Security Notes
- Signature verification on webhook POST
- Rate limit enabled
- Input sanitization and message length limits
- Masked phone numbers in logs
- No secrets committed to repository
