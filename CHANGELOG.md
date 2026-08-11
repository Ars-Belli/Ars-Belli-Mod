# Ars Belli — Changelog

Player-facing changes per release, newest first. For the full current state of every
mod system (not just what changed), see `changes.txt`.

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
