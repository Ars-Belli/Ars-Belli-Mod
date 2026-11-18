# **Ars Belli Mod \- Design Document**

# **by Lynx**

**NOTE:** Various parts of this document were written at different times. Numbers and specific changes detailed within may no longer be accurate to the current values and setup ingame. The general approach to changes, the philosophy behind them and the ultimate aims of the Mod remain the same.

  ## **Age Focuses** {#age-focuses}

When the concept of *Idea Groups* was merged into the *Advances* system this was a step forward overall but a lot of **country customisation was lost**. Age Focuses help somewhat but they are a bit lacking in several areas at the moment. First the **number of choices is limited** to 5 picks per game, with only 3 options to pick from per Age. Secondly the **advances granted by each focus are a mess** with *naval* and *land* military techs being in the same pick, or *Diplomatic Focus* granting bonuses that have little use later in the game (subject bonuses in Age V & VI). Thirdly, the fact that the choice is between military and non-military bonuses often **forces players to pick military by default** in a multiplayer environment.

My **proposed solution** to the above is to present **2 focus picks per Age**, first a choice between 3 economy or diplomacy related focuses and second a choice between 3 military focuses with one of them being a naval focus \- **1 Eco Pick \+ 1 Military Pick**. Important considerations regarding these:

* All focus picks being a choice right from the start (like with *Idea Groups*) encourages a specific meta to eventually arise where the ‘best picks’ are always the same every game and all others are ignored. By making the choice be between only the 3 in the current Age we can ensure that **between those three all are viable in their own niche way.**

* It is important to consider balance between the picks both **horizontally** in the same Age (as detailed above) and **vertically** between the Ages. The former is self explanatory, as for the latter the concern is too much modifier stacking as the Ages go on leading to gameplay distortions. It is preferable instead to give bonuses that influence how the game is played beyond just the raw power increase they give. E.g. *drill* instead of *discipline* to increase quality.
* For military picks the choice should be between 2 land based picks such as **Levy-Mercenary** or **Offensive-Defensive**. The aim is for the pick to be based on context and personal preference not which one ‘grants the bigger stat buff’. For the third *naval pick* the variation should be between **Galley** and **Heavy Ship** bonuses in consecutive ages with another aspect of naval gameplay attached each age (e.g. Renaissance with Galley bonuses and an early unlock of *Privateering*). The idea here is to not make it mandatory for naval based countries to pick the naval focus each time, but to **give them the opportunity to pick up some land military focuses** of their own as well.

* In the case of the economic picks the aim is to keep each pick centered around an area of gameplay. Examples are *Vassals* (diplo), *Trade* (eco), *Espionage* (diplo), *Humanism* (religion). This should make each pick more impactful and in the case of the diplo focuses making them viable without mixing in singular overpowered advancements.

In the following section we will look at the **Focus Picks**. Techs will be marked with a **roman numeral** to denote the *Age* they were originally from, the **capital letters**  **A/D/M** will denote which *Age Focus* they belonged to, **T** will show if they were part of the *Tech Tree* and **N** for *entirely new* advances (if they are a *combination* of two previously existing advances there will be an **AND** between them). **Keep in mind that any numbers and changes below are to be considered a draft and not final.**

### **Economic Focus Picks**  {#economic-focus-picks}

| Age of Renaissance \- Economic Picks |  |  |
| ----- | ----- | ----- |
| **Court** | **Trade** | **Influence** |
| \[A-II\] Thirst for Knowledge: \+5% Max Literacy | \[D-II\] Shrewd Commerce: \+10% Market Attraction (was 5%) | \[D-II\] Integrated Elites: \+0.10 Monthly Diplomats  **AND**  \[D-IV\] Grand Banquets: \+1 Maximum Diplomats |
| \[A-II\] Local Infrastructure: \+10% Proximity Speed | \[D-II\] Merchant Traditions: \+10% Trade Maritime Advantage | \[D-II\] Tribute System: \+2.5% Subject Income  **AND**  \[D-V\] Subject Emissaries: \+25 Subject Opinions |
| \[A-II\] Court Accounting: \-1% Expected Cost of Court | \[A-III\] Additional Merchants: \+25% Trade Capacity | \[D-II\] Marcher Lords: Unlocks 'March' subject type |
| \[A-III\] Dynamic Court: \+10% Efficiency of Our Cabinet (was 5%) | \[D-III\] Merchant Adventures: \-10% Trade Range Used Over Sea | \[D-VI\] Buffer States: \+1 Diplomatic Capacity  **AND** \[D-II\] Experienced Diplomats: \+2 Diplomatic Reputation |
| \[A-II\] Church Attendance Duty: \+0.02 Stability Investment | \[A-II\] Debt and Loans: \-1% Bank Interest | \[D-II\] Benign Diplomats: \+25% Improve Relations (was 20%) |
| \[A-II\] Empiricism: \+20% (was 10%) Legislative Efficiency / *Set Policy Cost \-66% / Change Policy Cost \-20%* (both new) | **\[N\]** Protected Trade Caravans: \-10% Trade Range Used Over Land | \[D-VI\] Additional Loyalist Recruitment: \+5 Loyalty of Subjects |

