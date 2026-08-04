<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Spinos — Project Guide

**What it is:** Spinos (rebranded from "Opportunity OS") is a B2B commercial-intelligence SaaS. It watches public signals (news, hiring, expansions, public contracts) and tells a sales team which companies are most likely to buy right now, why, and how to approach them. Founder/operator: Cyro Mello (cyro@agenciaeverest.com.br), agência Everest. He delegates almost all engineering, tests live in his own browser/phone, and reviews in numbered-list style feedback (fixes + approvals + new asks mixed together).

Live at **https://app.spinos.com.br** (also aliased to spinos.com.br in Vercel, but the public DNS for the bare domain and `www` now point to Hostinger for a separate marketing landing page — don't assume `spinos.com.br` reaches the app). GitHub: `https://github.com/cyromelloeverest/spinos` (push works directly, credential is cached).

## Stack

- **Next.js 16.2.12**, App Router, Turbopack. Auth middleware file is **`src/proxy.ts`**, not `middleware.ts` — a breaking change in this version.
- **Prisma ORM 7.9.1** + `@prisma/adapter-pg`. Two connection strings, don't mix them up:
  - `DATABASE_URL` — Supabase **transaction pooler** (port 6543, `?pgbouncer=true`). Used at runtime (`src/lib/prisma.ts`). Required — the session pooler exhausts connections under concurrent serverless load.
  - `DIRECT_URL` — Supabase **session pooler** (port 5432, no pgbouncer). Used only by the Prisma CLI for migrations, wired via `prisma.config.ts`.
