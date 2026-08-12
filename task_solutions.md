# Task solutions — diplomacy/economy batch

Branch: `feature/officepins-diplo-changes2` (branched from `fb4373c`, the `game.1.3.11.mod.11` release).

One numbered requirement per section, in numeric order. Each records what the request was,
what the engine actually allowed, what was built, and anything left open. Commit hashes are
from after the history rewrite in `5979043` — earlier hashes no longer exist.

Status summary:

| Nr. | Requirement | Status | Commit |
|---|---|---|---|
| 3 | Remove offering own troops as mercenaries | Done | `17a2076` |
| 6 | Economic Support amount based on receiver's tax base | Done | `14ec953` |
| 7 | Personal Union call to arms must be declinable | Done | `293b9d3` |
| 8 | Tributaries excluded from location/subject transfers | Done | `cdde1dc` |
| 10 | Throttle Worsen Opinion, 2x Improve Relations | Done | `8c3057e` |
| 11 | Base location warscore cost 2 → 2.5 | Done | `7bb2b53` |
| 16 | Cap gold transferable via sell/buy location | Done, verified in game | `0d73498`, fixed in `d6e524a` and `e6ec2c1` |
| 17 | −10 prestige to both sides of a location sale | **Not done — engine-locked** | — |

---

## HIGH Nr.3 — remove the ability to offer troops as mercenaries

**Request.** Remove "Make Available For Hire" for players, and for the AI if possible. Renting
out your own regiments prints money: the mercenary modifiers apply on the hirer's end while the
seller keeps drawing the full hire price.

**What the engine allowed.** `make_unit_available_for_hire` is a normal `generic_action`
(`type = owncountry`) and is fully moddable. `delist_unit` sits in the same vanilla file as a
separate key.

**Solution.** `in_game/common/generic_actions/ars_belli_no_mercenary_listing.txt` overrides the
key with `REPLACE:` and sets `potential = { always = no }`. The body is otherwise vanilla's,
unchanged, so no field the engine expects is missing.

- The gate is in `potential`, not `allow`, so the action drops out of the action list entirely
  instead of sitting there permanently greyed out. Player, delegation automation and AI
  evaluation all pass that same gate.
- `REPLACE:` rather than a same-name file copy specifically so `delist_unit` stays vanilla —
  anyone who listed a unit before the change still needs a way to pull it back off the market.

**Caveat.** Vanilla already carried `ai_tick = never` on this action, which per
`country_interactions/readme.txt` marks behaviour "already handled in code". If AI countries
list mercenaries through engine code rather than through this action, that path is not reachable
from script and no data change closes it.

---

## HIGH Nr.6 — Economic Support amount should depend on the receiver's tax base

**Request.** The sendable amount should scale off the receiving country's tax base (it was
believed to key off the sender), and should land near 25% of its then-current value.

**What was found.** The cap was purely sender-side: `slider_max = scope:actor.monthly_income_total`,
the sender's entire monthly income, with the slider opening at 10% of it. The recipient never
entered the calculation.

**Solution.** `in_game/common/script_values/ars_belli_economic_support_values.txt` now takes the
lower of two ceilings, floored at 1 gold, with the slider opening at half the resulting cap:

| Ceiling | Share | Binds when |
|---|---|---|
| Recipient's `country_tax_base` | `1.0` | a large country subsidises a small one |
| Sender's `monthly_income_total` | `10.0` | a small country bankrolls a much larger one |

All four knobs live in a `# --- tune here ---` block at the top of the file. Scaling both shares
together moves the ceiling without moving the point at which the recipient's tax base takes over;
their *ratio* is what decides how small a recipient must be before its own economy is the limit.

Two implementation notes worth keeping:

- The recipient ceiling is its own script value referenced as
  `max = ars_belli_economic_support_recipient_cap`, not arithmetic inlined into `max = { ... }` —
  vanilla only ever passes `max` a plain number or a single value reference.
