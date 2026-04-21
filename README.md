# Fest Friend

A mobile-first, utility-first chat assistant for Jazz Fest. Ask about schedules, stages, who's playing right now, food vendors, and band bios. One-time $5 unlock.

## Stack

- Next.js 16 (App Router, TypeScript)
- Tailwind CSS v4
- Stripe Checkout (one-time $5 payment)
- PWA (manifest + service worker, "Add to Home Screen")
- Structured local data — the model does not invent schedules

## Run locally

```bash
# 1. Install dependencies (already installed in node_modules, re-run if needed)
npm install

# 2. Configure Stripe
cp .env.example .env.local
# Open .env.local and paste your Stripe TEST secret key:
#   STRIPE_SECRET_KEY=sk_test_...
# Optional — skip payment locally while iterating:
#   NEXT_PUBLIC_DEV_UNLOCK=1

# 3. Start the dev server
npm run dev

# 4. Open in browser
#   http://localhost:3000
# On mobile, open your machine's LAN IP at :3000 over the same wifi.
```

### Testing the payment gate

Use any Stripe test card, e.g. `4242 4242 4242 4242`, any future expiration, any CVC, any ZIP.
After success, Stripe redirects back to `/?payment=success`, which sets a `localStorage` flag so the user does not have to pay again on that device.

To wipe the unlock on a device:
```js
localStorage.removeItem("fest-friend-unlocked")
```

### Production build

```bash
npm run build
npm run start
```

## Project structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout, PWA meta, SW registration
│   ├── page.tsx                # Landing → PaymentGate or ChatApp
│   ├── globals.css             # Tailwind + base styles
│   └── api/
│       ├── chat/route.ts       # POST /api/chat — intent parsing
│       └── checkout/route.ts   # POST /api/checkout — Stripe session
├── components/
│   ├── PaymentGate.tsx         # Landing screen + "Unlock for $5"
│   ├── ChatApp.tsx             # Chat screen shell
│   ├── ChatMessage.tsx         # Message bubble
│   ├── ChatInput.tsx           # Input bar
│   └── QuickActions.tsx        # Quick-button row
├── lib/
│   ├── intent.ts               # classify() + handlers per intent
│   └── time.ts                 # Festival timezone helpers
├── data/
│   ├── artists.ts              # SWAP REAL ARTIST DATA HERE
│   ├── stages.ts               # SWAP REAL STAGE DATA HERE
│   ├── vendors.ts              # SWAP REAL VENDOR DATA HERE
│   └── festival.ts             # Festival dates + timezone
└── types/
    └── index.ts                # Shared TypeScript types
public/
├── manifest.webmanifest        # PWA manifest
├── sw.js                       # Service worker
└── icon.svg                    # App icon
```

## Swap in real festival data

All festival content lives in `src/data/`. No other file needs to change.

1. **`src/data/artists.ts`** — replace the `artists` array. Each entry:
   ```ts
   {
     artist_name: string;
     stage: string;          // must match a stage_name from stages.ts
     day: FestivalDay;       // one of the literal days in festival.ts
     start_time: string;     // "HH:MM" 24h, festival-local
     end_time: string;       // "HH:MM" 24h, festival-local
     bio: string;
     genre: string;
   }
   ```
2. **`src/data/stages.ts`** — replace the `stages` array. Each entry:
   ```ts
   { stage_name: string; description: string; }
   ```
3. **`src/data/vendors.ts`** — replace the `vendors` array. Each entry:
   ```ts
   {
     vendor_name: string;
     location_description: string;
     food_items: string[];
     category: string;
   }
   ```
4. **`src/data/festival.ts`** — update `festivalDays` to match your festival's real dates and the `FestivalDay` union in `src/types/index.ts`.
5. If the day labels change, also update the `FestivalDay` type in `src/types/index.ts` and the order in `festivalDayIndex()` inside `src/lib/intent.ts`.

Tip: if you prefer to import from a CSV/JSON file, write a small loader that produces the same typed shape and export it from `src/data/artists.ts` — the rest of the app will just work.

## How intent parsing works

`src/lib/intent.ts` owns all of it. `answer(query)` returns `{ intent, response }`.

Intents:
- `now_playing` — "who's playing now", "right now", "currently playing"
- `artist_lookup` — "what time does X play", "when does X play"
- `artist_bio` — "tell me about X", "who is X"
- `stage_lookup` — "who's playing on Acura Stage", "stage schedule for Y"
- `food_lookup` — "where is crawfish bread", vendor/food item names
- `unknown` — everything else returns a short help string

If a query doesn't match structured data, the response says so clearly. The model is not asked to invent answers.

## Customize

- Tweak intent phrases in `src/lib/intent.ts` (see `NOW_PHRASES`, `BIO_PHRASES`, etc.)
- Tweak quick-button presets in `src/components/QuickActions.tsx`
- Tweak the price in `src/app/api/checkout/route.ts` (`unit_amount: 500` = $5.00)
- Tweak PWA name/colors in `public/manifest.webmanifest` and `src/app/layout.tsx`

## Why this is simple on purpose

This is a utility, not a concierge. Answers are short and structured. The only screen after unlock is chat. No accounts, no navigation, no feed. It should load fast on bad festival wifi and still feel useful in a crowd.
