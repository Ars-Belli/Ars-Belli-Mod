# Ars Belli — Changelog

Player-facing changes per release, newest first. This file is the source for the GitHub
release notes. For the full current state of every mod system (not just what changed), see
`Ars Belli - Complete Changelog.md`, which is also published as a Google Doc for players.

## game.1.3.11.mod.18

Since game.1.3.11.mod.17 → game.1.3.11.mod.18:

### Changes to Vanilla Diplomatic Actions

- **Intervene in War** is now actually gone for everyone. Taking it off Great Power and Regional
  Power status was never enough — the base game lets any country intervene in a war involving one of
  its rivals whatever its rank, so it stayed reachable through that back door. There is no longer a
  war to pick, so nobody can complete it: no rank, not the HRE Emperor, and not against a rival
- Where the base game still lists it, the action is relabelled **Intervene in War (Removed)**, and
  opening it explains that **Enforce Peace** replaces it
- **Threaten War** is removed for **Regional Powers** and the **HRE Emperor**. Great Powers had
  already lost it, so no country can threaten war any more

## game.1.3.11.mod.17

Since game.1.3.11.mod.16 → game.1.3.11.mod.17:

> Maintenance release — internal fixes only, no player-facing changes.

## game.1.3.11.mod.16

Since game.1.3.11.mod.15 → game.1.3.11.mod.16:

### National Flavour

- **The Miaphysite and Nestorian churches finally get their two religious aspects.** *Martyrs' Shield*
  — +10% military tactics, +5% morale recovery in friendly territory and monthly progress toward
  Quality — and *Universal Learning*, for theocracies — +5 maximum literacy for burghers, laborers,
  soldiers and peasants, and monthly progress toward Innovative. Both were already named and described
  in-game but were never defined, so neither religion could actually take them
- **Christiana Pietas** now also grants +0.01 monthly literacy, and its heathen tolerance is cut to 1
  [2]
- **Genoese Crossbowmen** upgrade into Late Genoese Crossbowmen again — the upgrade path pointed at a
  unit that does not exist, so the line dead-ended

### Buildings and Reforms

- **Church School:** its literacy bonus was written on the wrong scale and did effectively nothing. It
  now gives +5 maximum literacy to burghers, laborers, soldiers and peasants, alongside its existing
  +0.1 monthly literacy and conversion speed

### Economy and Gold-Transfers

- **Age of Discovery** grants +50% colonial maintenance efficiency in place of −25% colonial
  maintenance cost

### Crusades and Jihads

- The Crusade and Jihad buttons now spell out the 100-year global cooldown instead of showing a raw
  text key

### UI and Quality of Life

- The power rank tooltip is no longer cut off part-way through its last line
- The tier-list panel's open and close buttons have tooltips

## game.1.3.11.mod.15

Since game.1.3.11.mod.14 → game.1.3.11.mod.15:

### National Flavour

- **Byzantium and Trebizond get their bureaucracies back.** The mod's Byzantine bureaucracy file
  shared a name with the base game's, so it replaced that file wholesale and deleted nine of the ten
  Byzantine bureaucracies — Honorary Titles, Court Eunuchs, Ritualistic Court, Sixty Books of the
  Basilika, Romanitas, Imperial Senate, Kephalai, Themata and Allelengyon. All ten are available
  again, and only the Magister Militum rebalance is applied on top

## game.1.3.11.mod.14

Since game.1.3.11.mod.13 → game.1.3.11.mod.14:

> The Black Sea gets the attention this time — Gazaria, the Crimean Horde, Circassia and the
> Zaporozhian steppe are rebuilt from the ground up — and the Indian and Chinese formable tiers are
> sorted out.

### Formables

- **Hindustan** is formable by any Indian-culture country of South Asia: the whole subcontinent at
  80% ownership, tier 5
- **Delhi** is formable by any Muslim country of Indian, Iranian, Mongolian or Turkic culture that
  owns Delhi, and moves its capital there on forming
- **Circassia, Georgia and Armenia** added as Caucasus formables
- Indian regional formables — Bengal, Gujarat, Rajputana, Rajastan, Nepal, Punjab, Bahmanis, Deccan,
  Maratha, Nagavanshi and Ceylon — all moved to tier 4; Hindustan and the Mughals sit at tier 5
- **China** raised to tier 5 and 80% of its locations; the four split-empires (Southern Song, Cao
  Wei, Shu Han, Eastern Wu) moved to tier 4
- **Pontus** moved to tier 4, opened to Gothic culture, and always requires owning Trebizond; forming
  it no longer demotes a country that is already above kingdom rank
- **Sun Quan** renamed **Southern Song**
- **Vijayanagar** is explicitly disabled and says so in its tooltip, instead of sitting in the list as
  an unformable entry

### Pops, Map and Campaign Setup

- **the Zaporozhian steppe is Cossack**: the Tatar peasants and tribesmen across the Dnieper and
  Donets steppe are replaced by Orthodox Cossack pops, and the Ruthenians living there are peasants
  rather than slaves
- **Kaffa rebuilt** as the Genoese emporium of the Black Sea, around 33,500 people — Ligurian, Greek,
  Armenian and Tatar burghers, an Armenian, Greek and Latin clergy, and a Caucasian and steppe slave
  population
- **Bakhchysarai (Qirq Yer)** grown into a proper town and made the Crimean Horde's capital, replacing
  Enice
- new towns for the Crimean Horde (Qirq Yer, Domakha, Enice, Oleshia, Teligol, Khadjibey) and
  Circassia (Taman, Copa, Susaco)
- **Gazaria** starts as a merchant republic at duchy rank, with trade offices across its Black Sea and
  Caspian network — Taman, Susaco, Copa, Theodoro, Qirq Yer, Oleshia, Teligol, Khadjibey, Domakha,
  Enice, Astrakhan and Sarayjuk — and a galley barracks in Kaffa
- **Zaporozhia** starts at duchy rank
- Ashikaga, Occitania, Benin and Bonoman use their proper map colours again

### National Flavour

- the **Genoese Galley** advance is available to any Ligurian country, not just Genoa
- Gazaria's two trade advances now require Ship Building instead of Abacus and Lieutenancy
- **Consiglio Maggiore** (Italian republics) now pushes centralization and carries a small peasant
  satisfaction penalty, instead of +10% nobles and burghers estate power, a tiny satisfaction penalty
  and −2.5% peasant max tax
- **Cossack Black Sea Raids** grants +2.5% desired soldier pops instead of −25% privateer maintenance
- the South China Yi and Fuzhou culture advances have their pop bonuses halved to 0.005, and Gentry
  Town Residence has its city soldier bonus cut from 0.025 to 0.010

### Enforce Peace

- **Enforce Peace is player-only.** The AI no longer starts one itself: a refusal by the attacker
  drags the enforcer into the war, which is not a commitment the AI can judge

### Changes to Vanilla Diplomatic Actions

- **guarantees** no longer add a truce when cancelled or broken, no longer upgrade into an alliance
  when they expire between equals, and no longer expire because the two countries are rivals

### New Diplomatic Actions

- **Unconditional Surrender is removed** — the base game now provides its own

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