- Both it and the slider max guard on `exists = scope:recipient`, because `ai_override_value` can
  be evaluated with no recipient in scope.

**Note.** The shares started at `0.25`/`0.25` and were retuned by hand to `1.0`/`10.0`. At 10x
monthly income the sender ceiling is a backstop rather than a working limit — the recipient's tax
base is what actually caps the transfer.

**Deliberate omission.** The ongoing monthly transfer is not re-clamped at runtime: the ceiling
applies at selection time so an agreed figure is never silently rewritten. If a recipient's tax
base shrinks after signing, payment continues at the agreed figure until someone cancels.

---

## HIGH Nr.7 — Personal Union call to arms must be declinable

**Request.** Union partners appeared to be called to arms automatically with no way to refuse;
there should be a yes/no popup like a normal call to arms.

**What was found.** The report was accurate. Vanilla `union.txt` carried
`join_defensive_wars_always = { always = yes }`, commented as the baseline of a union that "will
never change" — a partner was silently pulled into any defensive war of any other partner.

**Solution.** `in_game/common/international_organizations/union.txt` (same-name full-file
replacement, listed in `replaced_files.txt`):

```
join_defensive_wars_always   = { always = no }
join_defensive_wars_auto_call = { always = yes }
```

`auto_call` is the engine's "issue the call automatically, the callee still answers it" setting —
vanilla uses it in `hre.txt` and `ilkhanate.txt`. That is what produces the accept/decline popup.

**Scope decision.** The offensive side is untouched. It is not part of the baseline at all but is
voted through `laws/40_personal_unions.txt` → `union_mutual_offense_law`, where Assured Offense
sets `join_offensive_wars_always` (still auto-joins with no prompt), Automatic Offense sets
`join_offensive_wars_auto_call`, and Possible Offense sets `join_offensive_wars_can_call`. That is
the members' own choice, so it was left alone. There is no defensive equivalent law, which is why
the hardcoded baseline was the only defensive lever.

---

## HIGH Nr.8 — tributaries excluded from location and subject transfers

**Request.** "Transfer Location to Other Subject" should not work on tributaries, and transferring
a subject should be impossible when either the subject being transferred or the country receiving
it is a tributary.

**Solution.** Two same-name full-file replacements (both in `replaced_files.txt`):

- `give_subject_location_to_other_subject.txt` — tributary excluded on **both** ends: its land
  cannot be handed to a fellow subject, and it cannot receive land taken from one.
- `transfer_subject.txt` — tributary excluded as the subject being handed over **and** as the
  country receiving somebody else's subject.

Each check is `custom_tooltip { text = ars_belli_not_a_tributary_tt, NOT = { is_subject_type = tributary } }`
placed in the `enabled` block of the relevant selection stage, so the offending country greys out
in the picker with a stated reason rather than silently vanishing from the list. Shared loc key in
`in_game/localization/english/ars_belli_tributaries_l_english.yml`.

---

## HIGH Nr.10 — throttle Worsen Opinion, and double its effect

**Request.** Limit to once per month, cost a diplomat like Improve Relations, and make it twice as
effective as Improve Relations. It could be mass-sent hard enough to crash a target player.

**Solution.** `in_game/common/country_interactions/worsen_opinion.txt` and
`in_game/common/biases/ars_belli_opinion.txt`:

- **Diplomat cost** — `allow = { scope:actor = { num_of_diplomats >= 1 } }` plus
  `add_diplomats = -1` in the effect, inside the `exists = scope:recipient` guard so a cancelled
  selection is not billed. This is vanilla's own pattern from `form_closer_bond_iroquois.txt`.
  Diplomats regenerate at `monthly_diplomats` up to `max_diplomats`, so the cost is real but
  temporary.
- **Cooldown** — `cooldown = { type = worsen_opinion_cd months = 1 }`. Per actor, not per target:
  a per-target cooldown would still let a player cycle through every country in one sitting.
