# Ars Belli — Changelog

Player-facing changes per release, newest first. This file is the source for the GitHub
release notes. For the full current state of every mod system (not just what changed), see
`Ars Belli - Complete Changelog.md`, which is also published as a Google Doc for players.

## game.1.3.11.mod.13

Since game.1.3.11.mod.12 → game.1.3.11.mod.13:

> One large content merge. The starting setup is the headline: the world outside Europe is
> built out into playable countries with their own advances, and several nations are reworked.

### Pops & Setup

- **India and China** have dozens of playable tags, many with their own advancement sets based
  on the countries' original EU4 national ideas
- **Japan is fully playable** with over 30 clans and a functional Shinto religion, loosely based
  on the Sengoku Jidai period
- **West and East Africa expanded**: several tribal societies of pops are playable as settled
  countries, with their own advances
- **The Middle East is reworked** around a much less dominant Mamluks, with many formable tags in
  Arabia and Persia — Hejaz, Najd, Fars, Khorasan and more
- **Central Asia** gets many playable tags, hordes with proper advancement sets, and formables
  such as Bukhara, Greater Khorasan and a reworked Mongol Empire
- **Europe** reworked so HRE minors are more viable and France and Castile less overbearing, with
  many small tweaks to the starting balance

### Nation Reworks & Unique Content

- **Hordes reworked**: steppe-horde advances and government content, an emphasis on raiding, and
  unavoidable nerfs to horse archers
- **Venice** and the rest of Italy get small adjustments, with their own advances and unit types
- new unique unit types by age and region (knights, Byzantine units, bedouin cavalry, Indian and
  Italian units) instead of flat numerical buffs for countries that need a leg up
- regional advancement sets across China, India, Indochina, Indonesia, Anatolia, the Caucasus,
  Ruthenia, Arabia, Persia, Central Asia, Tibet, Xinjiang, the Urals, Mongolia, Madagascar and
  Africa
- new estate privileges, government reforms (general, China, Europe, India), levies and culture
  buildings

## game.1.3.11.mod.12

Since game.1.3.11.mod.11 → game.1.3.11.mod.12:

> mod.11 was bumped and built but never tagged or published, so the mod.12 release notes on
> GitHub carry the mod.11 section below forward as well. The per-version split is kept here.

### Subjects

- tributaries are excluded from **Transfer Location to Other Subject** on both ends: their land cannot be handed to another subject, and they cannot receive land taken from one
- tributaries are excluded from **Transfer Subject** on both ends: a tributary cannot be transferred to another country, and cannot be given somebody else's subject

### Mercenaries

- offering your own armies as mercenaries is removed: the **Become Mercenary** button in the army builder, which opened the "Set Up The Mercenary Contract" window, is gone, and the **Make available for hire** unit action no longer shows on the single-unit action bar, on a multi-unit selection, in the pinned quick-action row, or in the right-click unit menu — nor is it reachable by the AI or by delegation automation
- renting your own regiments out put the mercenary modifiers on the hirer while the owner kept drawing the full hire price, which between two players was a gold transfer that paid a profit
- delisting a unit already on the market still works

### Economy

- selling or buying a location is capped at 100 gold, so a location sale can no longer be used as an unlimited money transfer between players (vanilla let the buyer pay out its entire treasury)
- countries are far less willing to buy a work of art offered to them: they now weigh the price against their own income, a full treasury tempts them much less, and anything short of a masterpiece is turned down. Vanilla ignored the price entirely, so any rich AI would buy almost anything at whatever the game valued it at

### Economic Support

- the amount that can be sent is now capped at the recipient's tax base, and never exceeds ten months of the sender's income (never below 1 gold); the slider opens at half of that cap. Previously it ran from 0 up to the sender's whole monthly income

### Opinion

- **Worsen Opinion** now applies -200 instead of -100 — twice the magnitude of vanilla Improve Relations
- Worsen Opinion costs one diplomat and is limited to one use per month, so it can no longer be spammed at another player

### Personal Unions

- union partners are no longer dragged into each other's defensive wars automatically; they now get a call to arms they can accept or decline, like any other ally (the offensive side is unchanged and still depends on the union's Mutual Offense policy)

### Wargoals / Casus Belli

- location warscore: base cost per location raised to 2.5 (vanilla 2) to make up for the cut tax-base term, keeping the early game close to vanilla while the late game still scales far more gently

## game.1.3.11.mod.11

Since game.1.2.5.mod.10 → game.1.3.11.mod.11:

### Enforce Peace

- Intervene in War is removed mod-wide, and a new **Enforce Peace** action replaces both it and the vanilla Enforce Peace
- the defender is asked first, and only if they accept is the demand put to the attacker; the attacker accepting ends the war in a white peace, and the attacker refusing brings the enforcer into the war on the defender's side
- usable by Great Powers and Major Powers (Ars Belli ranks, not vanilla's), and by any country at all when either war leader is its rival
- the Enforce Peace button on the war view is now always shown, greyed out with a tooltip spelling out which requirement is unmet, instead of disappearing
- the "rival is at war" alert now opens Enforce Peace instead of Intervene in War
- the HRE Emperor no longer gets the vanilla Enforce Peace and Intervene in War, and uses the same Enforce Peace as everyone else

### Economic Support

- new **Send Economic Support** action: pick a country and a monthly sum of gold, and they get an accept/decline popup before anything starts
- the amount slider runs from 0 up to the sender's entire monthly income and starts at 10% of it
- costs both sides a Defensive Point and -0.10 monthly diplomats for as long as the arrangement stands
- a country can only receive Economic Support from one patron at a time
- breaks on war between the two parties and is annulled by a peace treaty; either side can end it early (Cancel for the sender, Refuse for the recipient)
- the vanilla Send Economic Support action cannot be removed from the game, so it is relabelled as against the rules to steer players onto the new one

### Antagonism

- two new friendly actions, **Forgive half antagonism** and **Forgive 200 antagonism**, which write off antagonism you hold against another country; each needs at least 10 antagonism, each has its own 10-year cooldown, and using both is cumulative
- stealing maps now generates 1 antagonism instead of 10

### Alliances & Rivals

- two Great Powers can no longer be allied — an existing alliance now expires as soon as both partners are Great Powers (this replaces vanilla's hegemon-to-hegemon block)
- the 5-year lockout after dropping a rival is removed; rivals can be swapped freely
- defensive leagues no longer require non-negative opinion between the parties, to form or to join

### Patch Compatibility

- updated for game 1.3.11
