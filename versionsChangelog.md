# Ars Belli — Changelog

Player-facing changes per release, newest first. This file is the source for the GitHub
release notes. For the full current state of every mod system (not just what changed), see
`Ars Belli - Complete Changelog.md`, which is also published as a Google Doc for players.

## game.1.4.9.mod.32

Since game.1.4.9.mod.31 → game.1.4.9.mod.32:

### Battles and Armies

- **Zaporozhian Foot** and **Sich Infantry:** +0.025 secure flanks defence [was +0.25, a typo ten
  times the Wagenburg's value]

### Buildings and Reforms

- **Order Commandery:** +2.5 max literacy [was +0.025, a typo]
- **Jesuit College:** +5 max literacy [was +0.05, a typo]
- **Traditional Land Tenure** and **Guild Charters:** the descriptions now match what the reforms
  do. Guild Charters is the Capital Economy reform (it already needed 65 toward Capital Economy),
  and Traditional Land Tenure no longer promises building upkeep efficiency it never gave
- **Provincial Chancellery, Court Secretariat, Admiralty Board and Proconsulate:** the building
  tooltip now shows what each office gives
- **Royal Garden:** no longer clashes with the base game's production method of the same name

### National Flavour

- **Lotharingia:** **Lotharingian Tradition II** gives +10% army reinforcement efficiency [was +10%
  manpower], and **Glory of Charlemagne** gives +0.05 monthly army tradition and −0.1% army
  tradition decay [was +10% morale]

### Formables

- **Lotharingia:** any Rhine Alemannic, Burgundian, Franc-Comtois, Lorrain or Walloon country can
  form it [was only countries whose original capital is in Germany], and it needs 60% of its land
  [was 50%]
- **Occitania:** needs 65% of its land [was 75%]
- **Burgundy** (Provence, Savoy, the Lyonnais, Franche-Comté and western Switzerland): needs 70% of
  its land [vanilla 50%]

## game.1.4.9.mod.31

Since game.1.4.9.mod.30 → game.1.4.9.mod.31:

### Battles and Armies

- **Armory, Training Fields, Barracks, Regimental Camp and Conscription Center** are half-size: each
  level gives half the manpower, employs half the soldiers and costs half the goods to build and
  maintain, and twice as many levels fit in a location (2 + 5% of population [vanilla 1 + 2.5%]).
  Gold costs are unchanged. Manpower per level: Armory +5, Training Fields +3, Barracks +7.5,
  Regimental Camp +10, Conscription Center +12.5 [vanilla +10 / +10 / +15 / +20 / +25]
- **Combined Arms Drill** (Age of Renaissance) and **Combined Arms Doctrine** (Age of Discovery):
  new advances with +0.5% combined arms bonus each, for monarchies, republics and theocracies whose
  original capital is in Europe, North Africa, the Crescent or Anatolia
- combined arms bonus halved to +0.5% [was +1%]: **Stratioti Levies** (Greek culture group, which
  now also gives +10% army initiative), Tiānwán's **Integrated Advancement** and Greater Khorasan's
  second advance. **Klephtic Recruitment** (Pontic Greeks and Goths) gains +0.5%

### Country Balance

- **Ottomans:** **Timar System** gives +5% light cavalry power and −5% light cavalry maintenance
  [vanilla +10% / −10%], **Expanded Timar System** +10% / −10% [vanilla +20% / −20%], and **Seljuk
  Roots** +2.5% discipline [vanilla +5%]
- **Morocco and the Maghreb:** +5% manpower [vanilla +10%] from **Volunteers of the Faith**, **'Abīd
  al-Buḵārī**, **Sharifian Sultanate** and **Amīr al-Muslimīn** (Across the Pillars), and from
  **Slave Soldiers**. Volunteers of the Faith and Slave Soldiers apply to every Amazigh and Maghrebi
  country, Volunteers also to Granada and the Andalusi
- **Dīwān al-Jund** (Muslim bureaucracy): up to +7.5% manpower when fully funded [vanilla +10%]
- **Byzantium:** the **Strategarchia** bureaucracy (called Magister Militum in the mod.30 notes)
  gives +0.05 military tactics [was +0.2], up to +0.1 once entrenched. **Modern Imperial Army** and
  the **Reformed Tágmata** policy give +10% army maintenance efficiency [vanilla +20%]
- **Smolensk and Mewar** no longer get the base game's copies of their EU4 ideas on top of the mod's
  own sets: **Smolenskian Resolve** and **The Armories of Smolensk** are gone, and **Mandatory
  Firearm Drills** and **Reorganized Rajput Regiments** stay for every Rajasthani country except
  Mewar
- **Veche Republic** is open only to Muscovite and Novgorodian cultures [vanilla the whole Russian
  group]

### Buildings and Reforms

- **Sergeantry, City Guard, Temple Militia and Order Headquarters:** the level cap grows by 3 each
  age, 3 / 6 / 9 / 12 / 15 / 18 from Traditions to Revolutions [was 3]. **Order Headquarters** gives
  +20 manpower per level [was +50, vanilla +20]. **City Guard** costs −5% burghers power and
  **Temple Militia** −5% clergy power [was −10%]
- correction to the mod.30 notes: **Warrior Temple** and **Jurchen Barracks** were not changed and
  still have 1 level
- **Royal Garden:** republics and theocracies can build it too [vanilla monarchies only]
- **Gazarian Arsenal:** +50 manpower [was +30] and +25% local manpower [was +10%]
- **Order Commandery:** also gives +2 manpower to its location
- **Confucian School:** +2.5 max literacy [was +5] and no institution growth [was +25%]
- rough-terrain proximity advances unlock a peasants privilege instead of a reform: the **Homeland
  Proximity Privilege**, or the **Alpine Proximity Privilege** for Savoy, the Swiss and Provence. It
  uses no reform slot, applies at once [was after 2 years], gives +20% peasants power and cannot be
  revoked
- both privileges work only on rough terrain in the region of your original capital (the Alpine one
  no longer covers the whole Alpine arc): mountains +100% proximity efficiency and +50% development
  growth, hills +33.3% and +25%, plateaus +14.3% and +10%, which cancels each terrain's own penalty
  [was +100% proximity efficiency on every location]
- all 16 of these advances are now Age of Traditions advances, and the 130 countries that qualify
  at the 1337 start begin with the advance and the privilege. Moved forward: **Land of Mountains and
  Rivers** (Austria), **A Permanent Capital** (Ethiopia), **Tarascon Castle** (Provence: +10% fort
  defense, +2 and +10% fort limit), **Wetland Adaptation** (Chén) and **Mountain Adaptation**
  (Hangzhou, Shu Han). The full list also includes Armenia (**Mount Ararat**) and Trebizond
  (**Pontic Trail Mastery**), which the mod.30 notes left out
- **Traditional Land Tenure:** new reform at 65 or more toward Traditional Economy. Rural locations
  get +25% population capacity, +0.1% monthly prosperity and +2.5% production efficiency
- **Guild Charters:** new reform at 65 or more toward Capital Economy. Towns and cities get +0.1%
  population growth and +0.1% monthly prosperity, plus +2.5% raw material impact
- **Hanseatic Merchant Federation:** the Hansa can pick the reform from the reform list [was only
  through its decision], and the decision is now for the Hansa only. The reform gives +1 reform
  slot, +10% burghers power [vanilla −50%], +10% legislative efficiency [vanilla −50%] and +10%
  merchant maintenance efficiency [vanilla +50%]. It no longer makes the Hansa immune to subjugation
- **Republican Electorate Law:** the **Landholders** policy gives +15% nobles levy size [vanilla
  +10%] and +10% levy combat efficiency [vanilla +5%], and pushes toward Quality instead of Serfdom
- **Genoa:** **Great and Minor Councils** gives +5% satisfaction for every estate [was +10% for
  nobles and burghers and +2.5% for all] and −1% max tax for every estate. The +10% crown power stays
- every Ars Belli government reform now has an icon

### Trade Posts

- **Fondaco:** only Italian and Greek merchant republics can build one [was any merchant republic
  except the Hansa]
- **Merchant Enclave:** now also the trade post of every other merchant republic (Novgorod among
  them) and of the Dutch Republic. +0.075 maritime presence [was +0.05], +0.7 trade capacity [was
  +0.5] and +0.05 migration attraction [new]
- **Fondaco Rights:** can be granted to any merchant republic, the Dutch Republic and the Hansa [was
  Italian merchant republics and the five merchant governments]. The AI no longer refuses the Hansa
  as a competing merchant republic
- **Burgtor:** 1 level per location [vanilla 2]. Building one in another country needs its Fondaco
  Rights, and it is torn down when the rights are withdrawn. +5% local manpower, +2 manpower to the
  Hansa [vanilla +5 per level] and half the upkeep goods
- **Hanseatic Town Hall:** Lübeck's is no longer destroyed at game start; it is torn down only when
  its owner loses the Hanseatic Merchant Federation. +5% cabinet efficiency [vanilla +10%]
- **Hanseatic Shipwright Guild:** torn down once its port no longer belongs to a Hansa subject, and
  no longer buildable in towns

### Societal Values

- **Capital Economy:** no raw material impact bonus [was +5%]
- **Traditional Economy:** +25% raw materials output [was +20%]. In place of +25% population
  capacity it gives +5% possible laborers in rural locations per 1,000 pops

### Religion and Culture

- **Cathar**, **Lollard** and **Waldensian** pops take Lutheranism and Calvinism at 0.05× the normal
  rate [was 0.5× for Cathars, full rate for the others], and their countries get +50% resistance to
  both movements
- Black Sea culture opinions: **Gothic** likes Crimean, Cossack and Ligurian and is an enemy of
  Mishar and Astrakhani, who return it; **Pontic** likes Cossack, Crimean and Ligurian; **Crimean**
  and **Cossack** like Gothic and Pontic; **Ligurian** likes Pontic and Gothic [was kindred]
- **Georgian** and **Armenian** like each other

### National Flavour

- **Sardinia-Piedmont:** its 10 advances now work. They were tied to a tag that does not exist, so a
  formed Sardinia-Piedmont never got them
- **Genoa:** new **Genoese War Galley** (Renaissance) and **Genoese Great Galley** (Discovery), each
  that age's galley plus the Genoese Galley's +1 speed, +2 cannons and +0.03 crew size, unlocked by
  the **Genoese War Galleys** and **Genoese Great Galleys** advances. Genoa, Gazaria and Ligurian
  countries. Upgrade path: Genoese Galley → War Galley → Great Galley → Galleass
- **Bohemia:** the **Late Wagenburg** advance (Discovery) unlocks the **Late Wagenburg** regiment,
  Discovery heavy infantry with the Wagenburg's −10% strength and morale damage taken and +0.025
  secure flanks defence. The Wagenburg upgrades into it [vanilla Halberdiers]
- **Prussia:** the mod's **The Goose Step** is back (Reformation, +10% heavy infantry power) and the
  base game's Revolutions version is switched off
- **Zaporozhian Foot** and **Sich Infantry:** −15% morale damage taken [was −10%], −10% strength
  damage taken [was −15%], +0.25 secure flanks defence [new]
- Italian regiment lines (**Genoese Crossbowmen**, **Balestrieri**, **Venetian** and **Italian
  Stradioti**): the next Italian unit is the preferred upgrade instead of the only one
- **Swabia:** **Swabian City-State Tradition II** gives +10% army maintenance efficiency [was +10%
  reinforcement efficiency]
- **Burgundy:** **Create the Regimental System** gives −10% infantry maintenance cost [was +10%, a
  sign error]
- **Switzerland:** **Confessional Coexistence** no longer requires Legalism, which the game rejected
- **Pontic Greeks and Goths:** **Greek Orthodox Faith** no longer gives +1 heretic tolerance
- **Venice:** the **Dalmatian Possession** privilege also gives +20% peasants power
- **Settle the Steppe:** a province counts as settled once every location has 20 development [was
  also half its population capacity]. +0.035 monthly development [was +0.01]; the population growth
  and migration bonuses stop at 30 population in a location
- the 14 province mining and development decisions of the steppe and Crimea now become available;
  they could not find their province before
- **Taurica:** can also be formed by owning the Crimea, Pryazovia and Azov areas plus the Djambuluk,
  Taman and Akhtar provinces. The old requirement still works

### Pops, Map and Campaign Setup

- the **Zaporozhian Host** starts as a Cossack host, not a steppe horde: Cossack privileges and
  Cossack Private Armies, Offensive Military Doctrine, Civil Law, Religious Teachings, a Central
  Council and its own societal values
- **Bulgaria** starts as an empire [was kingdom]
- **Georgia** starts with Armenian as an accepted culture [was tolerated]
- Pamplona and Valladolid are markets instead of Burgos
- the **Hansa** starts with Kontors in Copenhagen, Stockholm, Bergen, Edinburgh and Glasgow and Trade
  Offices in Odense, Åbo, Oslo, Berwick, Aberdeen, Lynn and Ladoga. **Genoa** starts with Fondacos in
  Tunis, Fez, Valladolid, Barcelona and Lisbon and Trade Offices in Fez, Valladolid, Lisbon, Madīna
  and Jeddah
- Seville, Toledo, Córdoba, Jaén, Murcia, the Algarve, Asturias and Orkney exist again as landless
  countries with their cores, so they can be released. Japan, the Almohads, Bijaya, the Guanche,
  Hawai'i, Kaua'i, Lahaina, Maui, O'ahu, Maden, Misool and Waigeo exist again too
- 27 landless start countries get back their missing cores (48 locations), among them Bologna,
  Padua, Trieste, the Pale and 11 South Indian states
- leftover Middle Kingdom, Red Turban, Ilkhanate and Lordship of Ireland content is switched off
  cleanly, so it no longer floods the error log. Nothing changes in play

## game.1.4.9.mod.30

Since game.1.4.8.mod.29 → game.1.4.9.mod.30:

### Patch Compatibility

- updated for game 1.4.9

### Battles and Armies

- cavalry needs five times the horses [was ×10]: every horse unit pays ×5 horses to build, reinforce
  and maintain, and every camel unit ×5 camels
- cavalry pays twice the other goods: weaponry, leather, cloth and firearms (and the elephants of
  elephant cavalry) cost ×2 for light, heavy, steppe horse archer, camel, clan retainer and elephant
  cavalry, and for the Jinetes, Cuantiosos and Tornadizos. Infantry, auxiliaries and the tribesmen
  levy are unchanged
- cavalry combat power by age, from Traditions to Revolutions: 2.4 / 2.4 / 2.4 / 2.65 / 3.05 / 3.05
  [was 2.2 / 2.4 / 2.6 / 2.85 / 3.0 / 3.2, vanilla 2.6 / 2.6 / 2.6 / 2.85 / 3.25 / 3.25]. Light and
  heavy cavalry, mercenaries included

### Buildings and Reforms

- **Stud Farm:** at most 1 level per location [was 2]
- **Governor offices**, four new buildings that each use up one unused governor post:
  - **Provincial Chancellery:** +1 government reform slot. Built in the capital or a cored city of
    the capital's area
  - **Court Secretariat:** +1 cabinet seat. Same build locations as the Provincial Chancellery
  - **Admiralty Board:** uses a naval governor post, +1 cabinet seat. Built in a port city that is
    not the capital
  - **Proconsulate:** uses a naval governor post. Built where a local governor stands, it makes his
    proximity source 25% stronger
  - up to 4 of each. Demolishing one gives the post back but costs 3 months of income, −10 stability
    and political influence
- **Provincial Administration:** uses a naval governor post. Every owned location in its area gets
  +0.25% monthly control, +0.2% monthly development, +0.2% monthly prosperity and +1% population
  growth. One per area; every location you own there must be a core with your religion and an
  accepted culture, and your average control must be 70% or more. It is torn down if average control
  falls below 50%
- naval governors are no longer limited to ports cut off from the capital
- **Sergeantry, City Guard, Temple Militia, Warrior Temple, Jurchen Barracks and Order Headquarters**
  can be built up to 3 levels [was 1]. Estate power does not grow with level
- **Recognized Communes:** −2.5% nobles max tax in place of the base game's −5% max control
- **Harbor Administration** applies to every location in a province that has a port [vanilla: coastal
  locations]
- rough-terrain proximity advances (Persia, Austria, Savoy, the Swiss, Albania, Scotland, Tibet, the
  Inca, Morocco, Ethiopia, Nepal) no longer remove the proximity cost of mountains, hills and
  plateaus across the whole country. They unlock the **Homeland Proximity Administration** reform
  instead, which removes it only in the region of your historical capital. Savoy, the Swiss and
  Provence get the **Alpine Proximity Administration**, which covers the whole Alpine arc
- **Kingdom of God:** back to vanilla, plus +10% damage against heretics and heathens
- **Genoa:** Alberghi and Compagna Communis give +1 reform slot. Great and Minor Councils gives +10%
  crown power [vanilla −10%]
- **Confucian content** (Confucian school and academy, Imperial Examination, Scholar Officials, Petty
  Bureaucracy) stays open to Korean, Tamna, Vietnamese, Muong and Japanese cultures, which leave the
  Confucian culture group
- **conquistadors removed:** the advance is unavailable, and an event-spawned conquistador country
  can no longer conquer land just by occupying it

### Societal Values

- **Offensive:** also +10% army movement speed and +10% regiment reinforcement speed
- **Defensive:** also +10% combat speed and +5% morale recovery in friendly territory
- **Aristocracy:** also +0.25 monthly diplomats
- **Plutocracy:** also +20% military tactics. Burghers grow to 2% of all pops [vanilla 1% of city
  pops]
- **Capital Economy:** +20% urban building efficiency, +33% RGO size outside rural areas, +5% raw
  material impact, +25% cost to expand mining and farming RGOs, no food penalty
- **Traditional Economy:** +33% RGO size in rural areas, +25% rural building efficiency, no food
  bonus
- **Spiritualist:** +50% assimilation [vanilla −50%], −2 heretic and heathen tolerance
- **Humanist:** +2 heretic and heathen tolerance [vanilla +1], +1 culture capacity, −25% accepted
  culture cost, −25% conversion and assimilation speed
- **Traditionalist:** institution embrace cost +100% [vanilla +200%], −2% diplomatic spending cost,
  no policy change discount

### Economy and Gold-Transfers

- loans between countries have a minimum interest of 2% [vanilla 1%]
- Commerce focus: **Trade Manipulation** gives +5% trade center power [was +10%]
- colonial boom: applies once to each location that joins a colonial nation, for 35 years [was the
  capital region of a new colonial nation, for 20 years]. Road building time −65% [was −50%], and
  +2% population growth [was +1%] while the location is under half its population capacity

### Religion and Culture

- the state religion can no longer be switched to the ruler's personal faith. A faith from outside
  your religious group needs more than 75% of your population
- the state culture can no longer be switched to the ruler's culture. The new culture needs at least
  50% of your pops, or more than 75% if it is outside your culture group
- **Monasticism** gives +0.01 monthly literacy in place of +5 clergy max literacy
- **Participation of Women** gives +2.5 max literacy
- Orthodox gets a tiny bonus to population growth
- Cathars can no longer take **Sola Scriptura**

### National Flavour

- **Pontic steppe and Crimea:**
  - new advance sets for Taurica, Zaporozhia, Gazaria, Gothia, Crimea, Nogai, Astrakhan, Kazan and
    the Golden Horde
  - new culture regiments: Crimean and Astrakhani horse archers, Mishar horsemen, Gothic cataphracts
    and spearmen, Cossack cavalry and infantry, Ligurian and Ruthenian infantry
  - **Steppe Redoubts**, a small fort building for flatland steppe locations
  - **Settle the Steppe** cabinet action, which grows population in a steppe province you fully own
    and that already has your culture
  - decisions to open coal, iron, copper, lead and tin mines and timber works, to change a pastoral
    location's goods (10 stability, 10 political influence, 100–300 gold) and to set up timber
    workings (1,500 gold)
  - **Cossack Open Plains** and **Tribal Open Plains** privileges: +10% proximity efficiency in
    flatland locations, −2 road proximity cost, one-time +10 centralisation
  - **Black Soil Rights** town right: +80% RGO size and +25% food for arable towns
- **Gazaria:** a player-run Gazaria can break free of Genoa (with or without an alliance), then
  choose its culture once it holds Theodoro and Lusta. New Gazarian Arsenal building; starts with a
  named consul and 2 light cavalry
- **Zaporozhia:** playable, starts with 3 light cavalry as a Golden Horde tributary. +100% noble and
  tribal levies until the Black Death reaches it
- **Italy:** new advances for Venice, Florence, Genoa, Tuscany, the Two Sicilies, Sardinia, the Papal
  States and Dalmatia; new Corazzieri, Bersaglieri and Carabinieri units; a **Genoese Arsenal**
  building; Venice's **Dalmatian Possession** decision (+0.2% monthly control and +0.1% development
  in Croatia)