- **Effect** — opinion goes from −100 to **−200**. Vanilla's Improve Relations caps at +100
  (`opinion_improve_relation` in `biases/00_opinion_hardcoded.txt`), so −200 is exactly twice it.
  It is also the floor of the opinion scale (`OPINION_MAX = 200`).

Cooldown loc keys follow the `<cooldown_type>_cooldown` convention.

---

## MED Nr.11 — base location warscore cost 2 → 2.5

**Request.** Raise it to compensate for the mod's 80% cut to the tax base contribution, so the
early game sits near vanilla while the late game still scales far more gently.

**Solution.** `WAR_WORTH_BASE = 2.5` added to the `NWar` block of
`loading_screen/common/defines/01_ars_belli_defines.txt`, next to the existing
`WAR_WORTH_TAX_BASE_SCALE = 0.04` (vanilla `0.2`).

The two work together: the flat per-location floor carries the early game, where the tax base term
contributes little, while the reduced scale keeps late-game tax base from inflating peace deals.

---

## MED Nr.16 — cap the gold transferable through sell/buy location

**Request.** Limit it to the same amount as Gifts, or to the receiver's or sender's tax base if
that is not possible.

**What the engine allowed.** Nothing script-side. The action is entirely engine-implemented:

- no `country_interactions` file
- no price id in `prices/00_hardcoded.txt` (checked against the full several-hundred-entry list)
- no `diplomatic_costs` entry
- no on_action of its own

Only `ai_diplochance/00_ai_diplochance.txt` and the GUI are moddable. The gift scale itself
(`send_gift`: `scaled_recipient_gold = 2`, `scaled_gold = 1`, `min_scale = 25` — two months of
recipient income plus one of sender) is not reachable from GUI script, so the stated tax base
fallback was used.

**Solution.** `in_game/gui/sell_location_action_view.gui` (same-name full-file replacement), the
price `economy_slider`:

```
max = "[Player.GetTotalTaxBase]"
```

replacing vanilla's `max = "[SellLocationActionView.GetMaxPrice]"`.

**How it got there — three attempts, two of them wrong.** Worth recording, because the failures
were more informative than the fix.

1. `Min_float(FixedPointToFloat(...GetMaxPrice), FixedPointToFloat(...GetSeller.GetTotalTaxBase))`
   — failed. `GetSeller`/`GetBuyer` appear in `diplomacy_l_english.yml` but in **no vanilla `.gui`
   file**: they are localization-only, and localization and the GUI use separate data registries.
2. Same expression with `Player.GetTotalTaxBase` — also failed. `Player` was fine; the
   `FixedPointToFloat` wrapping was rejecting one of its arguments. Vanilla only ever passes
   `GetMaxPrice` to a slider raw, never through a conversion.
3. Bare `[Player.GetTotalTaxBase]` — resolves, no errors in `error.log`.

Both failures logged `FetchData failed for '<expression>' - gui/sell_location_action_view.gui:<line>`,
which is the signal to look for when a GUI expression is suspect. Note that GUI property
expressions are only evaluated when their widget is built, so these surfaced on opening the
window, not at load.

**The clamp is already a min, so no combinator is needed.** Confirmed in game with a literal
`max = 12345` plus a temporary readout of the candidate values: the slider honours its own max,
but the engine applies `GetMaxPrice` as a further clamp on top. The effective ceiling is therefore
`min(tax base, engine max)` without any combinator in the GUI at all — which is what the
`Min_float` attempts were trying and failing to build by hand.

`GetMaxPrice` appears to be **the buyer's treasury**: it differs between selling and buying and
tracks no property of the country's size. So the engine's half of the clamp is an affordability
limit, and the mod's half is the economic one.