* **Court** is a standard Admin/Economy type tree. Of note is *Empiricism* which originally only gave a paltry 10% Legislative Efficiency. I tried to find some less used bonuses to spice it up but it’s still mostly just a filler *on its own*.

* **Trade** is self explanatory. Bank interest was moved as it fits with the theme more. *Protected Trade Caravans* is a new advance made to give a counterpart to *Merchant Adventures* that is useful to land-locked countries (though in general the trade focused trees are by their nature more useful for naval based countries).

* **Influence** is focused on Vassal gameplay. By moving these advances earlier and concentrating them in one *Focus Pick* the player can make a lot better use of them (as an example look at *Additional Loyalist Recruitment* which was originally an Age VI advance). Three advances here are a combination of 2 previously separate techs as well.

| Age of Discovery \- Economic Picks |  |  |
| ----- | ----- | ----- |
| **Infrastructure** | **Exploration** | **Diplomatic** |
| \[A-III\] Organized Construction: \-10% Building Cost | \[D-III\] Quest for the New World: \+0.10 Exp. Monthly Prog. / \-25% Exp. Prep. Time (was 10%) | \[D-VI\] Flexible Negotiation: \-5% War Score Cost **AND** \[D-II\] Pressuring Diplomacy: \-5% War Score Cost |
| \[A-III\] Efficient Construction Plans: \-10% Urban Buildings Cost | \[D-III\] Exploration Ideas: \+500 Colonial Range / Unlocks 'Exploration' Casus Belli | \[D-V\] Formal Diplomacy: \+2 Diplomatic Reputation **AND** \[A-VI\] Benevolence: \+30% Improve Relations (was 33%) |
| \[A-IV\] Expanded Infrastructure Network: \-10% Road Building Time / \-10% Road Cost | \[D-III\] Fortune Seekers: \+50% Colonial Range | \[D-IV\] Diplomatic Influence: \+2 Diplomatic Reputation **AND** \[A-V\] Additional Diplomats: \+1 Diplomatic Capacity |
| \[A-III\] Efficient Mining: \-10% Expand Mining Cost / \+10% Iron & Copper Output | \[A-III\] Faster Colonists: \+50% Monthly Colonial Migration | \[M-III\] Adaptability: \-10% Antagonism Received **AND** \[D-V\] State Propaganda: \-20% Antagonism Received |
| \[M-IV\] Improved Storehouses: \+2.5% Local Access to Raw Materials | \[D-III\] Colonial Ventures: \+50% Monthly Colonial Migration | \[D-V\] Diplomatic Corps: \+0.10 Monthly Diplomats **AND** \[D-II\] Claim Fabrication: \+25% Casus Belli Creation Speed |
| \[A-IV\] Advanced Bureaucracy: \+2% Tax Efficiency | \[D-III\] Overseas Trade: \+50% Trade Range | \[A-VI\] Indirect Rule: \-10% Separatism **AND** \[A-III\] A Seed Among Thorns: \+10% Speed of Integration |

* **The Age of Discovery Eco Picks** are perhaps the most game defining out of all the ages. They have to be due to the timing, as they are competing against *Exploration*…
* **Infrastructure** contains purely economic buffs. A solid default pick for countries that don’t make use of the other two. No new advances here, only original ones were moved around.