- **Greek culture group, Byzantium, Trebizond, Anatolia (Karaman, Candar, Cyprus, Cilicia) and the
  Ottomans:** new advances
- **Caucasus:** shared Caucasian advances and new sets for Georgia, Circassia, Armenia, Shirvan and
  the mountain states; **Greater Georgia**, **Greater Armenia** and **Greater Caucasus**
  proclamations at 80% integration of the region, each with its own reform; updated Georgian events
- **Crescent:** new advances for the Qara Qoyunlu, Aq Qoyunlu, Egypt, Hasankeyf and Jerusalem.
  Jerusalem can proclaim the **Kingdom of Heaven** at 80% of the Levant, which makes it a Catholic
  theocracy with +1 reform slot
- **Germany and the Low Countries:** advance sets for about 30 countries, including Bavaria, Saxony,
  Brandenburg, Prussia, Austria, Bohemia, Flanders, the Netherlands, Luxembourg, Lorraine and the
  Palatinate; 13 Swiss advances; the **Crown of Great Moravia** decision (empire rank, own reform)
  and the Hansa's **Hanseatic Merchant Federation** decision
- **France:** new advances for France, Provence, Occitania, Brittany and Burgundy
- **British Isles:** new advances for Wales, Northumberland, Mann and Cornwall, and advance sets for
  14 Irish states