**A false trail worth remembering.** The reported symptom was "capped at 100 for any country", and
it was assumed that a failed expression made the slider fall back to a default of 100. That was
never verified and is probably wrong — 100 is a perfectly ordinary total tax base (vanilla uses
100 as its tax base reference in several defines), and because the ceiling is the *acting player's*
tax base it does not change with the counterparty, so a working cap looks identical to a stuck one.
Diagnose this class of bug with a literal value, not by reasoning about defaults.

**Semantic consequence.** The ceiling is the *acting player's* tax base — the seller's when
selling, the buyer's when buying. The other country is not reachable from GUI script. This stays
within the requirement, which allowed either party's tax base.

**Nature of the enforcement.** This is a client-side UI ceiling, not an engine rule — the same
class of enforcement as relabelling the vanilla Economic Support button as against the rules.
Appropriate for a house-rules MP mod; it is not tamper-proof.

---

## MED Nr.17 — −10 prestige to both selling and buying a location

**Status: not implemented. No data-side hook exists.**

**Request.** Charge both parties 10 prestige on a location sale, to stop the mechanic being used
to move funds beyond what Gifts and Economic Support allow.

**Why it is blocked.** Same engine lock as Nr.16 — no country_interaction, no price id, no
`diplomatic_costs` entry — and additionally:

- `on_location_changed_owner` is the **only** ownership hook (root = location, `scope:loser` =
  previous owner, `scope:winner` = new owner). It cannot distinguish a sale from a conquest, a
  peace-treaty transfer, a gift to a subject, or any of the ~155 scripted `change_location_owner`
  calls across 66 vanilla files. Hanging a prestige cost off it would silently tax event-driven
  transfers.
- The GUI can display and constrain, but cannot apply gameplay effects.
- The only engine cost that exists for selling is `SELL_CORE_STABILITY_COST` (−20 stability,
  **seller only**, **core locations only**) — it does not match "−10 prestige to both sides".

**Options if still wanted.** Either deepen `SELL_CORE_STABILITY_COST` (accepting that it hits only
the seller and only core locations), or accept the false positives on the `on_location_changed_owner`
route. Awaiting a decision.

Note that the Nr.16 cap already addresses the underlying money-transfer abuse; the prestige cost
was belt-and-braces on top of it.

---

## Verification

The mod was deployed and EU5 loaded with all of the above. `error.log` for that run showed **no
parse or script errors** from any changed file — `union.txt`, `transfer_subject.txt`,
`give_subject_location_to_other_subject.txt`, `worsen_opinion.txt`,
`ars_belli_no_mercenary_listing.txt`, the economic support script values, or the defines.
`union.txt` loading clean is the meaningful one, since an invalid `join_defensive_wars_auto_call`
key would have thrown there.

GUI property expressions are only evaluated when their widget is built, which is why the Nr.16
failure surfaced only on opening the sell/buy window and not at load. Nr.16 was then verified
in game directly: the slider honours its max, `Player.GetTotalTaxBase` resolves to the correct
value, and `error.log` reports no `FetchData` failures for the final expression.

### Known gaps found while reading the logs (pre-existing, not from this batch)

- `opinion_worsen_opinion` has no localization, so it displays as "Opinion worsen opinion" in the
  opinion breakdown. One line to fix, and it is in a file this batch touched.
- `court_spending_cost_modifier` (`ars_belli_country_changes.txt:45`) and `fort_maintenance_cost`
  (`ars_belli_societal_values.txt:13`) are unknown modifier types — those lines currently do nothing.
- `ars_belli_formable_countries.txt:14` — parse error, so the file likely is not loading at all.
- `ars_belli_mp_limits_events.txt` lines 11 and 30 — invalid `EAudioEventOutcome` value `bad`.
- Five `ars_belli_*` files are missing their BOM (`alliance_overrides`, `remove_head_of_cabinet`,
  `army_auxiliary`, `transport_ships`, `supply_depot_advances`); tolerated with a warning, but
  against the per-file rule the rest of the mod follows.