* **Exploration** is basically the original *Age of Discovery Diplo Focus* with the non-colonization related advances removed. It is also categorized as a **Trade** Focus Pick as the way to make good money out of colonization is through trade (the advance Overseas Trade is by itself a very substantial buff) and trade focused countries will also want to colonize for the range to reach new markets.

* **Diplomatic** is focused on the aspects of diplo related to **conquest**. At the beginning of Age III it comes early enough to be fairly impactful. Note how every single advance is a combination of two previously existing advances showing just how undertuned they were originally.

| Age of Reformation \- Economic Picks |  |  |
| ----- | ----- | ----- |
| **Religion** | **Expansion** | **Humanism** |
| \[A-IV\] Devoutness: \+1 Tolerance of the True Faith | \[D-IV\] Free Colonies: \-20% Colonial Maintenance | \[A-IV\] Ecumenism: \+1.5 Tolerance of Heretical Beliefs (was 1\) |
| \[A-IV\] Religious Tradition: \+0.1 Monthly Prestige / *\+20% Cultural Tradition* (new) | \[D-IV\] Land of Opportunity: \+50% Colonial Migration | \[A-IV\] Humanist Tolerance: \+1.5 Tolerance of Heathen Beliefs (was 1\) |
| **\[N\]** Cultural Unity: \+20% Pop Assimilation Speed | \[A-V\] Additional Colonists: \+50% Colonial Migration | **\[N\]** Integration of Cultures: \-50% Add Accepted Culture Cost / \-50% Change Primary Culture Cost |
| \[A-III\] Preaching Missions: \+10% Pop Conversion Speed / \+10% Pop Assimilation Speed | \[D-V\] Viceroys: \+50% Income from Colonial Subjects / \+25% Diplomatic Range | \[A-IV\] Cultural Ties: \+2 Cultures Capacity |
| \[A-IV\] Divine Supremacy: \+10% Pop Conversion Speed**AND** \[A-V\] Religious Unification: \+10% Pop Conversion Speed | \[D-VI\] Merchant Fleets: \+10% Trade Maritime Advantage | **\[N\]** Compromise: \-0.001 Monthly Rebel Growth / \-0.001 Monthly Religious Rebel Growth / \-0.05 Pop Leave Rebels Threshold |
| \[A-III\] Missionary Schools: \+10 (flat\!) Pop Conversion Speed | \[D-VI\] Overseas Merchants: \+50% Trade Range | \[M-IV\] Multicultural Ambitions: \+25% Cultures Capacity |

* **Age of Reformation** is where I originally intended to place the last diplo related Pick in **Espionage** but as the name suggests this is the last age where religious bonuses can be used to their full potential so I decided to go with **Religion \- Humanism** instead.

* **Religion** is about converting people to the *True Faith* but also about assimilating *Culture*. I disagree with the way PDX associates *Spiritualism* with cultural tolerance, but further changes with regards to that will have to wait for another day.

* **Expansion** contains the last remaining colonization related advances (some brought forward from Age V where it’s way too late to place them) with a secondary trade theme.

* **Humanism** is about both religious and cultural tolerance with all associated bonuses gathered here. New advances were made to fill the empty slots making use of less used modifiers.

| Age of Absolutism \- Economic Picks |  |  |
| ----- | ----- | ----- |
| **Administration** | **Commerce** | **Espionage** |
| \[D-IV\] Cabinet: \+20% Efficiency of Our Cabinet | \[A-IV\] Competitive Merchants: \+20% Trade Advantage | \[D-III\] Vetting: \+33% Counterespionage |
| \[A-IV\] National Bank: \+10% Income From Minting | \[D-V\] National Trade Policy: \+2.5% Trade Efficiency | \[D-III\] Efficient Spies: \+50% Spy Network Construction |
| \[A-V\] Civil Service: \+0.10 Monthly Control**AND**\[M-V\] Absolutist Administration: \+0.20 Monthly Control Decline | \[D-IV\] Fast Negotiations: \-10% Trade Maintenance | \[T-III\] Infiltrate Administration: Unlock 'Infiltrate Administration' action (the original version, a weaker version based on *Areas* should be placed where this was removed from) |
| \[A-VI\] Efficiency in Administration: \+25% Legislative Efficiency (was 10%) / *\-25% Change Policy Cost* (new) | \[D-IV\] Free Trade: \+10% Trade Capacity**AND**\[D-V\] National Trade: \+10% Trade Capacity | \[D-III\] Foreign Embassies: \+0.10 Monthly Diplomats **AND** \[D-V\] Agent Training: \+1 Maximum Diplomats |
| \[A-V\] Centralized Government: \+10% Proximity Speed | \[D-IV\] Trade Manipulation: \+10% Market Attraction (was 5%) | **\[N\]** Global Networks: \+50% Diplomatic Range / \+500 Diplomatic Range |
| \[A-V\] Subservient Economy: \+0.0010 Monthly Development | \[A-V\] Bookkeeping: \-1% Bank Interest | **\[N\]** Industrial Espionage: Unlock ‘Steal Research’ action |