- **Iberia:** new advances for Galicia and Asturias
- the **Turmoil in Brandenburg** disaster is disabled

### Pops, Map and Campaign Setup

- the **Hansa** starts as a landed country holding Lübeck, Hamburg and Bremen. Its kontors keep
  working
- many landless start vassals are folded into their overlords (Wales, Ireland, France, the
  Palatinate, Trier and others)
- Moravia starts independent, Slovakia as a Hungarian vassal
- new Balkan duchies **Sumadija** and **Banat**; Croatian and Slavonian borders redrawn
- border changes in Italy, Germany, France, the British Isles and Ireland
- pop updates for the Italian states, Germany, the Hansa, Flanders and Crimea
- Kaffa gets more buildings, and Kaffa and Lusta more development
- the Black Death also starts in Crimea
- Tunis starts at war with Tlemcen over Algiers
- Castile starts with 15 galleys in Seville

### Formables

- new or reworked: Germany, the Holy Roman Empire, Bohemia, Prussia, Switzerland, Pomerania, Swabia,
  Westphalia, Franconia, Hanover, the Netherlands, Belgium, Holstein, Lotharingia, Occitania, Italy,
  Dalmatia, Sardinia-Piedmont, the Two Sicilies, Tuscany, Ulster, Connacht, Munster, the Qara
  Qoyunlu, the Aq Qoyunlu, Taurica and Gothia
