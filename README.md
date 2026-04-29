# WhatsApp Fashion Chatbot (Fastify + Gemini + Meta Cloud API)

Production-ready TypeScript WhatsApp chatbot for fashion e-commerce demos.

## Tech Stack
- Node.js 20+
- TypeScript (strict)
- Fastify
- Google Gemini 2.0 Flash (REST)
- Meta WhatsApp Cloud API
- Zod validation
- Pino logging
- Vitest tests

## Local Development
1. Install dependencies:
```bash
npm install
```
2. Copy environment template:
```bash
cp .env.example .env
```
3. Fill all required values in `.env`.
4. Run dev server:
```bash
npm run dev
```

## Environment Variables
Required (validated at startup with Zod):
- `WHATSAPP_TOKEN`
- `WHATSAPP_PHONE_ID`
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_APP_SECRET`
- `GEMINI_API_KEY`
- `GEMINI_MODEL` (default `gemini-2.0-flash`)
- `MANAGER_PHONE`
- `PORT` (default `3000`)
- `NODE_ENV` (`development|test|production`)
- `LOG_LEVEL`

If any required variable is missing/invalid, server exits immediately.

## Webhook Routes
- `GET /` health check
- `GET /webhook` Meta verification challenge
- `POST /webhook` incoming WhatsApp messages

## Update Store Information
Edit:
- `/data/store-config.json`

No code changes needed. Prompt generation updates automatically.

## Add or Update Products
Edit:
- `/data/products.json`

Expected fields per product:
`product_id, name, gender, category, price, currency, material, stock_quantity, care_instructions, color_options, size_options, description, style_tags`

## Shopify Integration (Step-by-Step)
1. Create `ShopifyProductRepository` implementing `ProductRepository`.
2. Fetch from Shopify Admin API endpoint:
   - `/admin/api/2024-01/products.json`
3. Map Shopify fields to internal `Product` schema.
4. Keep output normalized to `Product[]`.
5. In `createProductRepository()` (`src/services/product.service.ts`), swap one line to use Shopify repository.

## Permanent WhatsApp Token (Meta)
1. Open Meta Business Manager.
2. Go to your app and add WhatsApp product.
3. Create a System User in Business Settings.
4. Assign app + WhatsApp assets to the system user.
5. Generate a permanent token with WhatsApp permissions.
6. Put token into `WHATSAPP_TOKEN`.

## Deploy to Railway
1. Push repository to GitHub.
2. Create a Railway project from the repo.
3. Add all env vars in Railway Variables.
4. Railway uses included `Dockerfile` and `railway.toml`.
5. Deploy.

## Add a New Client
1. Duplicate and customize `/data/store-config.json`.
2. Replace `/data/products.json` with client catalog.
3. Set client-specific env vars (tokens, phone IDs, manager phone).
4. Deploy as a separate Railway service/environment.

## Tests and Build
```bash
npm test
npm run build
```