* **Age of Absolutism** is the last age with Picks belonging to different categories as Diplo and Trade related advances are really hard to justify being placed in the Age of Revolutions.

* **Administration** contains some standout advances such as *Centralized Government* granting Proximity Speed or *Subservient Economy* granting Monthly Development but in my opinion some of the advances that look like filler at a glance are a lot better than they appear. As in this Age players gain the ability to *Increase Control in Area* the advance *Civil Service* granting faster control increase and slower decline is situationally very strong. *Efficiency in Administration* is fairly forgettable on its own, but stacked together with *Empiricism* from Age II it makes switching laws outside of Parliament possible if still expensive.

* **Commerce** is what it says on the tin. Almost all possible trade related modifiers are featured along with the final \-1% Bank Interest advance.

* **Espionage** is where all the overpowered mechanics go instead of being removed. It is also aimed at smaller countries in particular as they gain the same power from this as a larger country would (where for example Proximity Speed is obviously less useful to them in comparison). This should also help make them more appealing as an ally and a lot more threatening as an enemy as they can contribute a lot to their faction by providing intelligence through *Infiltrate Administration*. On the other hand *Steal Research* devalues all other research bonuses if granted to all countries by default, but instead of removing it I feel like its inclusion in *Espionage* is appropriate considering it comes fairly late in the campaign and limited to countries picking this focus. I really wanted this Focus Pick to be in *Age of Reformation*, but it should still be a decent option in its current spot.

| Age of Revolutions \- Economic Picks |  |  |
| ----- | ----- | ----- |
| **Industry** | **Empire** | **Innovation** |
| \[D-IV\] Audit Checks: \+5% Tax Efficiency | \[D-VI\] Global Empire: \+3% Tax Efficiency / \+5% Subject Income (was 2.5%) | **\[N\]** National Academy of Sciences: \+0.05 Monthly Research Progress |
| \[A-VI\] Formal Administration: \+1 Cabinet Seats | \[A-V\] Local Traditions: \+2.5% Estate Satisfaction Equilibrium | **\[N\]** The Scientific Method: \+25% Monthly Research Prog. |
| \[A-VI\] Smithian Economics: \+5% Production Efficiency / *\+0.0020 Monthly Development* (new) | \[D-VI\] Postal Service: \-1 Proximity Cost with Maritime Presence / \-2 Proximity cost through Roads | **\[N\]** Belle Epoque: \+50% Cultural Influence / \+50% Quality of Art / \+50% Direct Impact of Art / \+50% Artist Monthly Start Chance / \+50% Skill of New Artists |
| \[A-VI\] Regulation Bureau: \+2% Minting Threshold (was 1%) | \[M-VI\] Coastal Patrols: \-5 Proximity Cost through Port | \[A-V\] Humanism: \+10% Max Literacy |
| **\[N\]** Industrial Scale Extraction: \+20% Maximum RGO size | **\[N\]** Imperial Administration: \+1 Number of Local Governors | **\[N\]** Universal Literacy: \+0.10% Monthly Literacy |
| **\[N\]** Modern Extraction Methods: \+20% Raw Materials Output | **\[N\]** Overseas Holdings: \+1 Number of Naval Governors | \[A-VI\] Optimism: \-0.05 Monthly War Exhaustion |

* **Age of Revolutions**, being the final Age, features a notable increase in the power level of Focus Picks. This is intentional as any campaign lasting this long both needs a shake up in the game state and something for players to look forward to.