- **Taurica** replaces the Crimea formable
- steppe and Central Asian formables are one tier lower (Golden Horde, Nogai, Astrakhan, Kazan,
  Greater Khorasan, Bukhara, Chagatai, Uzbek, Transoxiana, Khiva and others)
- **Pontus** needs 80% of its locations [was 75%]

### UI and Quality of Life

- with the Time Steps game rule on Hourly, game speeds 1 to 4 run at 2 / 1.5 / 1 / 0.75 seconds a day [vanilla 6 / 3
  / 1.2 / 0.6]. Speed 5 stays uncapped
- **Expel Trade Offices** and **Expel Fondacos, Kontors and Enclaves:** the country list greys out
  countries that have no trade posts in your land and says why. Before, the whole action was greyed
  out
- many regional and unit advances, plus Deus Vult, Lesser Infiltration and the supply depot advances,
  have new places in the advancement tree and new icons

## game.1.4.8.mod.29

Since game.1.4.6.mod.28 → game.1.4.8.mod.29:

### Patch Compatibility

- updated for game 1.4.8, the 1.4.7 changes included. Play this version on 1.4.8: some of the
  updated files use script that game 1.4.7 does not have

### Battles and Armies

- cavalry needs ten times the horses: every horse unit pays ×10 horses to build, reinforce and
  maintain, and every camel unit ×10 camels. Their other goods are unchanged
