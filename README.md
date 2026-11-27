# M I M O — Creator Studio App

Catalog-first workspace for creators/designers on the POD platform. This is the
**creator** half of the former single app; the buyer app is a separate project
(same backend, same user accounts).

Stack: TanStack Start (SSR) · React 19 · Zustand · TanStack Query · React Three Fiber · Tailwind 4.

## Creator journey (routes)

| Step | Route | Notes |
|------|-------|-------|
| 1. Blank catalog | `/catalog` | pick a blank (Tee, Hoodie, Cap, Polo…) |
| 2. 3D studio | `/studio` | upload artwork/logos, position & layer. **Save & Continue** saves a draft + mockups |
| 3. Publish & review | `/designs` (modal opens automatically after the studio save) | set markup (live price), enable variants/sizes, limited edition, publish |
| 4. Dashboard | `/store`, `/wallet`, `/analytics` | revenue & sales, pending vs available balance, payout requests |
| Auth | `/login`, Telegram auto-login | |

`/designs` also lists drafts / published / archived designs, and lets you
re-open any design in the studio (`productId` router state) or in the review modal.

Removed vs. the old app: marketplace, product pages, cart, checkout, payment,
orders (these belong to the buyer app).

## Run

```bash
cp .env.example .env
npm install            # .npmrc sets legacy-peer-deps (needed by current TanStack peer ranges)
npm run dev            # http://localhost:3000
npm run build && node .output/server/index.mjs
```

`VITE_*` variables are read at **build** time.

## Role model (important)

The frontend no longer has any role logic. Everyone is a buyer by default; the
backend adds the creator/designer **membership** automatically when someone
uses this app. `src/shared/hooks/use-store-access.ts` is the single gate:
signed-in users may price/publish unless the backend explicitly returns
`is_verified: false`. Saving in the studio never changes a role.

## What changed from the original

* Studio "Continue" no longer opens checkout: it saves (create once, then update
  in-session), uploads mockups, and navigates to `/designs` with
  `{ reviewProductId }` router state, which opens `EditProductModal`.
* Designs list / detail: the buyer-style "Order Now" actions became
  "Details" / "Review & publish".
* Navigation: Catalog · Designs · Dashboard · Earnings (+ Analytics in account menu).
* Default landing page is `/catalog`.
* Optional `VITE_BUYER_APP_URL` adds an "Open the marketplace" link.

## Keeping the studio in sync with the buyer app

Studio code lives in `src/features/studio` (identical paths in both repos).
Creator-specific differences: the save creates a listing draft (`purpose:"listing"`, `client.app:"creator-studio"`) and hands off to the review modal on `/designs`; re-opening a design uses `?design=<id>`. Keep the rest identical so diffs line up. 

## Known pre-existing issues (not introduced by the split)

`npx tsc --noEmit` reports 32 type errors inherited from the original code.
The production build is unaffected. Compared with the original project there
are zero new ones.

## Money endpoints (API Contract v1 — money wave)

- Totals come only from `POST /orders/checkout/validate/` (`tax_amount`, `platform_fee_amount`, `total_amount` = subtotal + tax + platform fee + shipping − discount). Never hardcode tax/fee. Order objects carry `platform_fee_amount`.
- Payment attempt statuses: `pending_review | verified | rejected | expired`. Buyer `PaymentSheet` (features/payment) wraps the panel; while create-attempt + verify run, `PaymentVerifyingOverlay` blocks the whole UI (and Telegram back) until the response arrives.
- Escrow (buyer): `GET /escrow/orders/{id}/`, `POST …/confirm-receipt/`, `POST …/dispute/` — shown in the order sheet; the UI displays `inspection_due_at` from the server.
- Wallet (creator / partner): transactions rows `{type, entry_type, amount, …}` with `{count,page,page_size,results}` paging; withdrawals `requested|reserved|approved|paid|rejected|cancelled`; request sends an `idempotency_key`; fee is platform-configured, so the UI shows the server's `fee_amount`/`net_amount`; error codes `method_not_verified`, `below_minimum_withdrawal`, `above_maximum_withdrawal`, `above_daily_limit`, `insufficient_balance`, `invalid_transition`.
- Auth header stays `Authorization: Token <token>` (the contract text says `Bearer` — confirm with the backend).