* **Industry** is the ‘Tall’ pick, giving strong economic bonuses related to producing more resources and making more gold. While the Monthly Development granted by *Smithian Economics* is a substantial bonus at over twice the strength compared to *Subservient Economy* the age before, it’s inclusion here is more about flavor and the satisfaction of seeing \#LineGoUp as much as possible.

* **Empire** is the ‘Wide’ pick, helping large empires make use of their territory by helping them spread control through extremely strong proximity bonuses and extra governors.

* **Innovation** is the ‘Science’ pick, with bonuses related to research and literacy. Four new advances here with very high numbers as the research techs need to ‘make back’ the investment required to get them before the Age ends. While the Art system is currently very undertuned I think with 50% Cultural Influence *Belle Epoque* is still worth to research.

  ### **Military Focus Picks** {#military-focus-picks}

That’s it for Economic Picks. **With the Military I consider it especially important to avoid modifier stacking** and to give out simple numerical combat buffs as little as possible. Instead the aim is to present *meaningful choices* to the player that affect *how the game is played* not just how strong the armies are. As for the **Naval Picks** in particular **the objective is to make taking all of them non-mandatory** for Naval based countries, so as to let them get at least a few land buffs along the way. At the same time we should make it possible for Land based countries to make one naval pick without completely griefing.

| Age of Renaissance \- Military Picks |  |  |
| ----- | ----- | ----- |
| **Levy** | **Mercenary** | **Maritime** |
| \[M-II\] Enforced Service: \+10% Levy Size | \[A-II\] Benefits for Mercenaries: \-15% Mercenary Maintenance | \[M-III\] Improved Rams: \+15% Galley Power (was 25\) / *\-10% Galley Maintenance Cost* (new) |
| \[M-II\] Open Levy Standards: \+25% Non-Culture Levy Size | \[A-II\] Mercenary Recruitment: *\+50% Mercenary Range* (bonus was \-20% hire cost) | \[M-II\] Boarding Parties: \+10% Naval Damage Done |
| \[M-II\] Designated Instruction: \+10% Levy Combat Efficiency (lost 5% Levy Recovery) | \[A-III\] Organized Mercenary Payments: \-20% Hire Mercenary Premium Cost | \[M-II\] Marine Regiments: \+33% Army Disembark Speed (was 20%) |
| \[M-II\] Battlefield Commissions: \+100 Army Tradition from Battles | \[M-II\] Glorious Arms: \+100% Prestige from Land Battles | \[M-II\] Naval Glory: *\+100% Navy Tradition from Battles* / *\+100% Prestige from Naval Battles* (was \+0.10 Monthly Naval Tradition) |
| **\[N\]** Local Militias: \+33% Levy Recruitment Speed / \-50% Levy Maintenance | \[T-IV\] Ensure Mercenary Payments: \-75% Hire Mercenary Leader Cost (was \+20% Mercenary Size) | \[D-II\] Privateers: Can 'Hire Privateers' **AND** \[A-II\] Anti-Piracy Leagues: \+25% Anti-Piracy Warfare Modifier |
| **\[N\]** Feudal Obligations: \+10% Levy Recovery | \[M-II\] Ideas of Tolerance: *\+0.5 Heathen Tolerance / \+0.5 Heretic Tolerance* (was double) | \[D-III\] Ship's Penny: \+25% Ship-building Speed (was 10%) |

* The bonuses in the **Age of Renaissance** are chosen to be especially useful in the early game with some usefulness in later Ages, but not lock a country into any particular playstyle yet.

* **Levy** is buffing levies (duh) and is suitable for countries with large populations to get the most out of it. Importantly the \+10% Cav Power advance is nowhere to be seen as it’s one of the worst offenders when it comes to braindead numerical buffs that don’t represent a real choice, you just pick them up then forget about it. *Local Militias* is a filler, but I thought it important to not give too much power to this pick compared to the others.

* **Mercenary** is perfect for smaller countries with more money than pops. I tried to diversify the bonuses on offer, though *Ideas of Tolerance* is a bit tacked-on I admit. In the future this could be changed to a military buff if it is necessary but in my mind it goes well with the idea of a Merchant Republic present in many different places with locations holding multiple foreign cultures. *Ensure Mercenary Payments* now gives a cost reduction to hiring Merc Captains (you pay for them separately based on their skills). The way to really get the most out of this is to hire great captains with a single regiment, then merge them into an army. Admittedly this is perhaps not working as intended, but I wanted to make use of this unique modifier for the purpose of giving some flavor to the Focus Pick.