- cavalry combat power by age, from Traditions to Revolutions: 2.2 / 2.4 / 2.6 / 2.85 / 3.0 / 3.2
  [vanilla 2.6 / 2.6 / 2.6 / 2.85 / 3.25 / 3.25]. Light and heavy cavalry, mercenaries included
- cavalry maintenance costs 6% of its men in manpower a month [vanilla 4%; infantry 2%]
- land battle damage is back to vanilla [was doubled]
- heavy infantry combat speed is back to vanilla 2 [was 2.25]
- armies and navies move at vanilla speed again [was 25% slower]
- tribal levies raise 350-man regiments [was 400, vanilla 200]: Tribal Cavalry, Tribal Camelry and
  the Zenata, Sanhaja, Tuareg and Hilali levies

### Buildings and Reforms

- **Stud Farm:** at most 2 levels per location
- **Hanseatic Kontor:** fixed an error in its definition that could drop the limit to Hanseatic
  League members

### UI and Quality of Life

- economy panel: a checkbox beside the army maintenance slider stops reinforcement in all your
  armies. While it is off your regiments do not refill and cost nothing to reinforce. The AI does
  not use it
- **Expel Trade Offices** and **Expel Fondacos, Kontors and Enclaves** have their own messages for
  both sides, with toggles in the message settings
- regiment, mercenary and battle tooltips: fixed the rules that hide ship-only stats on land units

## game.1.4.6.mod.28

Since game.1.4.6.mod.27 → game.1.4.6.mod.28:

### Patch Compatibility

- built and checked on game 1.4.6. The 1.4.7 update is not in this version yet: where the mod
  replaces a base-game file, 1.4.7's changes to that file do not apply

### Battles and Armies

- land battles end sooner: strength and morale damage are doubled
- heavy infantry combat speed 2.25 [vanilla 2]: reserve regiments join the front line more often,
  so big infantry armies get to use their reserves
- armies and navies move 25% slower
- tribal levies raise 400-man regiments [vanilla 200]: Tribal Cavalry, Tribal Camelry and the
  Zenata, Sanhaja, Tuareg and Hilali levies. The same men in half as many regiments

### Focus Picks

- Levy: **Designated Instruction** gives +15% levy combat efficiency [was +30%]

### War, Wargoals and Peace

- **Restore Roman Borders** CB: conquer cost for the attacker −40% [vanilla −50%]

### National Flavour

- Across the Pillars: Sanhaja, Zenata and Tuareg cavalry levies raise 2% of tribesmen [was 3%,
  vanilla 10%]
- Across the Pillars: Masmuda tribesmen still raise Atlas Infantry and do not switch to the bigger
  Tribal Cavalry
- Battle for the Strait: Castile can only **Vassalize Granada** while the AI plays Granada
- Battle for the Strait: Portugal and Granada no longer get the event that makes them ally Castile
  or Morocco or lose prestige and legitimacy

### UI and Quality of Life

- multiplayer events wait 5 months before their first option is taken for you [vanilla 3]

## game.1.4.6.mod.27

Since game.1.4.4.mod.26 → game.1.4.6.mod.27:

### Patch Compatibility

- updated for game 1.4.6 (supports 1.4.\*) and the Across the Pillars DLC
- start a new game for this version: the focus picks and setup changes do not reach existing saves
- more edits the 1.4 update had dropped are back, as in mod.25: no release cost on the coalition
  wargoal, no −10% art chance for Christians, the mod's societal value effects and Occitania's map
  colour

### Focus Picks

