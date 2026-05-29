# Capitalism Update — Requirements

> **Status:** Approved design, not yet implemented.
> **Delivery:** Phase 1 (Obligation Market) ships first and standalone; Phase 2 (Stock Market)
> builds on it.
> Living implementation plan: see the approved plan (mirrored here as the source of truth for
> *what* we're building; the plan covers *how*).

## 1. Overview

A financial layer on top of EU5 diplomacy for the multiplayer-focused Ars Belli mod. Countries
can:
- **Lend money over time** to each other (*obligations*), and
- **Pool capital into shared companies** (*ventures / stocks*).

Both systems require **no diplomats** and work **even during war**. A debtor who defaults faces a
war-based enforcement mechanism.

### Guiding principles
- **Player-only.** The AI must never *initiate* or *accept* any obligation/venture action.
- **AI-safe.** If a human temporarily controls an AI seat — or the AI takes over a player seat —
  nothing may break or spam `error.log`, and existing obligation payments must keep flowing.
- **No new dependencies.** Vanilla EU5 scripting only (no Community Framework).
- **Robust math.** Every total, percentage, date span, and share split is guarded against
  division by zero.

---

## 2. Locked design decisions

| Decision | Choice |
|----------|--------|
| Delivery | Phase 1 = Obligation Market (standalone), Phase 2 = Stock Market |
| Data model | Vanilla `variable_list`s + named variables — **no** Community Framework |
| Venture entity | A real `international_organization` (reuses native voting + rally-to-war) |
| Venture default → war | Coalition **rally-to-war**: all shareholders may declare on the debtor |

---

## 3. Phase 1 — Obligation Market

An **obligation** is a directed promise: a **debtor** country pays a **creditor** (a country, or
in Phase 2 a venture) a fixed **monthly sum** between a **start date** and an **end date**.

`total = monthly_sum × months(start → end)` — displayed in tooltips. **Guard `months <= 0`.**

### 3.1 Actions
All actions are player-only (`ai_tick = never`, `ai_will_do = -1000`), cost **no diplomats**, and
are **not blocked during war**. Acceptance paths reject AI recipients (`is_ai = no`).

| Action | Requirement |
|--------|-------------|
| **Create obligation** | Debtor and creditor agree a monthly sum + start/end dates. Counterparty must accept. Creates the obligation record. |
| **Forgive (all / part)** | Creditor cancels the obligation outright, or reduces the remaining monthly sum / shortens the end date. Unilateral (favours debtor → no acceptance needed). |
| **Reconfigure payment** | Adjust start/end dates and increase or decrease the monthly sum. Total is **recomputed and shown**. Counterparty must accept. |
| **Sell obligation** | The holder sells the obligation to a **third country** for a configurable **up-front sum**. The buyer **must accept**. On accept: up-front gold flows buyer → seller, and the debtor pays the **new owner** going forward. |
| **Default** | The debtor unilaterally defaults. Effects: lose **20 stability**, the obligation is closed, and the enforcement CB / rally is granted (§3.3). |

### 3.2 Monthly payment
On every monthly pulse, each active (non-defaulted, in-date-range) obligation transfers its
monthly sum debtor → creditor. Guards: skip expired/zero-sum/closed records; null-safe creditor;
optional auto-default hook if the debtor cannot pay.

### 3.3 Default enforcement
On default, the obligation **owner** gains the means to make war on the debtor via a
**superiority-type casus belli**:
- **Attacker (creditor):** `conquer_cost = 0.25`, `subjugate_cost = 0.25`
- **Defender (debtor):** `conquer_cost = 10.0`, `subjugate_cost = 10.0`

Owner resolution:
- Owner is a **country** → that country receives the CB against the debtor.
- Owner is a **venture** (Phase 2) → **coalition rally-to-war**: all shareholders may declare war
  on the debtor.

---

## 4. Phase 2 — Stock Market (Ventures)

A **venture** is a shared company implemented as a custom international organization. Its creator
becomes the **admin** and first shareholder. The share ledger maps each shareholder country to a
share count.

### 4.1 Lifecycle & governance
- **Create venture:** admin sets an initial share count.
- **Stock split:** an action multiplies every holder's shares by a multiplier (guard: total
  shares 0).
- **Admin-proposed actions** require approval by a **majority of shares** via a share-weighted
  vote. **Failure to reach quorum = the proposal is rejected.**
- The **largest shareholder** may petition to **become admin** (majority approval required).

### 4.2 Raising capital
- **Public offering:** a tranche of shares offered broadly; eligible countries buy in and receive
  shares.
- **Private offering:** admin offers shares to a **selected** country in exchange for money.
- **Secondary market:** any shareholder may **list** shares at a price; others buy all or part of
  a listing. A listing that hits **0 shares remaining** auto-delists.

### 4.3 Income & pledges
A venture's income may come from any **mixture** of these, configured **per pledging country**:
1. A **%** of a country's **total income**,
2. A **%** of a country's **trade income**,
3. Wired **obligation** payments.

Rules:
- Any country (member or not) may **pledge unilaterally**.
- Pledging **in exchange for shares** requires **shareholder approval**.
- A country may **change or be released** from a pledge with approval of **half the shares**.
- The **admin may demand** any of the above (pledge / payment / release) from other countries.

### 4.4 Monthly payout
`obligation payments + pledged income → venture treasury → dividends distributed pro-rata by
share count`. Guards: zero total shares, empty shareholder list, zero treasury.

---

## 5. Cross-cutting requirements

- **AI:** every action `ai_tick = never` + `ai_will_do = { add = -1000 }`; acceptance paths add
  `is_ai = no`. The monthly tick is null-safe so AI-held seats keep paying and never error.
- **No diplomats / usable at war** for all actions.
- **Per-player UI** state via `GetVariableSystem` (client-local), never global script vars.
- **Localization** files UTF-8 **with BOM**; gameplay setup `.txt` stay BOM-less.
- **Division-by-zero guards** on every denominator (months, share totals, percentages, splits).
- Update `memory.md` and `changes.txt`; ship via `release.ps1`.

---

## 6. Open items (decide at build time)

- Whether a debtor who cannot pay is **auto-defaulted** or the payment is simply skipped.
- Whether Phase 1 ships with a **read-only obligations GUI panel** or all UI is deferred to
  Phase 2.
- The exact **storage primitive** for per-pair obligation records — `scripted_relation` carrying
  numeric fields (preferred) vs. bounded numbered per-debtor variables. To be settled by an
  in-game spike before the rest of Phase 1 is built.