* **Maritime** is buffing *Galleys* as the main feature and it also unlocks *Privateering* an Age early. Most useful to the Mediterranean (Baltic?) countries of course but still has some more general bonuses to keep it relevant in later Ages for countries that *do want to go full Naval*.

| Age of Discovery \- Military Picks |  |  |
| ----- | ----- | ----- |
| **Quality** | **Quantity** | **Naval** |
| \[A-V\] Formalized Officer Corps: \+25% Army Initiative | **\[N\]** Rapid Reinforcement: \+10% Combat Speed | \[M-III\] Oak Forests for Ships: \+10% Heavy Ship Power (was 20%) / *\-10% Heavy Ship Maintenance Cost* (new) |
| \[M-III\] Administrative Leadership: \-25% Hire Advisor Cost / \-25% Train General Cost / \-25% Train Admiral Cost (was 10%) | \[M-IV\] Camp Followers: \+10% Supply Limit | **\[N\]** Patrol Vessels: \+10% Light Ship Power / \-20% Light Ship Build Cost / \-10% Light Ship Maintenance Cost |
| \[M-III\] Quality Education: \+0.10 Monthly Army Tradition | \[M-III\] The Old and Infirm: \-5% Army Maintenance | **\[N\]** Naval Education: \+0.10 Monthly Naval Tradition |
| **\[N\]** Drill Sergeants: \+50% Monthly Experience Gain  | **\[N\]** Deep Reserves: \-10% Army Reinforcement Cost | \[M-IV\] Copper Bottoms: \-25% Navy Attrition |
| **\[N\]** Trained March: \-0.02% Army Morale Movement Cost | \[M-IV\] Supply Trains: \-10% Unit Food Consumption | \[M-III\] Naval Drill: \+10% Navy Morale |
| \[M-III\] Military Drill: \+10% Army Morale | \[M-V\] Grand Army: \+10% Manpower | \[D-IV\] Grand Navy: \-10% Navy Maintenance |

* The **Age of Discovery** brings some more generally applicable bonuses than before. From here on out the land focused picks will be about choosing between two different sides of the same concept.

* **Quality** gives buffs to armies that apply to all Unit Categories equally (levies, mercs, regulars). The exception to this is *Drill Sergeants* which helps with unit quality indirectly through making drilling more effective, though the exact strength of this effect depends on the player actually using the mechanic. *Trained March* reduces Morale loss from movement by 20%. *Formalized Officer Corps* and *Military Drill* provide direct combat bonuses.

* **Quantity** grants few benefits to Levies and Mercenaries as most relate to reinforcement and manpower. Secondarily there are some advances relating to logistics. The \-10% Army Reinforcement Cost from *Deep Reserves* in particular will have to be kept an eye on as negative % bonuses can by their nature lead to extreme outcomes with modifier stacking (and this is a very important modifier).

* **Naval** is buffing *Heavy Ships* primarily with *Light Ships* getting substantial bonuses as well (they barely receive any bonuses throughout the whole game) Note that I do not intend to make them a viable alternative to Heavies and Galleys as the *main combatant* of a fleet though.

| Age of Reformation \- Military Picks |  |  |
| ----- | ----- | ----- |
| **Offense** | **Defense** | **Littoral Fleet** |
| \[M-IV\] Expanded Supply Trains: \-15% Army Attrition (was 10%) | \[M-IV\] Defensive Army: \+1% Hostile Attrition | **\[N\]:** Gun Galleys: \+10% Galley Power / \-20% Galley Build Cost |
| **\[N\]** Night Assaults: \+20% Assault Ability | \[M-IV\] Conscripted Garrisons: \+2.5% Garrison Growth (was 1%) / \+20% Garrison Size | \[M-III\] Naval Cadets: \+75% Navy Initiative (was 50%) |
| \[M-IV\] Engineer Corps: \+20% Siege Ability | \[M-IV\] Defensive Mentality: \+20% Fort Defense | \[D-VI\] Merchant Marine: \+20% Sailors |
| **\[N\]** Standardized Barrels: \-10% Artillery Build Cost / \+5% Cannon Output | **\[N\]** Earthworks: \-20% Fort Buildings Cost | \[A-VI\] Improved Shipyards: \+50% Ship-building Speed (was 25%) |
| \[M-V\] Superior Firepower: \+10% Artillery Power | \[A-VI\] Fortification Logistics: \-10% Fortification Maintenance | **\[N\]** Home Fleet: \+15% Combat Outside Own Coasts |
| **\[N\]** Siege Artillery: \+1 Artillery Bonus vs Fort | **\[N\]** Fortified Cities: \+10% Fort Limit / \+8 Fort Limit | \[D-V\] Sheltered Ports: \-15% Navy Repair Cost (was 20%) |