- **Focus Picks replace the age focus:** from the Age of Renaissance on, each new age lets you pick
  one of three Economic focuses and one of three Military focuses, and each focus unlocks its own
  advances. Pick in the Focus Picks panel, opened from the notice when an age starts or from the
  button in the top bar. A pick can be changed until you have researched one of its advances. The AI
  does not pick
- Renaissance: Court, Trade, Influence; Levy, Mercenary, Standing Forces
- Discovery: Infrastructure, Exploration, Espionage; Quality, Quantity, Leadership
- Reformation: Religion, Expansion, Humanism; Offense, Defense, Balanced
- Absolutism: Administration, Commerce, Diplomatic; Maneuver, Logistics, Firepower
- Revolutions: Industry, Empire, Innovation; Voluntary Service, Conscription, Insurrection
- every advance and value, with the history of changes:
  https://claude.ai/artifact/29vc2LhdPrB3yGwZ2P5MQT

### New Diplomatic Actions

- **Sabotage Fort** (Espionage focus): at war, turn every soldier pop in an enemy location into
  peasants, leaving its fort with nobody to work it. Costs 50 spy network and gold worth 3 months of
  the target's income, at least 25. Capitals are immune. You can use it once every 2 years, and a
  sabotaged country cannot be targeted again by anyone for 2 years
- **Lesser Infiltration** (Renaissance advance): lifts the fog of war over a country for 3 months,
  for 50 spy network
- **Trade Office Rights:** between players, building a Trade Office now needs the location owner's
  permission, which can be offered, requested and revoked. Revoking leaves existing offices
  standing, and anything involving the AI works as before
- **Expel Trade Offices:** destroy every Trade Office a country holds in your lands and revoke its
  rights, for one diplomat
- **Expel Fondacos, Kontors and Enclaves:** the same for those trade posts, but the victim gets a
  casus belli against you for 10 years, and your trade income, merchant capacity and trade range
  drop 10% for 10 years

### Changes to Vanilla Diplomatic Actions

- Steal Technology needs the Industrial Espionage advance from the Espionage focus, and no longer
  costs the target research progress. You still gain 20% of its progress
- back as in mod.25: hegemons can ally each other, and alliances and guarantees get no bonus from
  shared rivals

### Mercenaries

- **mercenaries follow the age** (by Stabshot): companies now use the units of the current age, not
  whatever the location's owner has researched, and each one shows an age badge
- hiring costs are back to the base game: hire premium 0.4 [was 1.0], hiring prisoners 0.25 [was
  1.0]
- Great Power status gives no mercenary range again [the 1.4 update had brought back +50%]

### Buildings and Reforms

- **Trade Office:** at most 1 level in a town, 2 in a city and 3 in a megalopolis, for each country.
  [vanilla about 10 in a city]
- **Fondaco:** any merchant republic except the Hansa can build one, not only Italian ones, with
  twice the base game's effects, but only one level and only one trade post per location
- **Hanseatic Kontor:** one level, and it shares that one trade post per location with fondacos
- **Merchant Enclave:** a new trade post with about 75% of a fondaco's effects, for the Chinese
  Meritocratic Government, Indian Maritime League, Bazaar Republic, Bengaleese Meritocracy and Trade
  Emporium. It needs fondaco rights
- Trade Offices, Fondacos, Kontors and Enclaves all use the expensive building price, 200 to 5,000
  gold by age. [vanilla 50 to 1,200]
- **Merchant Republic:** Christian countries in western and eastern Europe can always take it. North
  Africa and the Middle East need 50 or more in four mercantile societal values, and it no longer
  lowers integration speed
- **Trade Emporium:** now also in North Africa. +25% merchant capacity, merchant power and trades
  per burgher [was +20%], +25% foreign construction and sea trade efficiency [was +50%], −5% noble
  satisfaction [was −2.5%]
- **Chinese Meritocratic Government** (was Republic): monarchies can take it too, it no longer
  changes succession, and its trade bonuses are lower: +20% merchant capacity and maintenance
  efficiency [was +25%], +20% foreign construction [was +50%], smaller selling efficiency
- advances that give trade land efficiency now give the game 1.4 strength, about half of what they
  gave in mod.26

### National Flavour

- Zimbabwe's advances are again for Zimbabwe and Mutapa only, not every Shona country
- Across the Pillars: Sanhaja, Zenata and Tuareg cavalry levies raise 3% of tribesmen. [vanilla 10%]

### Pops, Map and Campaign Setup

- Catalonia, Andorra, Mallorca, León, Granada, Navarre and Morocco start with their Across the
  Pillars reforms, laws and privileges if you own the DLC
- 15 tribal countries that started without a succession law now have one
- Hanseatic Kontors start at level 1, and starting Trade Offices fit the new level cap

### UI and Quality of Life

- **Advanced Create Town map mode:** which rural settlements to raise to a town first, by how much
  of the raw goods a town cuts and what that does to food
- map modes now work for observers

## game.1.4.4.mod.26

Since game.1.3.11.mod.25 → game.1.4.4.mod.26:

### Patch Compatibility

- updated for game 1.4.4 (supports 1.4.\*): every base-game file the mod replaces was re-based on
  1.4.4 — interface, diplomacy, laws, the HRE, buildings, levies, advances and the 1337 start (pops,
  buildings, roads, diplomacy and country cultures). 1.3 saves load and keep running

### UI and Quality of Life

- **New map modes:** **Bailiffs** (next to Max Control) shows where a Bailiff pays off: rural,
  integrated or core locations with a tax base of 8 or more, and those with high-value raw goods
  (wool, iron, silver, gold, saffron, dyes and similar) even before the tax base is there. **Create
  Town** and **Create City** (next to Location Rank) rank your locations for urbanising: cheap goods
  first, food staples last (food 8+ after food 5 after food 3–4), high-value goods kept rural, and
  rich locations with medium-value goods (lumber, fibre, ...) lower than cheap ones; stripes mark
  locations still short of the population the next rank needs (5,000 / 30,000)
