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
| 16 | Cap gold transferable via sell/buy location | Done — flat 100 gold; a scaling cap is engine-locked | pending |
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

**Status: done, as a flat 100 gold ceiling. A ceiling that *scales* is impossible — see below.**

**Request.** Limit it to the same amount as Gifts, or to the receiver's or sender's tax base if
that is not possible. Settled on a flat number once both of those turned out to be unreachable:
the point is that gold transfer between players is bounded, not that the bound is proportionate.

**Solution.** `in_game/gui/sell_location_action_view.gui` (same-name full-file replacement), the
price `economy_slider`:

```
max = 100
```

replacing vanilla's `max = "[SellLocationActionView.GetMaxPrice]"`, which is the buyer's entire
treasury. The engine applies `GetMaxPrice` as a further clamp on top of whatever the slider
allows, so the effective ceiling is `min(100, buyer's treasury)`. `ars_belli_sell_location_l_english.yml`
relabels `sell_buy_location_price` from "Total Cost:" to "Total Cost (at most 100@gold!):".

Two caveats on the enforcement. It is a client-side UI ceiling, not an engine rule — the same
class of enforcement as relabelling a vanilla button as against the rules; appropriate for a
house-rules MP mod, not tamper-proof. And `min` is left at vanilla's `[GetMinPrice]`: if that ever
turns out to be negative and unbounded, the reverse direction (paying someone to take a location)
is a second uncapped channel that this does not close.

**Why it has to be a flat number.** The action is entirely engine-implemented:

- no `country_interactions` file
- no price id in `prices/00_hardcoded.txt` (checked against the full several-hundred-entry list)
- no `diplomatic_costs` entry
- no on_action of its own

Only `ai_diplochance/00_ai_diplochance.txt` and the GUI are moddable, and the GUI accepts only a
constant. The gift scale itself (`send_gift`: `scaled_recipient_gold = 2`, `scaled_gold = 1`,
`min_scale = 25` — two months of recipient income plus one of sender) is not reachable from GUI
script in any case, so matching Gifts was out from the start.

**What was tried, and the experiment that settled it.** Four attempts were made at a *scaling*
ceiling on the price `economy_slider`'s `max`. All failed, in two different and easily-confused
ways:

| Attempt | Result |
|---|---|
| `Min_float(FixedPointToFloat(GetMaxPrice), FixedPointToFloat(GetSeller.GetTotalTaxBase))` | logged `FetchData failed` |
| `Min_float(FixedPointToFloat(GetMaxPrice), FixedPointToFloat(Player.GetTotalTaxBase))` | logged `FetchData failed` |
| `Player.GetTotalTaxBase` (bare) | **silent** — slider stuck at 100 |
| `FixedPointToFloat(Player.GetTotalTaxBase)` | **silent** — slider stuck at 100 |

The question was finally settled by rendering four otherwise-identical sliders side by side,
differing only in `max`:

| | `max` expression | Result |
|---|---|---|
| C | `Multiply_float(SellLocationActionView.GetMaxPrice, 0.5)` | stuck at 100 |
| D | `FixedPointToFloat(Player.GetTotalTaxBase)` | stuck at 100 |
| E | `FixedPointToFloat(GetPlayer.GetTotalTaxBase)` | stuck at 100 |
| F | literal `9999` | works |

**C is the decisive one.** It held the source constant — vanilla's own `GetMaxPrice`, known to
work — and varied only one thing, wrapping it in arithmetic. It still failed. So the `max`
property accepts **only a literal or a bare getter on the view's own datacontext**, and no
computed expression at all. `SellLocationActionView` exposes no tax-base getter (`CanSend`,
`GetAcceptance*`, `GetConfirmMessage`, `GetLocationsSortSearch`, `GetMax/MinPrice`,
`GetPossibleLocations`, `GetTotalPrice`, `IsBuying`, `IsSelected`, `OnSend`, `SetTotalPrice`,
`ToggleLocation`), and nothing can transform a value into one. Therefore no tax-base ceiling can
be expressed here.

Clamping the committed value instead of the range is not available either: the commit path is
`onvaluechanged = "[SellLocationActionView.SetTotalPrice]"`, with no scripted intermediary to
wrap.

Slider F is also what makes the shipped fix work: a literal resolves, so a literal is what got
used. Note that the fallback for a *rejected* `max` happens to be 100 as well, which means the
shipped `max = 100` cannot be distinguished in game from a broken one. If this number is ever
changed, verify with a value that is not 100.

**Two silent-failure traps worth carrying forward.**

1. A `ranged_slider` whose `max` assignment is rejected keeps its built-in default of **100** and
   logs nothing. A clean `error.log` does *not* mean a GUI property took effect. This is what
   produced the phantom "capped at 100 for any country", and it survived three wrong diagnoses
   (including one where the reported 100 was wrongly explained as the player's own tax base —
   it was 16780).
2. `FixedPointToFloat` applied to something already a float — `GetMaxPrice` — *does* log
   `FetchData failed`, and kills the entire enclosing expression, not just that term.

The method that worked, and should be reached for first next time: bisect with parallel widgets
and a literal control, rather than reasoning about which sub-term is wrong.

**Also disproved along the way:** `GetSeller` / `GetBuyer` appear in `diplomacy_l_english.yml` but
in no vanilla `.gui` file — localization and the GUI use separate data registries, so loc-only
functions cannot be called from GUI expressions.

**History.** The tax-base version of this was reverted in `051f4ed` on the finding above, then
re-added in the flat form once it was decided a constant bound is enough. `replaced_files.txt`
carries `in_game/gui/sell_location_action_view.gui`, so the one-line `max` change has to be
reapplied on every vanilla update of that file.

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
was belt-and-braces on top of it. Also note the asymmetry between the two: Nr.16 is satisfiable
because the GUI can *constrain* a value, while Nr.17 needs the GUI to *apply an effect*, which it
cannot do.

---

## Verification

The mod was deployed and EU5 loaded with all of the above. `error.log` for that run showed **no
parse or script errors** from any changed file — `union.txt`, `transfer_subject.txt`,
`give_subject_location_to_other_subject.txt`, `worsen_opinion.txt`,
`ars_belli_no_mercenary_listing.txt`, the economic support script values, or the defines.
`union.txt` loading clean is the meaningful one, since an invalid `join_defensive_wars_auto_call`
key would have thrown there.

GUI property expressions are only evaluated when their widget is built, which is why the Nr.16
failures surfaced only on opening the sell/buy window and not at load — and, worse, why some of
them never appeared in the log at all. See Nr.16 for the two silent-failure modes and the
parallel-widget bisect that finally settled it.

The shipped Nr.16 `max = 100` has **not** been re-tested in game since it was re-added; it rests
on slider F of that bisect, which established that a literal `max` resolves. Because a rejected
`max` also falls back to 100, this particular value cannot be told apart from a failure by
looking at the slider, so there is nothing useful to observe anyway — the thing to check is that
the sell/buy window still opens with a clean `error.log`.

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