* **The Age of Reformation** offers a choice between Offense and Defense, keeping with the theme of the original Mil Focus.

* **Offense** is, predictably, about sieging with a secondary focus on Artillery. There exists an imbalance in the original focus where *Assault Ability* is simply missing, but *Night Assaults* rectifies this. The \+1 Artillery Bonus from *Siege Artillery* gives a different buff when compared to Siege Ability as this also requires an investment into artillery to function (additionally it buffs the roll itself instead of shortening time between siege ticks).

* **Defense** now gives access to an additional advance raising *Fort Limit* which is going to be useful to keep up with the requirements for *Bastions*. The bonus from *Earthworks* is yet another \-% modifier so depending on the country modifier stacking could get a little crazy \- gotta keep an eye on this.

* **Littoral Fleet** is the final Focus Pick for *Galleys*. The advances here are specifically chosen to be a good entry point into the Naval Game for countries that have not invested into a navy before. \+50% Ship-building speed, \+20% Sailors and \-20% Galley Build Cost combined help with rapidly building up a navy.

| Age of Absolutism \- Military Picks |  |  |
| ----- | ----- | ----- |
| **Maneuver** | **Logistics** | **Highseas Fleet** |
| \[M-III\] Improved Maneuver: \+10% Combat Speed | **\[N\]** Enduring Hardships: \-0.25% Army Morale Attrition Cost | **\[N\]** Ships of the Line: \+10% Heavy Ship Power / \-20% Heavy Ship Build Cost |
| **\[N\]** Forced March: \+10% Army Movement Speed | \[M-V\] Improved Foraging: \-20% Army Attrition (was 25%) | \[D-VI\] Seahawks: \+75% Navy Initiative (was 100%) |
| \[M-VI\] Unrelenting Advance: \-0.02% Army Morale Movement Cost (was \-0.01%) | **\[N\]** Prepared Camps: \+10% Supply Limit | \[M-V\] Corvettes: \-10% Naval Damage Taken |
| **\[N\]** Bold Maneuvers: \+20% Movement Speed without Road | \[M-VI\] Improved Logistics: \+10 Logistics Distance (was 25\) | \[M-VI\] Superior Seamanship: \+10% Navy Morale |
| **\[N\]** Limbers: \+0.5 Arty Base Speed (it is on a per unit basis so if this does not work a \+33% for the whole Unit Type could be tested instead) | **\[N\]** Logistics Corps: \+50% Auxiliary Combat Power / \-20% Auxiliary Build Cost / \-10% Auxiliary Maintenance Cost | \[D-V\] Naval Fighting Instruction: \+50% Blockade Efficiency**AND**\[M-V\] Coastal Careening: \+5% Ship Repair Speed at Sea |
| \[M-V\] Offensive Army: \+2% Army Morale Recovery Speed | **\[N\]** Trained Reserves: \+10% Army Reinforcement Speed | \[M-VI\] Press Gangs: \-15% Navy Repair Cost (was 10%) |

* In the **Age of Absolutism** unit food consumption should start becoming a problem serious enough to warrant investment into logistics even in the more developed regions of Europe (if not then I guess soldiers need to eat *even more*). While both *Logistics* and *Maneuver* are on the weaker side as far as military picks go, that is not necessarily a bad thing. This is perhaps the Age with the *overall strongest Naval pick* and it is also the last opportunity to specialise in this area (Revolutions has only three land military options).

* **Maneuver** is heavily leaning into using rare and situational modifiers such as *Movement Speed without Road* and *Army Morale Movement Cost.* The player should hopefully still notice a difference in gameplay though. The tech *Limbers* is a big question as the modifier I intend for it to be based around does not exist to my knowledge as something applicable to an entire Unit Type (it exists as a modifier on *particular units* though).