- **Supabase Auth** (`@supabase/ssr`, PKCE), project ref `cyoxdxnrkhwnqvuodrau`. `getClaims()` for server-side auth checks.
- **Resend** for all transactional email, domain `spinos.com.br` verified (SPF on `send.spinos.com.br`, DKIM at root). `RESEND_API_KEY` in `.env` is send-only (can't list domains or read logs via API).
- **Vercel** hosting, project `agencia-everest/opportunity-os`. Deploy: `cd /Users/cyromello/opportunity-os/app && npx vercel --prod --yes` — **always `cd` first**, the shell's cwd resets to `/Users/cyromello` between tool calls and a stray deploy from the home directory hangs on a confirmation prompt or fails with `not_linked`.
- Design: **Spinos Design System v1.0** — enterprise, no gradients, no "AI tool" vibe. Primary blue `#2563EB`, dark sidebar `#0F172A`, Inter font everywhere (`--font-mono` reserved for genuinely numeric/tabular data only), lucide-react icons (no emoji, and **lucide-react has no brand/logo icons** — LinkedIn's icon is a hand-written inline SVG in `src/components/LinkedInButton.tsx`). Radii: buttons 12px, inputs 10px, cards 16px.

## Hard-won gotchas (don't rediscover these)

- **Git config is off-limits.** Never run `git config`, even locally. Commit with inline identity: `git -c user.name="Cyro Mello" -c user.email="cyro@agenciaeverest.com.br" commit ...`.
- **BSD `sed` doesn't support `\b`** word boundaries — matches silently fail with no error. Match literal substrings instead.
- **`.next` type-cache can go stale** after deleting/renaming a route file (`route.ts` → `page.tsx` at the same path) — `tsc --noEmit` errors on a phantom reference until you `rm -rf .next`.
- **Supabase email is full of traps**, all now worked around:
  - Emails must be lowercased before any lookup/write — Supabase normalizes internally, our own tables didn't, causing a real production bug (mixed-case duplicate user).
  - Re-signing-up an already-confirmed email returns a **decoy `data.user`** (anti-enumeration, not a real row) — check `public.users` by email before upserting on `data.user.id`, or you get a unique-constraint crash.
  - Supabase's built-in mailer only sends to project **team members** and caps at 2/hour — useless for real customers. Custom SMTP had its own unresolved GoTrue bug (sometimes uses the recipient's own address as "From", silently rejected by Resend). **Fixed by bypassing GoTrue's mailer entirely**: `src/app/api/auth/send-email/route.ts` is a Supabase **Send Email Hook** (configured in Supabase dashboard → Authentication → Hooks, secret in `SEND_EMAIL_HOOK_SECRET`) that verifies the Standard Webhooks signature and sends via Resend directly, with our own template and controlled sender.
  - **Always `encodeURIComponent()` the `token_hash`** when building confirm links — it contains `+`/`/`/`=` (base64-ish) and an unescaped `+` is read back as a space, breaking every link.
  - **Email confirmation must require a real click**, not just a GET — corporate/webmail security scanners (Outlook Safe Links, Gmail) prefetch every link in an email, silently burning single-use tokens before the user clicks. `src/app/auth/confirm/page.tsx` renders a "Confirmar agora" button; the actual `verifyOtp`/`exchangeCodeForSession` call only runs in the button's form action (`confirmAuthLink` in `src/lib/actions/auth.ts`), never on the bare GET.
- **API credits ≠ Claude.ai subscription.** They are separate billing surfaces on separate pages (Claude.ai billing vs `platform.claude.com/settings/billing`). As of Feb 2026 Anthropic's ToS explicitly **bans** using a Pro/Max subscription's OAuth token to power a third-party product — Spinos must use an API key from the Console, billed pay-as-you-go. If searches start failing with `credit balance too low`, that's the API Console balance, not Claude.ai.
- **`git push`/`vercel --prod --yes`/migrations are three separate steps** — none of them trigger each other automatically. Every shipped change this session followed: edit → `tsc --noEmit` → `eslint src --quiet` → (migrate if schema changed) → commit → `vercel --prod --yes` → `git push origin main`.
- Diagnostic/one-off scripts: write a `.mts` file in the app root, run with `npx tsx`, **always delete it after** (`rm`) — never leave scratch scripts in the repo.

## Data model (see `prisma/schema.prisma`)

Tenant = `Organization` (has `plan`, `trialEndsAt`, `lastSearchAt`). `Company`/`Signal` are **global**, shared across all tenants — a public signal is an objective fact, not owned by one customer. `OpportunityScore` is the per-tenant relevance of a Company to an Org's `ICP` — the proprietary asset. `Membership` (userId, organizationId, role, `searchBlocked`) links `User` to `Organization`; a `User.isSuperAdmin` flag (not a Membership role) gates the `/admin` panel. `Invite` is a 7-day token-based team invite (self-serve at `/settings/equipe`, or admin-initiated into any org from `/admin`). `SearchRun` logs every AI search execution, used only to enforce the monthly search cap. Row Level Security is enabled on every table (defense-in-depth; the app's Prisma connection uses the `postgres` role, which bypasses RLS, so this doesn't affect app behavior).

## Plans & limits (`src/lib/plans.ts`)

Three tiers — STARTER / PROFISSIONAL / ENTERPRISE — differentiated by `maxActiveOpportunities`, `maxUsers`, `maxSearchesPerMonth` (all `null` = unlimited), and feature flags (`radar`, `assistenteVendas`, `multipleIcps`). **Prices in R$ are not set yet** — Cyro hasn't decided them; the admin panel and landing page show placeholders. Limits live in code, not the DB, so they're adjustable without a migration. `maxUsers` is enforced at invite time only (not retroactively). New orgs get a 7-day free trial (`trialEndsAt` on `Organization`); admin can extend (+30 days) or remove the limit entirely per org from `/admin`. Trial expiry blocks the whole app except for the super-admin.

## What's built

Dashboard (home, KPIs) · Oportunidades (AI-found leads list, search button with cooldown/plan-limit/search-limit/user-block gating) · Radar (signal feed) · Pipeline (Kanban, drag-and-drop, now tracks `lastActionByUserId`/`lastActionAt` so a shared team pipeline shows who moved what) · Assistente de Vendas (deterministic script builder, no extra AI call, includes a LinkedIn connection-note + search-link) · Histórico · Playbooks (10 static articles) · Company/opportunity detail page (LinkedIn links, contact fields, pipeline actions) · Settings (empresa, ICP, equipe) · `/admin` (super-admin only: org list with plan/trial/opportunity-count, full per-org user list with invite/remove/search-block, pending invites, incomplete-signup visibility) · "Inteligência Competitiva" nav entry — **coming-soon placeholder only**, static explainer page, no backend.

The AI search (`src/lib/opportunity-engine/search.ts`) calls `claude-opus-5` with the `web_search` tool + structured output, gated by a 2-day cooldown, a monthly search-run cap, and an active-opportunity cap, all per plan.

## Known gaps / backlog (ask before assuming priority)

- Pricing (R$/month per plan) not set.
- No automated billing (Stripe or similar) — plan changes are manual, admin-only.
- CRM export is a disabled placeholder button.
- Radar's "recheck signals after 10 days" auto-recompute was never built (needs new AI calls — deferred pending Cyro's cost sign-off).
- "Sinal" / **Share of AI Voice** — a competitor-marketing-X-ray + AI-answer-visibility module proposed by Cyro's salesperson. Evaluated and recommended (real differentiation, validated market trend — 73% of B2B buyers already research via AI), but **not built**. Current status: a coming-soon nav placeholder only (`/inteligencia-competitiva`), no backend. Before building for real: get the actual "Sinal" repo code and review it (it was pitched as already-working, unverified by us), test Share-of-AI-Voice score stability across repeated runs, and consider piloting it as a free lead-gen tool on the marketing landing page before making it a paid in-app module.
- `spinos.com.br` / `www` landing page is being built separately on Hostinger — not this codebase.