- the campaign timeline button is gone from the age bar, where it sat under the MP rank and Tier
  List; the timeline is still in the decisions screen
- observers no longer get the player-only MP counters, rank label and partner lists, which had no
  country to read and logged an error every frame
- generating a new game is about 2 minutes faster

### Pops, Map and Campaign Setup

- institution spread from neighbours follows game 1.4's vanilla increase: friendly neighbours +25%,
  any neighbour ×2. The mod still favours spread from any neighbour over friendly ones

### Crusades and Jihads

- the 100-year cooldown on calling a Jihad now actually applies — the override that added it was
  silently ignored by the game

### Economy and Gold-Transfers

- **Send Economic Support:** the "agreed" and cancellation popups show proper text instead of raw
  keys

### New Diplomatic Actions

- **Player Coalition:** the members' opinion bonus of each other now reads "In Coalition Together"
  instead of a raw key

### National Flavour

- **Siguntur — Rajo Tigo Selo** now requires Pike and Shot [was a Japanese-only ship advance, which
  Siguntur cannot research]
- **Fars — Diplomatic Prudence** now gives its +0.05 monthly diplomats [the bonus never applied]

## game.1.3.11.mod.25

Since game.1.3.11.mod.24 → game.1.3.11.mod.25:

### New Diplomatic Actions

- **Player Coalition:** can now target a multiplayer **Great Power or Major Power** [was Great Power
  only]

## game.1.3.11.mod.24

Since game.1.3.11.mod.23 → game.1.3.11.mod.24:

### New Diplomatic Actions

- **Player Coalition:** joining now requires **more than 50 antagonism** toward the target, and members
  leave once it drops **below 30** while not at war with the target — the same thresholds as the
  vanilla coalition. This applies to the leader too, whose leaving dissolves the coalition. Opinion
  and diplomatic range are still not required

### National Flavour

- **Genoese Crossbowmen** advance: +10% light infantry power and +10% heavy infantry power [was +20%
  light infantry power]; the Genoese Crossbowmen unit also deals +10% morale damage
- **Late Genoese Crossbowmen, Genoese Arquebusiers, Genoese Musketeers and Genoese Riflemen:** −1
  initiative [Musketeers and Riflemen were +1] and a −10% wetlands combat penalty [was −15%];
  Genoese Riflemen take 10% less strength and morale damage [was 5%]
- **Venetian Stradioti** advance no longer gives +15% light cavalry power
- **Italian Stradioti** deal +10% morale damage and get +1 combat speed instead of +1 initiative,
  matching the Venetian Stradioti
- **Late Balestrieri** lose their +1 initiative

## game.1.3.11.mod.23

Since game.1.3.11.mod.22 → game.1.3.11.mod.23:

### New Diplomatic Actions

- **Player Coalition:** a new coalition that only players can found or join, aimed at a multiplayer
  Great Power. It needs no antagonism, opinion or diplomatic range toward the target; subjects
  (tributaries excepted), countries with a truce, union or subject tie to the target, and countries
  already in a player coalition against it cannot join. AI countries never join. Members defend each
  other if the target attacks one of them, and the coalition can declare war with the regular
  Coalition casus belli, which **only the coalition leader** holds and uses to rally the members.
  Coalition members cannot ally or share vision with the target, and a new **Dissolve Player
  Coalition** peace term bars the members from forming another one against the winner for 15 years
- **Pay for Military Access, Pay for Fleet Basing Rights and Pay for Food Access are removed** — they
  could be used to move gold between players. Pay for Trade Access and Pay for Fondaco Rights remain
- The mod's diplomatic actions (the Pay for actions, Send Economic Support, Break Others' Guarantee)
  can no longer target your own country

### Changes to Vanilla Diplomatic Actions

- **Requesting military access or fleet basing rights no longer costs favours** [vanilla 5 favours]

### War, Wargoals and Peace

- **Take Down Hegemon is now "Take Down Great Power":** it targets the **top 3 Great Powers** of the
  multiplayer ranking instead of the hegemon, and cannot be used by a top-3 Great Power
- **Coalition CB:** attacker conquer and subjugate cost 0.65 [was 0.75]; the defender stays at 1.25
- **Take Down Great Power, Imperialism and the revolution casus belli** (take-capital wargoal):
  conquer and subjugate cost 0.70 on both sides [was 0.60]

### National Flavour

- The **Sakoku Law** event can now fire for **Western Japan** as intended

### UI and Quality of Life

- Paying for trade access or fondaco rights now shows in the message log for both sides

## game.1.3.11.mod.22

Since game.1.3.11.mod.21 → game.1.3.11.mod.22:

### Enforce Peace

- **An unanswered Enforce Peace now counts as a refusal.** If the attacker lets the demand time out,
  the enforcer joins the war on the defender's side — ignoring it no longer ends the war in a white
  peace

### Economy and Gold-Transfers

- The vanilla Send Economic Support now reads **"(AGAINST THE RULES) Send Economic Support"**, so the
  warning stays visible when the diplomacy list cuts long button names short

## game.1.3.11.mod.21

Since game.1.3.11.mod.20 → game.1.3.11.mod.21:

### War, Wargoals and Peace

- **Lack of control lowers a location's warscore again.** The per-age values (0.2 / 0.4 / 0.6 / 0.8 /
  1.0 / 1.0) had the wrong sign, so land you held only loosely was adding warscore instead of
  costing less

### Economy and Gold-Transfers

- **Loans between countries are capped at 10% interest** [vanilla 25%], so a loan can no longer be
  used to move large sums between players