* **Logistics** is exactly what the name implies. *Enduring Hardships* reduces the morale impact of attrition by one quarter. The *Logistics Corps* advance is not supposed to make Auxiliaries into a viable combat unit, but simply to make them *less vulnerable* to getting caught out and to make them *less terrible* should they somehow end up on the front in a battle (and also to make them more economical at their main purpose).

* **Highseas Fleet** is the naval pick with the strongest bonuses overall. As the last naval focus it has to be impactful enough to possibly tempt a land based country to pick it. Being paired with two less directly powerful land focuses helps with this somewhat without the naval bonuses getting too out of hand.

| Age of Revolutions \- Military Picks |  |  |
| ----- | ----- | ----- |
| **Voluntary Service** | **Conscription** | **Insurrection** |
| \[M-V\] Disciplined Drills: \+5% Discipline | \[M-VI\] Mass Army: \+20% Manpower / *\+10% Levy Size* (new) | **\[N\]** Guerillas: \+1000 Monthly Manpower / \+100% Occupation Time |
| **\[N\]** Thorough Training: \-50% Recruitment Speed / \+25 Unit Starting Experience (test to see if this stat is possible to give) | \[M-VI\] National Conscripts: \+50% Recruitment Speed / *\-50% Levy Maintenance* (new) | \[D-VI\] Established Rest: \+5% Morale Recovery in Friendly Territory |
| \[M-V\] Regimental System: \-5% Army Maintenance / \+25% Army Initiative | \[A-VI\] Nationalistic Enthusiasm: \-5% Army Maintenance / *\+10% Levy Combat Efficiency* (new) | **\[N\]** People’s War: \+1% Hostile Attrition / \+1% Prosperity Recovery |
| **\[N\]** Skirmish Line: \+0.10 Military Tactics | \[M-VI\] The Young can Serve: \-5% Army Reinforcement Cost / *\+10% Levy Recovery* (new) | **\[N\]** Last Stand: \+15% Garrison Size / \+15% Fort Defense |
| \[M-II\] Finest of Horses: \+10% Cavalry Power / *\-5% Cavalry Maintenance Cost* (new) | \[M-VI\] Massed Battery: \+10% Artillery Power / *\-10% Artillery Build Cost* (new) | **\[N\]** National Resistance: \-0.05 Monthly War Exhaustion / \+1000% Cultural Tradition (no I did not mistype it) |
| \[M-VI\] Bayonet Leaders: *\+10% Infantry Power* (originally from Private to Marshal, also lost the \+25% Army Initiative to Regimental System) | \[M-V\] Private to Marshal: *\-20% Infantry Build Cost* (new) / *\-15% Infantry Reinforcement Cost* (new) / *\-10% Infantry Maintenance Cost* (new)   | **\[N\]** Foreign Fighters: \-50% Mercenary Maintenance / \+100% Mercenary Range Modifier |

* **Age of Revolutions** being the last age, modifier stacking is now less of an issue as there are no further Focus Picks beyond this one to consider when deciding on values. It is also good for players to have some powerful bonuses to look forward to unlocking.

* **Voluntary Service** is about being *population efficient.* It gives bonuses to the quality of troops. Suited to countries with lower populations such as e.g. Scandinavia or ones only involved in land wars at their choosing such as Great Britain. In a full on *death war* however (a war that is fought to the point of absolute exhaustion) the intention is for this pick to be *slightly* less strong than the others \- this is what we will balance for.

* **Conscription** is about leveraging a large population and getting as many troops into the field at a time as possible. The bonuses are to cost, manpower, reinforcement etc. and not to direct combat strength of armies. There are also a number of buffs to Levies (comparable to the Age II Levy focus pick) further reinforcing the theme of a massive army.

* **Insurrection** is intended to be appealing to smaller countries fighting for survival. As such the bonuses are mainly defensive in nature, as an example *Established Rest* doubles the base Morale Recovery rate but only in friendly territory. There is also a significant buff to Mercenaries in the form of the advance *Foreign Fighters* with the main effect being \+100% Mercenary Range. The intention is for this pick to be the strongest option for small countries, but to be a niche pick otherwise. This means through any future changes we have to keep an eye on the balance as the margin between viability and irrelevance is relatively thin.
