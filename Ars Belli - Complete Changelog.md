# Ars Belli Mod — List of Changes

Here you can find a detailed list of all changes the Ars Belli Mod makes over the base game. The
focus here is Gameplay Changes; the Starting Setup changes and country Unique Content are not listed
here in full, but these can be easily seen in-game on the world map.

**Mod version:** game.1.3.11.mod.17 | **Supported game version:** 1.3.\*
**Compiled:** 28 August 2026 (cumulative section verified against the mod files on that date)
**Our Discord Server:** https://discord.gg/e7T8Ju4Ewv

---

## Table of Contents

**[Cumulative Changelog](#cumulative-changelog)**

- [1. Game Rules](#1-game-rules)
- [2. Multiplayer Power Ranking](#2-multiplayer-power-ranking)
- [3. Diplomatic Limits](#3-diplomatic-limits)
- [4. New Diplomatic Actions](#4-new-diplomatic-actions)
- [5. Changes to Vanilla Diplomatic Actions](#5-changes-to-vanilla-diplomatic-actions)
- [6. Enforce Peace](#6-enforce-peace)
- [7. Personal Unions](#7-personal-unions)
- [8. War, Wargoals and Peace](#8-war-wargoals-and-peace)
- [9. Forts and Sieges](#9-forts-and-sieges)
- [10. Supply and Logistics](#10-supply-and-logistics)
- [11. Mercenaries](#11-mercenaries)
- [12. Crusades and Jihads](#12-crusades-and-jihads)
- [13. Economy and Gold-Transfers](#13-economy-and-gold-transfers)
- [14. Buildings and Reforms](#14-buildings-and-reforms)
- [15. National Flavour](#15-national-flavour)
- [16. Pops, Map and Campaign Setup](#16-pops-map-and-campaign-setup)
- [17. UI and Quality of Life](#17-ui-and-quality-of-life)
- [18. Compatibility](#18-compatibility)

**[Release History (Patchnotes)](#release-history-patchnotes)**

- [game.1.3.11.mod.15](#game1311mod15-current)
- [game.1.3.11.mod.14](#game1311mod14)
- [game.1.3.11.mod.13](#game1311mod13)
- [game.1.3.11.mod.12](#game1311mod12)
- [game.1.3.11.mod.11](#game1311mod11)
- [game.1.2.5.mod.10](#game125mod10)
- [game.1.2.5.mod.9](#game125mod9)
- [game.1.2.4.mod.8](#game124mod8)
- [game.1.2.4.mod.7](#game124mod7)
- [game.1.2.4.mod.6](#game124mod6)
- [game.1.2.4.mod.5](#game124mod5)
- [game.1.2.2.mod.4](#game122mod4)
- [game.1.2.2.mod.2](#game122mod2)
- [game.1.2.2.mod.1](#game122mod1)
- [Alpha builds](#alpha-builds-00-alpha1-through-00-alpha13)

---

# Cumulative Changelog

Vanilla values are given in brackets where they are known.

## 1. Game Rules

Chosen at campaign start.

- **Ars Belli: Multiplayer Mechanics** — default **ON**. Master switch for the whole MP ranking
  system: the monthly score calculation, the AP/DP/Guarantee limits, the top-bar display, the rank
  label and tier-list panel, and the foreign country rank display. Turned OFF, every other Ars Belli
  feature (forts, peace, unions, wargoals, economy, actions, setup) still works, but diplomacy
  behaves like vanilla.
- **Multiplayer Diplo Limits Targets** — players only (default) or all countries. In players-only
  mode AI partners contribute 0 to a player's point totals.
- **Over-alliance-limit penalty** — default **OFF**. Sits directly next to the Diplo Limits Targets
  rule.
- **Great Power count** — default 6, selectable 0 to 12.
- **Major Power count** — default 6, selectable 0 to 12.
- **Alliance Point (AP) limit** — default 7, selectable 1 to 20. [vanilla diplomatic capacity
  baseline is 6]
- **Defensive Point (DP) limit per tier** — Great Power 1, Major 2, Normal 3, Small 4, Minor 5, each
  selectable, plus a global −2 to +2 modifier rule.
- **Alliance Point cost per tier** — allying a Great Power costs 5, a Major 4, a Normal 3, a Small 2,
  a Minor 1. All selectable.
- **Small power threshold** — a country is Small below 50% of the average power score (selectable 20%
  to 80%).

## 2. Multiplayer Power Ranking

- Countries are sorted into five tiers — **Great Power, Major Power, Normal, Small, Minor** — by a
  Power Score recalculated every month.
- The Power Score is the sum of:
  - population (accepted-culture population)
  - control-scaled population (weighted ¼)
  - subject population (weighted 50%)
  - economy (tax base ÷ 500)
  - trade (monthly trade income ÷ 200)
  - manpower (max manpower ÷ 25)
  - army (regular army size ÷ 10)
  - sailors (max sailors ÷ 50)
  - heavy ships (count ÷ 50)
  - galleys (count ÷ 200)
- The displayed score is smoothed over roughly 12 months so it does not swing from month to month;
  the tooltip also shows the projected (instant) score it is heading toward.
- Ranks are assigned at game start, not only after the first monthly tick.
- Click the rank label in the top bar to open a tier-list panel listing every country in each tier
  with flag, name and score. Rows are clickable and open that country's diplomacy panel. No entry
  cap.
- The panel and the rank label toggle are **per-player** in multiplayer: one player opening the panel
  no longer opens it for everyone connected.
- The foreign country diplomacy panel shows that country's MP rank, power score, and its AP / DP /
  Guarantee usage and limits.
- The rank tooltip carries the full score breakdown plus per-tier limits and counts.

## 3. Diplomatic Limits

Alliance, Defensive and Guarantee points.

- Alliance Points (AP) and Defensive Points (DP) cap how tangled the diplomatic web can get. Each
  partner costs points according to its tier (see game rules).
- A country you are both allied with and in a defensive league with counts **once** — Defensive
  Points take priority over Alliance Points.
- Personal unions count as defensive relations, and do not double-count if the partner is already in
  a defensive league with you.
- Personal unions with an offensive policy active (Possible / Automatic / Assured Offense) consume
  **Alliance** Points instead of Defensive Points, on both sides. Purely defensive unions still cost
  DP.
- Colonial nations and their overlord consume Alliance Points on both sides (each pays the other's
  slot cost). In players-only mode, AI partners contribute 0, so an AI overlord with an AI colonial
  nation costs nothing.
- Economic Support costs a Defensive Point to both the sender and the recipient (flat 1 each, not
  scaled by tier), deduplicated against an alliance or defensive league with the same country.
- Only Great Powers and Major Powers may give Guarantees; everyone else has 0 guarantee slots. Each
  guarantee counts as 1 regardless of rank.
- **Two Great Powers cannot be allied.** An existing alliance expires as soon as both partners are
  Great Powers. This replaces vanilla's hegemon-to-hegemon block, so two hegemons may ally as long as
  they are not both GPs.
- The Defensive Point display shows the actual, uncapped value so overflow is visible; overflowing DP
  spills into AP.
- Mutable alert when you are over the alliance limit.
- Over-alliance-limit penalty (OFF by default): −90% tax income, −90% selling efficiency (trade
  income), −90% research speed, −40% land morale, and blocked from declaring war.

## 4. New Diplomatic Actions

### Break Others' Guarantee

- Forcibly remove a guarantee another country has placed on you. Requires being at peace and creates
  a truce on use.

### Worsen Opinion

- Worsens **your** opinion of another country by −200, decaying over 10 years. −200 is twice the
  magnitude of vanilla's Improve Relations cap and is the floor of the opinion scale.
- Costs one diplomat and is limited to one use per month per actor, so it can no longer be spammed at
  another player (unthrottled use could crash the target's client).

### "Pay for" access actions (five new actions)

- Pay for Military Access, Fleet Basing Rights, Trade Access, Food Access and Fondaco Rights, each
  with a gold slider so you can sweeten the offer.
- The slider opens at 12 months of the recipient's income, minimum 0, maximum your own treasury. Gold
  transfers from you to them on acceptance.
- Pay for Military Access and Pay for Fleet Basing Rights auto-accept unless the AI is your rival
  (rivalry overrides any amount of gold). The other three scale AI acceptance with the offered gold
  (8 acceptance points per month of the recipient's income offered).
- Country pickers are filtered to countries within diplomatic range.
- The vanilla request paths for military access and fleet basing are untouched and keep their normal
  favour-based flow.
- The AI never proposes these actions itself.

### Send Economic Support (Ars Belli version)

- Pick a country and a monthly sum of gold; the recipient gets an accept/decline popup before
  anything starts.
- The amount is capped at the recipient's tax base and never exceeds ten months of the sender's
  income (never below 1 gold). The slider opens at half the cap.
- Costs both sides a Defensive Point and −0.10 monthly diplomats for as long as the arrangement
  stands.
- A country can only receive Economic Support from **one patron at a time**.
- Breaks on war between the two parties and is annulled by a peace treaty. Either side can end it
  early: Cancel for the sender, Refuse for the recipient.
- The vanilla Send Economic Support is engine-implemented and cannot be removed, so it is relabelled
  "(AGAINST THE RULES)" to steer players onto the new action.

### Forgive Antagonism (two friendly actions)

- **Forgive half antagonism** and **Forgive 200 antagonism** write off antagonism you hold against
  another country — half of the pool, or a flat 200 (never more than is actually there).
- Each requires at least 10 antagonism toward that country, each has its own 10-year cooldown, and
  using both is cumulative.

### Dismiss Head of Cabinet (character interaction)

- Returns your current Head of Cabinet to a regular cabinet seat for 5 government power.

**Force Break Union** is in [section 7](#7-personal-unions); **Enforce Peace** is in
[section 6](#6-enforce-peace).

## 5. Changes to Vanilla Diplomatic Actions

### Opinion and alliances

- Alliances no longer break when opinion turns negative; opinion is no longer an alliance
  precondition.
- Defensive leagues no longer require non-negative opinion between the parties, either to form one or
  to join one.
- Vision Sharing no longer requires non-negative opinion on either side. It otherwise mirrors the
  standard alliance preconditions (no blocked treaties, not subjects, not rivals, not in a coalition
  against each other).

### Guarantees

- Only Great Powers and Major Powers can offer a guarantee; only Normal, Small and Minor countries
  can be guaranteed or request one. [vanilla used the in-game country rank levels]
- The +50 opinion requirement on the guaranteed country is removed.
- A guarantee never expires on its own: neither a change in either side's power rank nor a rivalry
  between them ends it. It lasts until it is cancelled, broken, or ended by war, subjugation or a
  peace treaty. [vanilla expired it on rank changes and rivalry]
- Cancelling or breaking a guarantee no longer adds a truce, and a guarantee that ends between
  two countries of equal rank no longer upgrades itself into an alliance.

### Rivals

- No cooldown on removing a rival, so rivals can be swapped freely. [vanilla: 60 months]

### Institution-spread exploits closed

- Alliance no longer spreads institutions between the parties.
- Fleet Basing Rights no longer spreads institutions between the parties.
- Knowledge Sharing is fully disabled — its severe institution-spread payload was a major MP exploit.
  The relation type is kept for save compatibility, but all UI entry points are hidden and the
  payload is removed.

### Relations and actions disabled

- **Isolate from Allies** (break another country's alliances with favours) is disabled.
- **Corrupt Officials** is disabled.
- **Sow Discontent** is disabled.
- **Scutage** is hidden and disabled.
- **Red Turban Rebellions "Demand Annexation"** is disabled.
- **Intervene in War** is removed mod-wide (see [section 6](#6-enforce-peace)).
- **Threaten War** is removed for Great Powers, pending confirmation that it is not bugged. Regional
  powers keep it.

### Great Power and Regional Power status

These are vanilla's own rank modifiers, rewritten.

- **Great Power** now grants: +2 diplomatic capacity, +0.2 monthly diplomats, +10 power projection,
  +0.1 monthly prestige, +10% court spending cost. It no longer grants vanilla's +50% mercenary
  range, +10% creditworthiness, +2 max bonds, or the AI alliance/union weighting; and it no longer
  grants Enforce Peace, Intervene in War or Threaten War.
- **Regional Power** keeps its vanilla bonuses but loses Enforce Peace and Intervene in War.

### Espionage

- Steal Technology costs 100 spy network. [vanilla 75]
- Stealing maps generates 1 antagonism. [vanilla 10]

### Subjects

- Tributaries are excluded from **Transfer Location to Other Subject** on both ends: their land
  cannot be handed to another subject, and they cannot receive land taken from one.
- Tributaries are excluded from **Transfer Subject** on both ends: a tributary cannot be transferred
  to another country, and cannot be given somebody else's subject.
- In both cases the country greys out with a tooltip explaining why, instead of disappearing from the
  picker.

## 6. Enforce Peace

Rebuilt from scratch.

- **Intervene in War is removed mod-wide** — it resolved with no input from the countries actually at
  war.
- Vanilla Enforce Peace is replaced by a new Enforce Peace action that covers every case Intervene
  used to.
- **The defender is asked first.** Only if the defender accepts is the demand put to the attacker:
  - attacker accepts → the war ends in a white peace;
  - attacker refuses → the enforcer joins the war on the defender's side.

  Asking the defender first is the point: it stops Enforce Peace being used to rescue a losing
  attacker over the defender's objection.
- **Player-only.** The AI never starts an Enforce Peace itself: a refusal by the attacker drags the
  enforcer into the war, which is not a commitment the AI can judge.
- Usable by Great Powers and Major Powers (Ars Belli ranks, not vanilla's), and by any country at all
  when either leader of the war is its rival.
- The Enforce Peace button on the war view is always shown; when a requirement is unmet it greys out
  with a tooltip naming what is missing, instead of disappearing.
- The "a rival is at war" alert opens Enforce Peace instead of Intervene in War.
- The HRE Emperor no longer gets the vanilla Enforce Peace and Intervene in War, and uses the same
  Enforce Peace as everyone else.
- The prestige penalty for refusing an enforced peace was removed.
- The vanilla Enforce Peace tooltip is relabelled to warn that ending a war without the defender's
  approval is against the rules.

## 7. Personal Unions

- **Force Break Union:** junior partners and any member of a federal union get a button in the union
  panel that rolls a random new ruler (matching the country's culture and religion) and instantly
  breaks the union. Costs 20 legitimacy, 50-year cooldown, click-and-hold to confirm.
- Union partners are no longer dragged into each other's defensive wars automatically. They now
  receive a call to arms they can accept or decline, like any other ally. [vanilla: silent auto-join,
  no prompt]
- The offensive side is unchanged and still follows the union's Mutual Offense policy (Possible /
  Automatic / Assured Offense), which the members vote on.

## 8. War, Wargoals and Peace

### Ticking warscore and peace offers

- Ticking warscore for holding the wargoal is capped at **36**. [vanilla 25] It was cut back from 50
  because occupations now give double warscore. The rate is unchanged at +1 per month.
- Peace offers can be sent at **any** warscore. [vanilla required at least +10]

### Location warscore

- Tax-base contribution to a location's warscore cost cut to 20% of vanilla (scale 0.04, vanilla
  0.2), so late-game tax base no longer inflates peace deals.
- Flat base cost per location raised to 2.5 [vanilla 2] to compensate, keeping the early game close
  to vanilla.
- Lack of control on a location contributes 0.2 / 0.4 / 0.6 / 0.8 / 1.0 / 1.0 to warscore across ages
  1–6. [vanilla 0.1 / 0.2 / 0.4 / 0.6 / 0.8 / 1.0] Unoccupied land is worth less, occupied land more.

### Casus belli and wargoal costs

- **Coalition CB** (superiority_coalition): attacker conquer/subjugate cost 0.75, defender 1.25.
  [vanilla 1.0 / 1.0]
- **Take Down Hegemon CB** (take_capital_imperial): both sides 0.60. [vanilla 0.25 / 0.25 — both
  sides were heavily discounted]
- **Heretic wargoal** (superiority_heretic): attacker 1.1, defender 1.0. [vanilla was loaded +75% /
  +20%]
- **Religious Conquer Province:** 1.0 / 1.0, i.e. neutral.
- **Japanese civil-war wargoals** (Nanbokuchō, Sengoku): 0.90 conquer and subjugate cost on both
  sides, so Japan's internal wars resolve faster than a foreign conquest would.
- **Deus Vult crusade CB** is usable from game start by every country. The CB is hardcoded to require
  the Deus Vult advance, so every country is granted that advance at game start, with a monthly
  catch-up for nations formed later.

## 9. Forts and Sieges

### Fort limit

Cut hard, to make wars less static.

- Base fort limit **5**. [vanilla 1 base, before other sources]
- Fort techs give a flat **+3** each, six techs in total. [vanilla +10% fort limit modifier each]
- Locations give **+0.05** each (1 per 20 locations). [vanilla 1 per 10]
- Country rank gives no fort limit. [vanilla: empire +2, kingdom +1]
- Cities give no fort limit. [vanilla +1 per city]
- Nobility power grants fort limit as in vanilla — the mod's earlier override of the nobles estate
  has been retired.

### Over the fort limit

- −2% fort defense for every percentage point over the limit, capped at −100% (the cap is reached at
  50% over the limit). [vanilla −1% per point, and it also dragged the country's societal values
  toward belligerent/defensive]
- A popup alert fires monthly while you are over the limit. Toggleable, default ON; the popup itself
  tells you where to mute it.

### Defensiveness / Offensiveness societal value

- **Defensive side:** +50% fort defense, +25% fort limit [vanilla +50%], +40% fort maintenance
  efficiency, +20% defence importance, and a new scaling −10% siege ability. It no longer gives a
  combat speed bonus, an army movement speed penalty, or reinforcement speed.
- **Offensive side:** −20% fort defense [vanilla −50%], +20% siege ability [vanilla +10%], +20%
  assault ability [vanilla +10%], +25% logistics distance [vanilla +50%], −20% defence importance. It
  no longer gives army movement speed.

### Fort buildings

- **Stockade:** nobles estate power 10 (from 5), local unrest −5% (from −2.5%), garrison 200 (from
  100), employed soldiers 200 (from 250), goods maintenance halved.

## 10. Supply and Logistics

- Supply depot capacity per advance bumped 100× (25 → 2500 per advance).
- Base supply depot capacity raised by +4,950 over the vanilla baseline.
- Logistic units carry 3.5× vanilla food. Displayed food storage across ages 1–6: 350 / 700 / 1050 /
  1400 / 1750 / 2100. The bump is applied to the army auxiliary category, so every tier from camp
  followers to logistics corps inherits it.
- Transport ships buffed to carry food in line with the logistics units age for age: 300 / 700 / 1200
  / 1800 / 2750 / 3600 across ages 1–6.
- **Deposit Food** on an army now deposits 50% of the army's food fraction. [vanilla 25%]
- Supply depots stash a 50% share for armies. (This was 10% in vanilla when the change was made; the
  base game has since moved to the same value.)
- **Perform Army Logistics** is relabelled as BANNED in its name and tooltip — the automation is
  exploitable and does not work correctly in the current build.

## 11. Mercenaries

### Offering your own armies as mercenaries is removed

- Renting your own regiments out put the mercenary modifiers on the hirer while the owner kept
  drawing the full hire price — between two players that was a gold transfer that paid a profit.
- The **Become Mercenary** button in the army builder, which opened the "Set Up The Mercenary
  Contract" window, is gone.
- The **Make available for hire** unit action no longer appears anywhere it used to render: the
  single-unit action bar, a multi-unit selection, the pinned quick-action row, or the right-click unit
  menu. It is also unreachable by the AI and by delegation automation.
- Delisting a unit already on the market still works.

### Mercenary availability and cost nerfed

- Mercenary hire premium 1.0 of the unit's hire cost. [vanilla 0.4]
- Hiring prisoners costs 1.0 of the unit's hire cost. [vanilla 0.25]
- Base mercenary range halved to 250. [vanilla 500]
- Country rank no longer extends mercenary range: empire −100%, kingdom −50% and duchy −25% cancel
  out the vanilla rank bonuses, and Great Power status no longer grants +50% range.
- High stability now reduces available mercenaries, scaling up to −50%.
- Mercenary availability from control is a flat −50% scaled by a location's control, replacing
  vanilla's version that only bit above 50% control.

## 12. Crusades and Jihads

- Valid crusade targets are now any heathen kingdom or empire whose capital lies in Europe, North
  Africa or the Middle East, in addition to vanilla's holders of Catholic holy sites.
- Crusades and Jihads share a global **100-year** cooldown — one per religion, worldwide, not per
  country.

## 13. Economy and Gold-Transfers

- **Selling or buying a location is capped at 100 gold**, so a land sale can no longer move a
  treasury between players. [vanilla let the buyer pay out its entire treasury]
- **Works of art:** countries are far less willing to buy one offered to them. They now weigh the
  price against their own income, a full treasury tempts them much less (the "wealthy buyer" bonus is
  halved and its bar raised from 24 to 36 months of income), a new penalty band hits art quality
  40–69, and the below-40 band is deepened. Vanilla ignored the price entirely, so any rich AI would
  buy almost anything at whatever the game valued it at.
- Destroying a market costs 10 stability. [vanilla 50 stability plus 25 prestige]
- Economic Support and Gifts remain the intended gold-transfer routes (see
  [section 4](#4-new-diplomatic-actions)).
- **Japanese court economy:** the honour prices of the imperial court, shogun court and religious
  sect actions are retuned — claims 40 [50] and marriages 25 [40] from the imperial court get
  cheaper, while appeasing the nobles, raising levies, raising tax income and demanding extra payment
  from the shogun court cost 25 to 100 [10].
- **Age of Discovery** grants +50% colonial maintenance efficiency, in place of vanilla's −25%
  colonial maintenance cost.

## 14. Buildings and Reforms

- **Order Headquarters:** local manpower buffed to 50 (from 20), employed clergy raised to 100 (from
  50).
- **Kurultai:** local manpower nerfed to 25 (from 50), employed soldiers to 2,500 (from 5,000), and
  no longer buildable in towns or cities. Existing ones in cities keep working.
- **Order Commandery:** local manpower nerfed to 2 (from 5), employed clergy to 200 (from 400), and
  no longer buildable in rural settlements. Existing rural ones keep working.
- **Church School:** +5 maximum literacy for burghers, laborers, soldiers and peasants, +0.1 monthly
  literacy and +1% local pop conversion speed.
- **Manden Kurufa reform** (Mali traditions) is removable.
- **Form China (CHI):** requires 70% of the listed locations across the four Chinese regions, forms
  as an empire-rank monarchy. Dead Middle Kingdom / Red Turban gating removed.
- New culture buildings and event-only buildings, plus a set of vanilla unique buildings marked
  obsolete.
- New estate privileges and government reforms (general, China, Europe, India), and new levies.

## 15. National Flavour

Only the mechanical highlights are listed; the unique content of individual countries is best seen
in-game.

- **Hordes reworked:** steppe-horde advances and government content, an emphasis on raiding, and
  unavoidable nerfs to horse archers.
- **Venice and the rest of Italy** get small adjustments, with their own advances and unit types.
- **New unique unit types by age and region** — knights, Byzantine units, bedouin cavalry, Indian and
  Italian units — instead of flat numerical buffs for countries that need a leg up.
- **Regional advancement sets** across China, India, Indochina, Indonesia, Anatolia, the Caucasus,
  Ruthenia, Arabia, Persia, Central Asia, Tibet, Xinjiang, the Urals, Mongolia, Madagascar and
  Africa.
- **Japan:** a Shinto religion with religious-faction actions, and clan-level unique advances.
- **Scotland:** the Scottish Morale advance also grants +10% heavy infantry power and +10% light
  infantry power on top of its +15% land morale, and the Scottish civil war modifiers no longer
  abolish parliament or cut parliament support.
- **Ilkhanate:** its own actions and casus belli.
- **Genoa and Gazaria:** the Genoese Galley advance is open to any Ligurian country, not just Genoa,
  and Gazaria's two trade advances require Ship Building rather than Abacus and Lieutenancy.
- **Italian republics:** the Consiglio Maggiore law pushes centralization and carries a small peasant
  satisfaction penalty, in place of estate-power bonuses.
- **Cossacks:** the Cossack Black Sea Raids privilege grants privateering, slave raiding, double
  loot and +2.5% desired soldier pops.
- **Byzantium:** the Magister Militum bureaucracy is toned down — +0.1 monthly army and navy
  tradition (was +0.2) and +10 general and admiral training (was +25). Its military tactics bonus and
  its legitimacy and noble-power drawbacks are unchanged, and the other nine Byzantine bureaucracies
  are left as the base game has them.
- **Miaphysite and Nestorian churches** have two religious aspects of their own. *Martyrs' Shield*
  gives +10% military tactics, +5% morale recovery in friendly territory and monthly progress toward
  Quality; *Universal Learning*, available to theocracies, gives +5 maximum literacy for burghers,
  laborers, soldiers and peasants and monthly progress toward Innovative.
- **Christiana Pietas** (Catholic) gives +1 heathen tolerance and +0.01 monthly literacy. [vanilla +2
  heathen tolerance and no literacy]

## 16. Pops, Map and Campaign Setup

- **India and China** have dozens of playable tags, many with their own advancement sets based on the
  countries' original EU4 national ideas.
- **Japan is fully playable** with over 30 clans, loosely based on the Sengoku Jidai period.
- **West and East Africa expanded:** several tribal societies of pops are playable as settled
  countries, with their own advances.
- **The Middle East** is reworked around a much less dominant Mamluks, with many formable tags in
  Arabia and Persia — Hejaz, Najd, Fars, Khorasan and more.
- **Central Asia** gets many playable tags, hordes with proper advancement sets, and formables such
  as Bukhara, Greater Khorasan and a reworked Mongol Empire.
- **Europe** is reworked so HRE minors are more viable and France and Castile less overbearing, with
  many small tweaks to the starting balance — the Hundred Years War (more French vassals and
  appanages, an independent Burgundy and Flanders, a stronger Scotland), Spain, Bohemia and Eastern
  Europe.
- Pop adjustments across Asia: Timurids, Delhi, Khmer, Ayutthaya, Ming (Middle Kingdom) and the
  Lordship of the Pale, plus pop changes to fill resource gathering operations.
- New markets, including Lyon, Magdeburg, Strasbourg, Kokand, Qingdao, Changsha, Xiangyang, Muping,
  Shybyndy and Abagaita.
- Around 160 town and city setup changes: new towns across Germany, France, the Low Countries, Russia
  and the Sahel; several towns promoted to cities (Arles, Avignon, Dijon, Lyon, Munich, Gao, and
  Strasbourg as a German city); prince-elector capitals (Meissen, Kassel) and free cities given
  proper town setups.
- Around 215 new road connections, mostly in Burma and Southeast Asia, and around 180 regional
  development adjustments.
- Custom building setups per culture and region, and map colour and country-name changes.
- **The Black Sea and the Pontic steppe** are rebuilt: Kaffa is the Genoese emporium it was (around
  33,500 people, Ligurian, Greek, Armenian and Tatar burghers, and a Caucasian and steppe slave
  population), Gazaria is a merchant republic at duchy rank with trade offices across its Black Sea
  and Caspian network and a galley barracks in Kaffa, Bakhchysarai (Qirq Yer) is the Crimean Horde's
  capital, and the Dnieper and Donets steppe is Cossack rather than Tatar. Zaporozhia is a duchy, and
  the Crimean Horde and Circassia get towns of their own.

### Formables

- **Hindustan** — any Indian-culture country of South Asia, the whole subcontinent at 80% ownership,
  tier 5. **Delhi** — any Muslim country of Indian, Iranian, Mongolian or Turkic culture that owns
  Delhi; forming it moves the capital there.
- **Circassia, Georgia and Armenia** are formable in the Caucasus.
- Indian regional formables sit at tier 4 (Bengal, Gujarat, Rajputana, Rajastan, Nepal, Punjab,
  Bahmanis, Deccan, Maratha, Nagavanshi, Ceylon), with Hindustan and the Mughals at tier 5.
- **China** is tier 5 at 80% of its locations; the four split-empires — Southern Song, Cao Wei, Shu
  Han and Eastern Wu — are tier 4.
- **Pontus** is tier 4, open to Pontic Greek and Gothic culture, and always requires owning
  Trebizond. Forming it never demotes a country already above kingdom rank.
- **Vijayanagar** is deliberately not formable, and its tooltip says so.

## 17. UI and Quality of Life

- Top bar shows your Alliance Points, Defensive Points and Guarantee Relations next to the current
  age, with overflow-safe formatting.
- The rank label in the top bar opens the tier-list panel (per-player in MP).
- Foreign country panel shows the viewed country's MP rank, power score, and point usage and limits.
- Alerts: mutable alert when over the alliance limit; toggleable monthly popup when over the fort
  limit (default ON).
- Enforce Peace button on the war view is always visible and explains what is missing when
  unavailable.
- Vanilla actions that are against the house rules are relabelled in-game (Send Economic Support,
  Perform Army Logistics, Enforce Peace tooltip).

## 18. Compatibility

- Supported game version: **1.3.\*** (mod version game.1.3.11.mod.16).
- Base-game files were refreshed to the 1.2.5 baseline (pops, town setups, country, market,
  institution, disease and development setup, diplomacy, wars and localisation) and to the 1.3
  baseline for the Holy Roman Empire organisation definition.

---

# Release History (Patchnotes)

The same notes ship with each GitHub release; `versionsChangelog.md` in the repository is the source.

## game.1.3.11.mod.17 (current)

**Changes to Vanilla Diplomatic Actions**

- Guarantees no longer disappear on their own. The automatic expiry check was ending guarantees
  between countries that were still perfectly eligible for one, so a guarantee could evaporate
  shortly after it was signed. A guarantee now lasts until it is cancelled, broken, or ended by war,
  subjugation or a peace treaty

## game.1.3.11.mod.16

**National Flavour**

- The Miaphysite and Nestorian churches finally get their two religious aspects. Martyrs' Shield —
  +10% military tactics, +5% morale recovery in friendly territory and monthly progress toward
  Quality — and Universal Learning, for theocracies — +5 maximum literacy for burghers, laborers,
  soldiers and peasants, and monthly progress toward Innovative. Both were already named and
  described in-game but were never defined, so neither religion could actually take them
- Christiana Pietas now also grants +0.01 monthly literacy, and its heathen tolerance is cut to 1 [2]
- Genoese Crossbowmen upgrade into Late Genoese Crossbowmen again — the upgrade path pointed at a
  unit that does not exist, so the line dead-ended

**Buildings and Reforms**

- Church School: its literacy bonus was written on the wrong scale and did effectively nothing. It
  now gives +5 maximum literacy to burghers, laborers, soldiers and peasants, alongside its existing
  +0.1 monthly literacy and conversion speed

**Economy and Gold-Transfers**

- Age of Discovery grants +50% colonial maintenance efficiency in place of −25% colonial maintenance
  cost

**Crusades and Jihads**

- The Crusade and Jihad buttons now spell out the 100-year global cooldown instead of showing a raw
  text key

**UI and Quality of Life**

- The power rank tooltip is no longer cut off part-way through its last line
- The tier-list panel's open and close buttons have tooltips

## game.1.3.11.mod.15

**National Flavour**

- Byzantium and Trebizond get their bureaucracies back. The mod's Byzantine bureaucracy file shared a
  name with the base game's, so it replaced that file wholesale and deleted nine of the ten Byzantine
  bureaucracies — Honorary Titles, Court Eunuchs, Ritualistic Court, Sixty Books of the Basilika,
  Romanitas, Imperial Senate, Kephalai, Themata and Allelengyon. All ten are available again, and
  only the Magister Militum rebalance is applied on top

## game.1.3.11.mod.14

The Black Sea gets the attention this time — Gazaria, the Crimean Horde, Circassia and the
Zaporozhian steppe are rebuilt from the ground up — and the Indian and Chinese formable tiers are
sorted out.

**Formables**

- Hindustan is formable by any Indian-culture country of South Asia: the whole subcontinent at 80%
  ownership, tier 5
- Delhi is formable by any Muslim country of Indian, Iranian, Mongolian or Turkic culture that owns
  Delhi, and moves its capital there on forming
- Circassia, Georgia and Armenia added as Caucasus formables
- Indian regional formables — Bengal, Gujarat, Rajputana, Rajastan, Nepal, Punjab, Bahmanis, Deccan,
  Maratha, Nagavanshi and Ceylon — all moved to tier 4; Hindustan and the Mughals sit at tier 5
- China raised to tier 5 and 80% of its locations; the four split-empires (Southern Song, Cao Wei,
  Shu Han, Eastern Wu) moved to tier 4
- Pontus moved to tier 4, opened to Gothic culture, and always requires owning Trebizond; forming it
  no longer demotes a country that is already above kingdom rank
- Sun Quan renamed Southern Song
- Vijayanagar is explicitly disabled and says so in its tooltip, instead of sitting in the list as an
  unformable entry

**Pops, Map and Campaign Setup**

- the Zaporozhian steppe is Cossack: the Tatar peasants and tribesmen across the Dnieper and Donets
  steppe are replaced by Orthodox Cossack pops, and the Ruthenians living there are peasants rather
  than slaves
- Kaffa rebuilt as the Genoese emporium of the Black Sea, around 33,500 people — Ligurian, Greek,
  Armenian and Tatar burghers, an Armenian, Greek and Latin clergy, and a Caucasian and steppe slave
  population
- Bakhchysarai (Qirq Yer) grown into a proper town and made the Crimean Horde's capital, replacing
  Enice
- new towns for the Crimean Horde (Qirq Yer, Domakha, Enice, Oleshia, Teligol, Khadjibey) and
  Circassia (Taman, Copa, Susaco)
- Gazaria starts as a merchant republic at duchy rank, with trade offices across its Black Sea and
  Caspian network — Taman, Susaco, Copa, Theodoro, Qirq Yer, Oleshia, Teligol, Khadjibey, Domakha,
  Enice, Astrakhan and Sarayjuk — and a galley barracks in Kaffa
- Zaporozhia starts at duchy rank
- Ashikaga, Occitania, Benin and Bonoman use their proper map colours again

**National Flavour**

- the Genoese Galley advance is available to any Ligurian country, not just Genoa
- Gazaria's two trade advances now require Ship Building instead of Abacus and Lieutenancy
- Consiglio Maggiore (Italian republics) now pushes centralization and carries a small peasant
  satisfaction penalty, instead of +10% nobles and burghers estate power, a tiny satisfaction penalty
  and −2.5% peasant max tax
- Cossack Black Sea Raids grants +2.5% desired soldier pops instead of −25% privateer maintenance
- the South China Yi and Fuzhou culture advances have their pop bonuses halved to 0.005, and Gentry
  Town Residence has its city soldier bonus cut from 0.025 to 0.010

**Diplomacy**

- Enforce Peace is player-only. The AI no longer starts one itself: a refusal by the attacker drags
  the enforcer into the war, which is not a commitment the AI can judge
- guarantees no longer add a truce when cancelled or broken, no longer upgrade into an alliance when
  they expire between equals, and no longer expire because the two countries are rivals
- Unconditional Surrender is removed — the base game now provides its own

## game.1.3.11.mod.13

One large content merge. The starting setup is the headline: the world outside Europe is built out
into playable countries with their own advances, and several nations are reworked.

**Pops & Setup**

- India and China have dozens of playable tags, many with their own advancement sets based on the
  countries' original EU4 national ideas
- Japan is fully playable with over 30 clans and a functional Shinto religion, loosely based on the
  Sengoku Jidai period
- West and East Africa expanded: several tribal societies of pops are playable as settled countries,
  with their own advances
- the Middle East is reworked around a much less dominant Mamluks, with many formable tags in Arabia
  and Persia — Hejaz, Najd, Fars, Khorasan and more
- Central Asia gets many playable tags, hordes with proper advancement sets, and formables such as
  Bukhara, Greater Khorasan and a reworked Mongol Empire
- Europe reworked so HRE minors are more viable and France and Castile less overbearing, with many
  small tweaks to the starting balance

**Nation Reworks & Unique Content**

- hordes reworked: steppe-horde advances and government content, an emphasis on raiding, and
  unavoidable nerfs to horse archers
- Venice and the rest of Italy get small adjustments, with their own advances and unit types
- new unique unit types by age and region (knights, Byzantine units, bedouin cavalry, Indian and
  Italian units) instead of flat numerical buffs for countries that need a leg up
- regional advancement sets across China, India, Indochina, Indonesia, Anatolia, the Caucasus,
  Ruthenia, Arabia, Persia, Central Asia, Tibet, Xinjiang, the Urals, Mongolia, Madagascar and Africa
- new estate privileges, government reforms (general, China, Europe, India), levies and culture
  buildings

## game.1.3.11.mod.12

**Subjects**

- Tributaries excluded from Transfer Location to Other Subject on both ends.
- Tributaries excluded from Transfer Subject on both ends.

**Mercenaries**

- Offering your own armies as mercenaries removed: the Become Mercenary button in the army builder is
  gone, and Make available for hire no longer appears on the single-unit action bar, a multi-unit
  selection, the pinned quick-action row or the right-click unit menu, nor is it reachable by AI or
  automation.
- Delisting a unit already on the market still works.

**Economy**

- Selling or buying a location capped at 100 gold.
- Countries far less willing to buy a work of art offered to them.

**Economic Support**

- Amount capped at the recipient's tax base and at ten months of the sender's income (never below 1
  gold); the slider opens at half the cap. Previously it ran from 0 up to the sender's whole monthly
  income.

**Opinion**

- Worsen Opinion applies −200 instead of −100.
- Worsen Opinion costs one diplomat and is limited to one use per month.

**Personal Unions**

- Union partners are no longer dragged into each other's defensive wars; they get a call to arms they
  can accept or decline.

**Wargoals**

- Location warscore base cost per location raised to 2.5.

## game.1.3.11.mod.11

Built but never published; folded into mod.12.

**Enforce Peace**

- Intervene in War removed mod-wide; a new Enforce Peace replaces both it and the vanilla Enforce
  Peace.
- The defender is asked first; only if they accept is the demand put to the attacker. Attacker
  accepts → white peace; attacker refuses → the enforcer joins on the defender's side.
- Usable by Great and Major Powers (Ars Belli ranks), and by anyone when either war leader is its
  rival.
- The war-view button is always shown, greying out with a tooltip naming what is missing.
- The "rival is at war" alert opens Enforce Peace.
- The HRE Emperor uses the same action as everyone else.
- Prestige penalty for refusing removed.

**Economic Support**

- New Send Economic Support action with an accept/decline popup.
- Costs both sides a Defensive Point and −0.10 monthly diplomats.
- One patron at a time; breaks on war, annulled by peace treaty; either side can end it early.
- The vanilla action relabelled as against the rules.

**Antagonism**

- New Forgive half antagonism and Forgive 200 antagonism actions.
- Stealing maps generates 1 antagonism instead of 10.

**Alliances and Rivals**

- Two Great Powers can no longer be allied; the alliance expires as soon as both partners are GPs.
- The 5-year lockout after dropping a rival removed.
- Defensive leagues no longer require non-negative opinion.

**Patch compatibility**

- Updated for game 1.3.11.

## game.1.2.5.mod.10

- Fixed alliances breaking when opinion turned negative.

## game.1.2.5.mod.9

- Updated for game 1.2.5: pops, town setups, country / market / institution / disease / development
  setup, diplomacy, wars and localisation refreshed to the 1.2.5 baseline.
- Starting-setup additions merged.

## game.1.2.4.mod.8

- Lack-of-control impact on location warscore raised across all ages (0.2 / 0.4 / 0.6 / 0.8 / 1.0 /
  1.0).
- Deus Vult CB clarified as available to every country, not just Catholics.

## game.1.2.4.mod.7

- Logistic unit food storage raised to a flat 3.5× vanilla.
- Deus Vult advance granted to all countries so the crusade CB is usable from game start;
  auto-assigned via the Age of Traditions.
- Heretic wargoal attacker conquer/subjugate cost raised to 1.1.
- Fixed the invalid war-declaration block in the alliance-limit penalty.

## game.1.2.4.mod.6

- Over-fort-limit alert on by default; the popup tells you where to mute it.
- Logistic food-storage buff moved to the army auxiliary category so all tiers inherit it.
- Dead Middle Kingdom / Red Turban gating dropped from the Form China decision.

## game.1.2.4.mod.5

- Master toggle for the MP mechanics added.
- Institution spread stripped from Alliance and Fleet Basing Rights.
- Knowledge Sharing disabled.
- Unions with an offensive policy now consume Alliance Points instead of Defensive Points.
- Colonial nation and overlord count as Alliance Points on both sides.
- Great Power and Major Power maximums raised to 12 each.
- Default Alliance Point limit raised from 6 to 7.
- Over-alliance-limit penalty gained −90% trade income and −90% research speed; the penalty defaults
  to off and its setting moved next to the diplo limits target rule.
- Guarantee Points renamed Guarantee Relations and count 1 per relation.
- Buggy Propose Guarantee action removed, vanilla offer restored.
- Deposit Food raised to 50% of the army's food fraction; supply depot changes.
- Transport ship food storage buffed to match logistic units age for age.
- Perform Army Logistics flagged as banned in its tooltip.
- Dismiss Head of Cabinet character interaction added.
- Fort over-limit penalty doubled to −2% per point, capped at −100%; toggleable popup alert added,
  firing monthly.
- Deus Vult unlocked to everyone and religious-war wargoal costs neutralised.
- Hegemons allowed to ally each other; war declaration blocked while over the alliance limit.
- Guarantee expiry and expire-effect scope errors fixed.

## game.1.2.2.mod.4

- Trade income added to the power score calculation.
- Coalition CB changed to 0.75 attacker / 1.25 defender conquer and subjugate cost.
- Hegemon and imperial CB fixed.
- Manden Kurufa reform made removable.
- Destroy market price capped at 10.
- Vision sharing requirements fixed.
- Fixed the tier-list toggle opening the panel for every connected player.
- Fixed diplomatic range on Pay for Military Access.

## game.1.2.2.mod.2

- Power score smoothed over a 12-month target; tooltip shows the projected score.
- AP and DP users visualised in the tier list and the foreign country tooltip.
- Alliance Points take priority over Defensive Points correctly.
- Force Break Union now creates a truce.
- Pops updated to fill resource gathering operations.
- Red Turban Rebellion and Rise of Timur errors fixed.

## game.1.2.2.mod.1

- First release on the 1.2.2 baseline; Form China switched to a targeted override instead of
  replacing the whole formable-countries file.

## Alpha builds (0.0-alpha.1 through 0.0-alpha.13)

The systems introduced during alpha, in rough order:

- MP power score and country ranks (GP / Major / Normal / Small / Minor), with score components for
  economy, manpower, army, sailors, heavy ships, galleys, control-scaled population and vassal
  population.
- Game rules for GP and Major counts, alliance limit penalty, players-only scoring and the small
  power threshold.
- Alliance / Defensive / Guarantee point display in the top bar, defensive league handling, DP
  overflow into AP, foreign country diplo limits display and the tier-list panel.
- Fort limit rework, over-fort-limit fort defense penalty, and the offensive/defensive societal value
  rework.
- Crusade targeting and the 100-year global crusade/jihad cooldown.
- Force Break Union, Break Others' Guarantee, Worsen Opinion, the Pay for X sliders and Vision
  Sharing.
- Scutage, Sow Discontent, Corrupt Officials and Isolate from Allies disabled; Threaten War removed
  for Great Powers.
- Minimum warscore to demand peace lowered to −99; Steal Research cost raised to 100 spy network;
  mercenary nerf; Scottish parliament changes.
- Asian pop changes (Timurids, Delhi, Khmer, Ayutthaya, Middle Kingdom, Lordship of the Pale) and
  several map revisions.