- **Send Economic Support cut to a quarter of its previous cap:** at most a quarter of the
  recipient's tax base per month [was its full tax base], and never more than two and a half months
  of the sender's income [was ten]

## game.1.3.11.mod.20

Since game.1.3.11.mod.19 → game.1.3.11.mod.20:

### Diplomatic Limits

- **Alliances that lapse downgrade into a guarantee again.** When an alliance expires on its own and
  one side outranks the other and is allowed to guarantee it, the guarantee is created as intended —
  the downgrade was written in a form the engine cannot evaluate when it ends an alliance by itself,
  so it never ran

### War, Wargoals and Peace

- **Dissolving the Hanseatic League** now costs the full 100 warscore cap instead of 90

### National Flavour

- **Cathar** countries gain the **Monasticism** and **Sola Scriptura** religious aspects, which the
  base game reserves for other faiths

### Pops, Map and Campaign Setup

- **Western and Eastern Japan** now have map colours of their own
- **The imperial Mongol tag now reads "Mongol Empire"** instead of being displayed as "Mongolia"
  alongside the Mongolia tag
- **Ireland is formable again** — its requirements referred to the Lordship of Ireland, which the mod
  removes, so they could never resolve. The separate Lord of Ireland formable, which needs that
  organisation to exist, is disabled
- **Pontus** is now also formable by Ligurian countries

### UI and Quality of Life

- Maintenance costs on the **Sofa Stockade, Jesuit College, Mamluk Barracks and Monastery
  Stronghold** read as proper names instead of raw text keys
- The right-panel buttons — **Ledger, Find Location, Europedia, Automation, Hints and Menu** — have
  their tooltips back instead of raw text keys
- Requesting an **alliance** or **Vision Sharing**, and breaking either, now sort under the correct
  friendly and hostile headings in the diplomacy list
- Leftovers of removed content are no longer offered: the **Reform Taxation System** cabinet action,
  tied to the cut Chinese dynasty crisis, and the Delhi-only **Seize Opposition Leadership** peace
  demand

## game.1.3.11.mod.19

Since game.1.3.11.mod.18 → game.1.3.11.mod.19:

### Colonial Nations

- **18 New World and colonial formables**, each with its own flag, map colour and country name, and
  each raised to at least kingdom rank on formation. North America: the **USA**, **Mexica**,
  **Canada**, **Alaska**, **Cascadia**, **Quebec**, **Sonora**, **Texas**, **Vermont** and the **West
  Indies**. South America: **Brazil**, **Peru**, **Colombia**, **Argentina** and **Bolivia**. Oceania:
  **Australia** and **New Zealand**. India: the **East India Company**
- **Every one of them has its own advancement set**, built from that country's EU4 national ideas —
  18 sets in all, spanning the Age of Discovery onward
- **Eleven advances shared by every colonial nation**, two per age: *Colonial Tradition* (+0.2%
  population growth) and *Colonial Heritage* (+0.5% monthly development); *Founding Fathers* (+0.05
  monthly republican tradition) and *Colonial Militia* (+10% levy size); *New Frontiers* (+25%
  colonial migration size, +20% colonial maintenance efficiency) and *Continental Trade* (+25% trade
  protection); *Free Thinkers* (+5 maximum literacy) and *Manufacturing Center* (+production
  efficiency); *Colonial Assembly* (+1 government size) and *Liberty Heroes* (+20% combat speed); and
  *Colonial Ambition* (+10% land morale) in the Age of Revolutions
- Colonial nations can take a **Colonial Representation Law** advance from the Age of Discovery

### Buildings and Reforms

- **Colonial Republic**, a new government reform for republics with a capital in the Americas or
  Oceania: +1 government reform slot, +20% maritime presence, and much cheaper sea, port, road and
  land costs over distance from the capital
- **Trade Emporium**, a new major government reform for republics and monarchies whose original
  capital lies in West Africa, East Africa, Southeast Asia or the Middle East: +20% merchant capacity,
  merchant power and trades per burgher, +50% foreign construction efficiency and sea trade
  efficiency, and +15 court-language importance, against −5% crown estate power and −2.5% noble
  satisfaction. It pushes the country toward capital economy, innovation and naval focus

### Diplomatic Limits

- **Alliance eligibility is actually checked again.** The mod's alliance rule — opinion at or above 0,
  no rivals, no coalition partners, no subjects, and the block on two Great Powers allying — was being
  called in a form the engine could not evaluate, so none of it applied. It now gates both offering an
  alliance and the automatic expiry of one, and the alliance screen says plainly when two Great Powers
  cannot ally

### National Flavour

- **Genoa** now elects its Doge through the diarchic election rather than the standard merchant
  republic doge election
- **The Arabia formable** required provinces the game does not recognise, so its land requirement
  never resolved; it now reads the correct areas and provinces

### Pops, Map and Campaign Setup

- **Starting setup fixes** across India, Africa and Japan: corrected culture names for Ruthenian and
  Betsimisaraka pops, a country tag that collided with one of the new colonial tags, a malformed
  accepted-cultures list, and a set of laws, reforms, tributary relations and IO memberships that
  pointed at content which does not exist
- **Dead Middle Kingdom references removed:** the Provincial Garrison is now open to countries of
  Chinese culture, and the Korean *Sadae* event, which could never fire, is gone

### UI and Quality of Life

- **The mod's diplomatic actions now report themselves properly.** Enforce Peace, Send Economic
  Support, Forgive Half Antagonism and the rest produce real message-log entries and notifications,
  with their own toggles in the message settings, instead of raw text keys
- Text that showed as raw keys now reads properly: the **Religious War** casus belli, the **Vision
  Sharing** relation, the confirmation prompts for **Break Their Guarantee** and **Worsen Opinion**,
  the crusade and jihad cooldown notices, and the maintenance goods for the Kurultai, Stockade and
  Order Headquarters

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
