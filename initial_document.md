Ars Belli MP Mod Table of Contents Introduction What are the objectives? Making the Mod Starting
Setup Overview The Middle East France and the 100 Years War Other Regions Future Content Diplomacy
Overview Problems with GP scoring, Hegemonies and War Termination Country Tiers Defensive Relations
Player Vassals & Colonial Nations Coalitions, Crusades and Jihads International Organizations
Espionage Peace Deals Other Considerations Military Overview Forts Logistics Unit Categories Unit
Types Other Changes Control and Economy 🚧Under Construction🚧 Navies and Trade 🚧Under
Construction🚧 Technology 🚧Under Construction🚧

Introduction What is this document for? The purpose of this document is to help bring everyone
willing to help out with Mod development on the same page. I consider it important that before we
start working on specific changes there should be an agreement on what we are trying to achieve with
regards to gameplay to begin with. Why make the mod? The vast majority of players of each Paradox
game are multiplayer only, meaning PDX rightly balances the game mainly with them in mind.
Furthermore, while the devs do play MP amongst themselves the level of experience they have is not
comparable to the more hardcore part of the MP playerbase (in all likelihood this means you if you
are reading this). TLDR: If we want MP balance we have to create it ourselves. Why make the mod now?
Why not?
In the beginning the patch releases were too frequent to start working on the mod as keeping it
updated would have been a lot of wasted effort when each patch potentially invalidates previous work
done. Based on major bugs still present in the release candidate version of 1.1 it seems like the
period of frequent patches is not over yet. Regardless, as the issues keep piling up we need
solutions at least to the problems that PDX are unlikely to fix themselves, and reworks to systems
that work for SP and casual MP but not for our lobbies. TLDR: We start now because we cannot wait
any longer - despite the patch situation. What are the objectives? To boil down what we are aiming
to do with the mod to its absolute core, it is to improve on the three following aspects of the
game: Balance, Dynamism and Playability. In order to keep things consistent throughout our work when
making changes it should be considered how it affects these. Balance: No specific playstyle or
choice should overshadow all others. Depending on context there should be multiple viable options,
whether we are talking focuses, social values or unit types. While countries start on various levels
of strength and influence no country should be fated to succeed or fail based on purely their
starting conditions. Dynamism: In order to keep the experience fresh the game state should evolve
throughout the campaign in ways that are surprising yet sensical. The nature of warfare should shift
between attrition and maneuver based on geography, technology and the choices of the participants.
Diplomacy should never settle into a fixed state permanently, countries should have reasons to shift
alliances without conflict being forced on them. Playability: Since our games are played in an
environment that is no pause and constant speed, clarity with regards to the way mechanics work,
familiarity with regards to navigating the UI and readability of in-game tooltips (as opposed to out
of game rules) should all be of the highest priority! While historicity is a nice plus and
complexity is acceptable if it also enhances depth - playability trumps all other considerations.
Making the Mod The Plan First of all let me make it clear before anything else that this is going to
be a long term project. I do not intend for this to be a quick thing we put together just to ‘fix’
some pet peeves the core members have and call it done. The aim is to develop the Mod along with the
game as it receives DLC and grow it together with the Ars Belli community. That said, we do need
something playable in order for us to launch our next set of campaigns… So how do we reconcile these
two objectives? Mod Structure The idea is to divide the Mod into three distinct but compatible parts
based on content. This way we can keep most campaigns as close to the vanilla experience as possible
while still retaining the most important changes: Starting Setup: As a temporary solution to country
balance (looking at you France and Mamluks) we can do either a separate mod or a save edit to
address any issues. The reason for making these changes in a separate package is so that they do not
get left in the Mod permanently, but are discarded once no longer needed. All new campaigns need
this as a prerequisite before they start. Eventually, as a part of the main Mod these balance
problems should be solved through properly made country content (e.g. Mamluks internal issues), and
if we release countries from majors, these new countries should have some historical basis or even
their own content (e.g. Burgundy, Syria). Diplomacy: One area of the game that everyone can agree
operates completely differently between SP and MP is diplomacy. The overwhelming majority of our
Rules are also about this. Therefore the main focus initially should be on turning these rules into
game mechanics, preferably with clear and concise tooltips. This will go a long way to improving
Balance and Playability. All new campaigns need this as a prerequisite before they start.
Secondarily this could even be useful on its own for other groups as well. Gameplay Changes: The
third category is the main part of the mod containing all of the actual gameplay changes. The reason
for this separation is that we are going to need time to properly implement and playtest changes
before we consider using this for all campaigns. Anything that moves the game away from the vanilla
experience is a barrier to entry for new players and at this stage of the game’s lifecycle that’s
still a lot of people. Only the campaign chosen for testing (the last one in all likelihood) needs
the first version of this as a prerequisite before it starts.

The Team Modding work is unpaid, the only reward at the end is the satisfaction of having made
something you personally consider worthwile. Therefore it is important that everybody is clear at
the start what they can contribute, and as a group we are clear about what we set out to do - so as
to avoid effort being wasted or people being disappointed. To achieve this I think it’s best if we
sort ourselves into the following clear categories based on level of modding experience, technical
skill (not just programming but for e.g. UI work) and time commitment: Note that this is only so
that we know what help to expect from each person. As for Discord roles 2 is enough: ‘Mod Team’ &
‘Mod Helper’ (feel free to suggest a better name). People with Technical Skills / Modding Experience
Devs - Mod Team: basically the core of the Mod Team able to implement changes into the game, figure
out how things work under the hood. If each week you can consistently spend some time helping out
you can consider yourself in this category! Advisors - Mod Helper: If you can lend us your
experience to help solve a specific problem, or just provide advice or answer a specific question -
this is still valuable! You are welcome to join us, keep an eye on development and provide help when
you can. The rest of us 🙂 Playtesters - Mod Team: testing if certain changes work, taking part in
extra play sessions to test balance, helping by tracking down bugs… basically everything else. I
expect we are gonna be very limited by developer-time so splitting up the workload like this is
going to be very helpful! Players - Mod Helper: simply taking part in the Test Campaign and
providing relevant and detailed feedback and participating in discussions relating to balance can
provide a lot of value as well! Something important before we proceed: All of the following sections
after this point onwards will contain a lot of specific change Proposals and Ideas - while I did put
effort into them and I stand by them, the point of making this document is to share them with you so
we can have a discussion before we actually start working on something final!

Starting Setup Overview Through our first four campaigns it has become painfully apparent that the
current 1337 start date as it is set up in the base game by PDX is very unbalanced. The two main
culprits are The Mamluks and France. In the case of the former they are able to run over any country
in the Middle East, making it so any player slotted there only lives by the Mamluk Player’s grace.
In the case of the latter outside of the brief window right at the beginning it is only possible to
contain it by an array of major countries dedicating their gameplan to this specific purpose. It is
not healthy for the game long term for every lobby to revolve around containing specific countries,
but if we adjust these two we also at least have to consider Jalayirids, England, Castile, Bohemia
and Hungary. Before we get into the weeds with specifics let’s outline some principles: We should
not aim to set up specific countries for success. Example: it does not really matter whether the
main power in Anatolia and the Balkans is Byzantium, Ottomans, or even Serbia. What matters is that
the conditions are right so that one of them can emerge without being smothered right in the first
session by Mamluks or Jalayirids. We should use historical tags wherever possible when releasing
countries. Example: Silesia is better to use than a random ‘Insert Province Name’ Tag. On the other
hand let’s not get carried away with alternative history by resurrecting the Kingdom of Jerusalem
(plus, let’s not take that away from Cyprus and the other claimants!). Keep it simple! We should
make the minimal required changes to achieve the desired effect. Example: Perhaps releasing Syria is
enough, they don’t need to have unique content right away. The Middle East Let’s start with the
Elephant in the Room… The Mamluks are a problem because of more reasons than simply their economy or
their number of troops. Let’s look at a list of their many advantages: Distance and logistical
difficulties make threatening their power base extremely difficult. Malaria in the Nile Delta
further protects them by invasion from outsiders. Overall very safe. The high population density in
their core leads to economic improvements requiring promotions instantly profitable - this leads to
the economy scaling at an accelerated pace. Their unique content is very strong and straightforward.
They border their much weaker neighbours right from the beginning. To keep it simple, let’s give
their neighbours enough time and the opportunity to take their outlying territories. Release
everything outside of the Nile Delta and give the Mamluks a truce with the released countries (e.g.
Hejaz, Syria, Quds, and all starting vassals). This should give a chance to everyone to do diplo
with Mamluks from a relatively equal position, perhaps discuss borders - or just rush in to take
what they want and put the pressure on Mamluks to accept the situation or respond.

While this can solve or at least mitigate the main issue, there is a second albeit somewhat lesser
problem, the Jalayirids. The issue here is several fold: The strength of Horse Archers. The bugs
related to Horde Governments (multiple). The way they are restricting both Georgia and Ottomans. The
first one is a balance issue, the second one is a set of bugs therefore a PDX issue. A simple
solution to both could be to change their government but this would neuter their unique flavour. I
am unsure about what to do here, in order to avoid having to later save-edit to keep them playable I
am leaning towards simply changing them to a Monarchy. As for their territorial extent restricting
others, I feel like it would be too much to give their core territory touching Georgia away, but
perhaps the Eretnids in Anatolia could be released as independent. France and the 100 Years War This
is a tough one. Any changes made to the long term power of France have to take into account the fact
that if allowed to snowball England could very well replace them as basically the same balance
problem, just now in red colour. Let’s list the basic advantages of France leading them to be so
strong, and specifically, while they scale so well long term: An incredible amount of Farmlands,
already highly populated at the start date. Flat topography with very few Forest and Woods
locations - good dev growth and proximity. A dense river system allows it to easily push proximity
in all directions from Paris. Strong country content (to a lesser degree than Mamluks imo). The
solution that presents itself is to make Flanders and especially Burgundy into playable, independent
countries from the start. These not only already have some unique content, but Burgundy is also
perfectly positioned to block France from easily pushing into HRE lands, therefore directly
improving the dynamics of that region as well. What we have to be exceptionally careful with is
keeping the balance between France and England - therefore we have to match changes on one side
equal with changes on the other. Playtesting here is going to be a requirement! Some possible
changes to England we could consider are an independent Pale in Ireland, an independent Wales or
even releasing Northumbria as a buffer (with commensurate truce between them and the English) to
make Scotland a somewhat more viable start. Other Regions While none of the following present
comparable issues to the above, once we start tamping down on the biggest offenders the risk becomes
that we just end up with the next strongest country becoming an overly dominant power by default. In
Iberia: Castile is stronger than Aragon and Portugal combined. While these are all popular picks, in
the current state of the game all three most likely cannot live together for long. This is what it
is and solving the situation is beyond the scope of any initial changes we make. What we could
easily do however is bring the power level of these countries a bit closer together by weakening
Castile. One of the ways we could do this is to release Galicia, Leon, and give Basque culture
locations to Navarre. This would leave Castile as the strongest of the three, but not quite as
strong as the other two together therefore at least opening the door to diplomacy as equals.

In the HRE: Bohemia is positioned to easily gobble up any smaller powers. While the antagonism
changes slow them down, this still does not prevent them for example, to kill Meissen day one (which
could otherwise be a fully viable tag with a decent amount of unique content!) and keep on going at
their leisure. In my opinion the root of the issue is lacking or straight up not working HRE content
in general, so solving this by releasing vassals is a very scuffed way to do it. If it seems
necessary, I’d personally release the Silesian minors as one unified Silesia tag along with Upper
Lusatia province. In the Balkans: Hungary is usually dominating while IRL due to partly internal
factors, partly the entanglements in Naples and Poland this did not happen at all. In game terms the
Balkans could be a lot more dynamic if the countries here namely Byzantium, Serbia and to a lesser
extent Bulgaria or perhaps even Venice had some room to breathe. To achieve this a simple solution
would be to release Croatia and Bosnia from Hungary, and possibly the Albanian minors from Naples to
create room. Additionally the noble privilege ‘Golden Bull of 1222’ could be given out by default
which would slow down the Hungarian economy quite significantly. To cap all that off: While any
number of changes could be made, and individually they might even be good and reasonable changes, we
have to consider the whole picture together and make sure we don’t overdo it! Future Content Once we
get to a point where we can leave the quick fixes behind and work on permanent content for countries
we should keep some things in mind: First, any country (or region) that is slated to be the focus of
a DLC should not be worked on until after said official content and possible hotfixes are out.
Second, priority should be given to countries that need their balance issues resolved along with
other countries in their region to keep things consistent between them. Third, I know we all have
special care for our own home countries, but always keep in mind that Balance and Playability take
precedence over being accurate to History. I hope every one of us is mature enough that I don’t have
to point out we don’t want to make our own guys OP just because, or make one-sided historical
interpretations into game content (there’s the schizo mods for that on the workshop, as is
tradition).

Diplomacy Overview The one aspect of the game where the gameplay between Single Player and Multi
Player is the most fundamentally different is Diplomacy. A lot of mechanics that represent ‘soft’
factors in the relations between countries such as Diplomatic Reputation, Trust, to some extent even
Opinion lose their meaning when applied to players. On the other hand some mechanics that are
appropriate when used in SP against an AI country become completely overpowered and conceptually
simply don’t belong when used against a Human in MP such as force-breaking an alliance with Favors
or the restriction for Guarantees where the one receiving the Guarantee has to have a positive
opinion of the Guarantor country. The absolute greatest issue, however, is not necessarily inherent
to the mechanics of the game itself. It is the fact that by default player alliances heavily favour
the already strong, and diplomacy tends to revolve around the few strongest countries as it is the
path of least resistance. The root cause of the problem is the greater effort and trust required for
coordinating a larger number of weaker countries. This effect is even more pronounced the less
players know each other and the less experienced they are. While we cannot change human nature and
the coordination problem is simply inherent to dealing with a larger number of actors, we can tweak
in-game mechanics to the point where allying with the weak becomes an equally viable alternative or
situationally the best option. To solve the above issues and facilitate a more dynamic game
environment where countries rise and fall (as opposed to the winners winning ever more) we need a
comprehensive solution that tweaks all aspects of diplomacy with this goal in mind. Problems with GP
scoring, Hegemonies and War Termination The game currently uses two things to differentiate
countries by power level, the Power Score where the highest scoring countries are considered Great
Powers and the Hegemonies system where the GPs strongest in a certain area gain the corresponding
Hegemony. There are several issues with this that combine to make these systems barely functional in
MP. First of all the fact that scoring is global leads to a situation where AI countries in Asia
often take up most slots instead of Players in Europe (this could be mitigated by changing the
scoring, or as a last resort simply disallowing AI from taking up slots). As for Hegemonies, in
their current implementation they are basically a win-more mechanic and they are also a bit of a
confused mess: what even is a ‘Diplomatic Hegemon’? A hegemon is someone who dominates a field - how
do you even dominate diplomacy? Some of the diplomatic actions granted, such as ‘Violate
Sovereignty’ and ‘Influence Country’ also make a lot more sense to be usable by all GPs. One more
problem area (that is also closely related to military mechanics) is how wars are incentivized to
grow in scope and once started generally never end with a limited negotiated peace, but go until one
side reaches 100% warscore or is about to reach it - this if fine to happen in certain cases, but
not if the system creates this outcome in almost every war. Before we continue: First, I am not
going to explain Alliance Points, Defensive Points etc. I am assuming everyone reading this is
familiar with our old rules. Second, the game uses the term ‘Country Rank’ to refer to
County/Duchy - basically ‘de jure’ titles. I am going to use the term ‘Country Tier’ to refer to my
proposed system for categorizing countries. I apologize if it’s a bit confusing but it’s what came
to mind! Country Tiers As the first step towards a solution we need to differentiate between
countries by sorting them into a set of categories or ‘Country Tiers’ based on their power level.
The strongest countries will have extended abilities to influence others, intervene in wars, and
give guarantees while costing more for others to ally with and having less ‘Defensive Points’. On
the other hand smaller countries will lack these extended diplomatic options but instead an alliance
with them will be cheaper and they will receive more defensive points to give them a better chance
at survival. While more granularity in how the Tiers scale is generally good, it is important to
keep the number of tiers limited and the boundaries between them clearly defined so that players can
fully understand and play around them. So let’s begin with the basics: Great Powers >>> Major
Powers >>> Normal Powers >>> Small Powers >>> Minor Powers Normal Powers: Every country falls in
this category unless it is eligible for another. Has 6 ‘Alliance Points’ Has 3 ‘Defensive Points’
Costs 3 points to ally or be in a league with Can ally with Great Powers Cannot give ‘Guarantees’ to
other countries Can receive ‘Guarantees’ For the strongest countries using the default Power Score
(GP score) system with tweaks is sufficient as comparing relative strength of countries feels
appropriate on the top end. Whoever is strongest gets the actions and restrictions of being a Great
or Major Power - no absolute threshold to hit. Great Powers: the top 6 (?) strongest eligible
countries by Power Score. Has 6 ‘Alliance Points’ Has 2 less ‘Defensive Points’ for 1 total Costs 2
more points to ally or be in a league with for a total cost of 5 Cannot ally with other Great Powers
Can give ‘Guarantees’ to other countries Cannot receive ‘Guarantees’ Can ‘Intervene’ and ‘Enforce
Peace’ against non rivals as well Can ‘Threaten War’ - only once PDXs fixes related bugs Can
‘Influence Country’ - formerly DIP hegemon action Can use ‘Diplomatic Corps’ cabinet action -
formerly DIP hegemon action Can ‘Violate Sovereignty’ - formerly MIL hegemon action Can ‘Force
Embargo’ - formerly NAV hegemon action Major Powers: the 7th to 12th (?) strongest eligible
countries by Power Score. Has 6 ‘Alliance Points’ Has 1 less ‘Defensive Points’ for 2 total Costs 1
more point to ally or be in a league with for a total cost of 4 Can ally with Great Powers Can give
‘Guarantees’ to other countries Cannot receive ‘Guarantees’ Can ‘Intervene’ and ‘Enforce Peace’
against non rivals as well Can ‘Threaten War’ - only once PDXs fixes related bugs Can ‘Influence
Country’ - formerly DIP hegemon action Can use ‘Diplomatic Corps’ cabinet action - formerly DIP
hegemon action When it comes to weaker countries, relative scaling makes no sense. Using it could
easily lead to a situation where countries could get categorized as minors where their strength does
not justify it. Instead, we should set absolute thresholds that scale with Ages - where countries
under it are categorized as Small or Minor Powers. If no countries end up being in these categories
that is fine and a completely acceptable outcome. A combination of many different factors could be
used to arrive at a score for these categories, for the sake of simplicity however, I will use
country + vassal pop total for now. Because of possible lower player count games being a GP/MP
should make a country ineligible for also being recognized as a minor! Minor Powers: The smallest
land based countries and special country types - One Province Minors like Wetzlar (Gouk), or Banks
like Peruzzi (Skorpins) from the 1st Sunday Campaign. Eligibility limit per Age: 500K I. / 600K II.
/ 700K III. / 800K IV. / 900K V. / 1000K VI.  
Has 6 ‘Alliance Points’ Has 2 more for a total of 5 ‘Defensive Points’ Costs 2 less points to ally
or be in a league with for a total cost of 1 Can ally with Great Powers Cannot give ‘Guarantees’ to
other countries Can receive ‘Guarantees’ Consider Mercenary Maintenance & Premium Cost bonuses
(careful with stacking) Small Powers: What would normally be considered a ‘small’ country.
Eligibility limit per Age: 1000K I. / 1500K II. / 2000K III. / 2500K IV. / 3000K V. / 4000K VI. Has
6 ‘Alliance Points’ Has 1 more for a total of 4 ‘Defensive Points’ Costs 1 less points to ally or be
in a league with for a total cost of 2 Can ally with Great Powers Cannot give ‘Guarantees’ to other
countries Can receive ‘Guarantees’ We have touched on issues with the Hegemonies before, but now
let’s talk about what to do with them. At first they could be kept mostly the same just with some of
their associated abilities being moved to GPs as seen above and some of the stat bonuses removed.
Eventually it would be preferable to rework them fully into one unified Country Tier system and
perhaps use their interface to display GPs MPs etc Victoria 2 style. As for the restriction that
Hegemonies cannot ally with each other - this should be removed and Major Powers made eligible for
Hegemon status as well. Here’s how I’d temporarily keep Hegemonies in their reduced capacity:
Economic Hegemon: Based on monthly income from Trade & Tax Grants ‘Reduced Paperwork’ cabinet action
Grants ‘Soldiers as Workforce’ cabinet action - formerly Military Hegemon Naval Hegemon: Based on
number of Heavy Ships (maybe other types could count?) Grants ‘Maritime Support’ cabinet action
Grants ‘Forced Divert Trade’ diplomatic action - formerly Economic Hegemon Military Hegemon: Based
on the number of Regulars (maybe quality should matter?) -10% War Score Cost as a passive bonus -10%
Unit Food Consumption as a passive bonus - formerly Economic Hegemon Diplomatic Hegemon: Just remove
this. The concept itself does not make sense. Cultural Hegemon: Based on Cultural Influence Grants
‘Assimilate Area’ cabinet action Grants ‘Force Change Court Language’ diplomatic action Defensive
Relations On our server we place no restrictions on multiple countries declaring wars on the same
target even though most groups either forbid this, or even handle this by direct GM decision (why
that is a can of worms we should not open I will not discuss again here). Coordinated declarations
have their own disadvantages that are mainly political and war score related, where they take the
risk that either of the attackers takes or is forced to take a separate peace. Overall though this
still poses such an issue that some solution is required to equalise the situation that isn’t just a
separate war declaration on the aggressor. The inclusion of additional ‘Defensive Points’ for
Defensive Leagues and Personal Unions, the one free guarantee per person and Intervention / Enforce
Peace have been an improvement but have perhaps gone too far in the other direction. I believe the
new mechanics detailed in the Country Ranks section are a step towards the right balance, but there
remains a number of issues specific to the above relation types that need to be solved: Both
Defensive Leagues and Personal Unions have laws that eventually allow them to be used for offensive
declarations as well. This has to be either completely removed or changed in such a way that upon
passing the law these organizations then take up ‘Alliance Points’ instead (I think the first
solution is preferable as it’s simpler but either works). Players often end up in Personal Unions
unintentionally but considering the fact that these take up valuable relations we need to introduce
a way to break these. Since this relation type is deeply tied to succession mechanics and indirectly
even the way for e.g. fiefdoms work it is very hard to come up with a solution that neither breaks
other parts of the game nor is it abusable. One possible way to handle this could be the inclusion
of an action where a country in an unwanted PU could get a randomly generated noble character as
their new ruler (of primary culture and religion). The reason it should not be a pre existing
character is to prevent this being used to ‘farm’ rulers with top tier stats. This would also need a
limitation to how often it can be pressed (50 or 100 year cooldown) and all fiefdom and dominion
subjects should receive the same ruler as well. Intervention and Enforce Peace are, if handled
correctly, great mechanics to inject some dynamism and risk to diplomacy. The issue with these is
that without restrictions they just become a way to keep alliances ‘hidden’ and keep the sphere of
potential allies as wide as possible. To mitigate this the current rule is to allow only one person
to join an ongoing war by the way of these mechanics. Ideally the game should track if this was
already used by someone during the war and simply disallow pressing the button for the next person.
Furthermore, just like there is an opportunity for the attacker to refuse white peace when a third
party uses Enforce Peace on them, the defender should also have the opportunity to refuse this peace
being forced as otherwise the mechanic can be used to save an attacker! The HRE Emperor is
automatically called in on the defenders side when an outsider attacks the empire. Not only are they
themselves called, but they can bring their own allies too. While the HRE members should enjoy some
protection through their membership, this is obviously gamebreaking by allowing two separate sets of
allies to be called in defensively. Instead the Emperor’s participation should count as an
Intervention itself and disallow further players joining in such a way (or through Enforce Peace)
and the Emperor should not be able to call his own allies. If it was possible to accept or reject an
offer of Guarantee as the receiver and perhaps even cancel a guarantee that is already in place,
then we could consider placing limits on how many guarantees each player can receive at the same
time. Player Vassals & Colonial Nations It was my expectation based on previous experience coming
into EU5 that allowing players to be vassalized will be a constant source of drama and balance
issues. After our initial set of campaigns I conclude that this has been in fact proven to be the
case and as such I’d simply fix this by disallowing player vassalization entirely once again. Asking
someone to become a vassal or asking to become their vassal through diplomatic actions or through a
peace deal should be disallowed if the country in question is a player country. Viable countries
that start as vassals should not be allowed to be picked or the Starting Setup should be altered to
make them independent. The exception to this rule is Colonial Nations as they are really their own
separate category. Playing as a Colonial Nation is a popular playstyle that a lot of players are
interested in and this is also a great way to slot in people whose country might have died earlier
on (or new joins). A number of things have to be done for the sake of gamebalance though: This
vassal relationship should disallow having their own alliance, guarantees etc for the Colonial
Player. And the relationship should be considered a Player Alliance for the Overlord with the same
associated ‘Alliance Point’ costs. To prevent circumventing the above rules a player controlled
Colonial Nation should not be allowed to start an independence movement or be freed through a peace
deal. No third party should be able to use Transfer Subject or any equivalent mechanic on them. Even
the Overlord should be prevented from freeing them. These rules apply specifically to countries that
were created by the colonization mechanics and as such does not apply to natives or countries that
moved to the colonies. Coalitions, Crusades and Jihads All of these three serve to create large
scale wars outside of the confines of the alliance mechanics. The issue at the moment is that
regular wars are too large scale anyways and this takes away the niche that Holy Wars and Coalitions
should serve. While it is a problem if each war escalates into an in-game equivalent of a World War,
having memorable wars on which the course of the campaign pivots is a desired outcome. These however
have to be an exceptional event that happens rarely and that is what should make it memorable and
unique. Crusades in particular should have to depend on the Pope and any other country attempting to
start one should ask the Pope for permission - a simple confirmation window would do for now. Holy
Wars of any religion need to happen rarely, therefore a timer of at least a 100 years should be in
place before a new one can be called (timer separate per religion), preferably counting after the
war is over but counting from declaration is acceptable. The targeting requirement for Crusades
should be loosened up from only targeting Jerusalem. Initially limiting it to the region of Europe,
North Africa and the Middle East should be tested. While Coalitions can happen as often as they can
be triggered there are some other issues to solve. First of all ideally the smaller AI countries
should not be so trigger happy to fire the coalition war if player countries are also members. The
reason we have to be very careful with this is so people can't join coalitions with the idea to
neuter them - without solving this the lesser evil might be to keep it as is. Secondarily, taking
land should not be disallowed for the Coalition Target as this makes winning against the coalition
very unsatisfying, it should merely be made more expensive in both war score and antagonism
received. International Organizations In my personal opinion International Organizations are a great
way (along with Situations) to structure content in theory. However, their current state goes from
barebones to barely functional depending on the specific IO in question. While this means they could
really use changes I would hold off for now as they are still getting reworks (think HRE) so work
done here would likely end up being temporary - considering this I think of the following mainly as
a collection of ideas for the future. Catholic Church: In its current state this is just a set of
stat bonuses you click to activate (or more likely let someone else do it for you) every once in a
while and you only really interact with it for a very short while during the Council of Trent. To
improve it first the Pope has to be made central to passing most things and especially Crusades. The
temporary bonuses should be made stronger (maybe with downsides as well?) while at the same time the
number of them active at the same time should be limited. The aim of this change would be to make
voting for or against them actually matter - maybe you don’t care about the HRE receiving extra
Imperial Authority enough to even click the voting interface as a non-member… unless it takes up a
slot for something you’d want instead of it. Holy Roman Empire: A lot of potential here to enhance
gameplay and history at the same time. I will keep it brief and just suggest one thing. Think of how
Federation Fleets work in Stellaris - now what if we had laws for the Imperial Army that worked
similarly? What if there were laws or votes regarding the legality of using it in certain
situations? The IO is likely to keep getting updates though (I’d hope). Horde IOs: Currently very
bland. I have no specific ideas for it, all I’ll state is they need work. Mandate of Heaven:
Depending on how we end up going about Asia, that is reworks, simplification, or nuking it from
orbit (queue social credit meme) this IO and associated content needs straight up nerfs, no two ways
about it the bonuses are just insane. One minor but impactful thing could be giving a significant
chunk of negative Power Score for the holder of the Mandate of Heaven (instead of +50 it could be
-500 or whatever number works). French Crown IO: Creating an IO to tie together French content
similar to the HRE would be a huge undertaking but it holds a lot of potential imo. Ideally it would
not be stable like the HRE but rather be forced down either the path of Centralisation into one
powerful French or English tag (Burgundy?), or the path of Decentralisation (potentially falling
apart). In either case instead of leaving it as HRE 2.0 it should have its own flavour leading to
one conclusion or the other. Espionage The Espionage System as a whole probably needs to be reworked
as it is currently both wildly powerful and significantly abusable at the same time. I would hold
off on including this in the Diplomacy Segment of the Mod for now as ideally I would keep Espionage
powerful, but lock its strongest aspects behind a Focus Pick (see the Technology Section for more
detail). Infiltrate Administration very heavily distorts the game. It is not an option but a
requirement to use it once it becomes available. This level of actual map hacks takes Fog of War out
of the game completely and thus takes the skill of making informed guesses based on limited
information out along with it. I am not advocating for its removal though, but rather limiting its
current form to an Espionage Focus and replacing it with a lesser version in the tech tree (perhaps
it could be Area based instead of country wide). Sow Discontent, Corrupt Officials and similar
actions could be rebalanced to scale based on the size of the target and be more expensive in
general (PDX at it again with going between extremes). It should have a similar cost (maybe slightly
higher?) for the one doing it as the stability costs for the target. Making it cheaper would just
make it a no-brainer in a lot of situations with no further thought about whether it’s worth doing.
Limiting by how many people and how often certain actions can be done against the same target should
be considered. Tech Stealing needs a rework. Currently not only could it be abused by spamming it
against one target by multiple people significantly hurting their research, but it is also basically
mandatory to use it as it is free research with no downside for the one doing it. I am not sure how
to balance this as removing the negative effect would just make you use it against an ally who won’t
do counterespionage then making it even more of a no brainer - ideas welcome. Assassinations should
either be locked behind a focus or be limited in how often they can be used both as a player doing
them and how often they can be used against a certain player. I believe they have not been abused to
their fullest potential yet in our games and base my reservations about the mechanic upon that.
Peace Deals The current Peace Deal system is very limited by design as the AI cannot handle deals
that contain demands from both sides. As long as we make reservations not to break the AI peace
logic we could consider allowing two-sided peace deals where both sides exchange territories, money
etc. This could be done by restricting the AI to never suggest or accept such deals while allowing
the players to create such deals between themselves. Some other considerations: Creating an extended
truce should be made as a peace option with 0 war score cost. If this proves possible to implement
we should consider preventing this option from being used in stab-hit peace offers to make it a
matter of negotiation between players and not something that can be forced. Change the amount of war
score controlling the war goal province gives. This could be doubled as a first step from 25 to 50
(ticking by the same +1 per month). We have to be careful with seemingly simple changes like this as
terminating an ongoing war where the participants are still actively fighting and there is still a
reasonable (if small) chance for either side to win is very damaging to the game. I firmly believe
being forced to peace out like this, by ultimately arbitrary mechanics (or god-forbid GM decision)
is worse than having wars go on longer than ideal. In connection with the previous point the White
Peace Imminent mechanic should only be able to be used by the war leader on the war leader of the
other side. The intention of the mechanic is clearly to end a stalemated war and not to be used as
an offensive tool to help win it. Make forcibly destroying buildings of Building Based Countries in
Peace Deals cheaper and scaling with how many overall buildings said country has (e.g. a Hanseatic
Kontor costs 20 war score to destroy and they can have hundreds of them). These countries are
currently practically untouchable as if they exist in a different dimension. This change by itself
is insufficient to fix this but it’s a necessary step as a part of a comprehensive rework (in some
far off time in the future).

Other Considerations There is still a lot left to talk about, but to keep some of my (and the dear
readers) sanity I will keep the following points to a few sentences per topic: Building Rights are
granted by default. In my opinion this is completely backwards as especially considering how
inconvenient it is to destroy foreign buildings in one’s country (and you aren’t even allowed to
often) the player should have more control over this than reacting after the fact. If we make it an
action to Request Building Rights it should have versions where you are requesting with nothing
offered, requesting for favours (maybe a small diplo penalty for rejection by the host), and one
where you pay for it - preferably with a slider setting the price instead of a flat predetermined
sum. The Send Economic Support diplomatic action allows too much gold to be sent monthly. The
possible amount can be several times higher than the sending countries’ monthly income. This should
be reduced to a reasonable amount - how much that should be is up for interpretation. In my opinion
we could start with a number that is at least lower than the nation's budget, perhaps about half of
monthly profit. In close connection to the above point, we should rebalance how much gold can be
paid when requesting Fleet Basing Rights, Military Access etc. the flat amounts really make no sense
outside of the early game. Overdoing this could mean completely undermining the change to Send
Economic Support so we have to keep in mind, when we are changing the actions we are tweaking the
total possible gold transferred over time (diplomat availability limits actions from being spammed
too much though). Keeping Gifts and Ask for Money time limited is probably a good idea, the amount
transferred seems reasonable to me as is. Certain Diplomatic Actions have alternatives that use
Favors as a currency. We could consider other actions where such an alternative could be
implemented. One example is ‘Invite Artist’ which currently has a cost of 250 gold (of course the
Art System as a whole is very undercooked at the moment but that is beside the point). Scutaged
Vassals present a problem as they allow players to artificially limit the available playspace. We
need to give a consistent and free ability to the opponent to bring scutaged vassals into the war.
The idea of allowing a vassal to stay out of wars for an extra payment should be kept as an option
unless this problem proves unfixable. We should consider adding Non-Agression Pacts as either a new
type of Diplomatic Relation, or as a one time Diplomatic Action whereupon if the receiver accepts a
truce of X years is created (this could be set with a slider from let’s say 1 year to 25 years). One
important thing to consider though is how this could contribute to diplomatic stagnation if no
limits are placed on usage. Non-aggression pacts exist outside of the game anyways (though those are
not enforced by game rules to be fair) so adding them would make them official rather than being an
entirely new thing. Currently most Casus Belli simply have the same or very similar
penalties/bonuses for both Conquer Cost and Antagonism Received. This should be rebalanced where
‘unjustified’ CBs like ‘Hegemon Ultimatum’ (granted when a country refuses to grant forced military
access from the ‘Violate Sovereignty’ diplomatic action) could have an Antagonism penalty while
retaining current war score Costs. Military Overview The way wars play out have very serious issues
both in 1.1 and previous versions that urgently need addressing. Outside of the first few decades
wars take on a completely attritional character. They are never really won by a bold move or even
through overwhelming an opponent. Almost in every case they are over only once one side runs out of
manpower (1.0.11) or money for mercenaries (1.1 branch). Not even war exhaustion or internal
political pressures take on any real role in forcing an end to conflict. I consider the above the
core issue to be solved, but any solution will have to touch almost all areas related to warfare, as
it is all of them working the way they do that creates the current situation. There are other
problems to be sure, such as the elephant in the room that is Mercenaries, but this is a separate
more ‘self-contained’ issue that we will tackle in its own section. Let's summarise what the desired
end-state is that we should be aiming towards: Forts should no longer cover entire large countries
forcing dozens of sieges and decades for occupation but smaller countries that invest into
technology and push the right values should be able to become fully fortified as it is in the
current version. This will help open up the possibility of maneuver by reducing fort spam. The state
of Food Supply should no longer be completely binary where on one end it mostly does not matter at
all but sometimes in certain regions it is simply not possible to supply armies with enough food
regardless of investment made. Instead we should move the system from almost entirely relying on
automatic distribution (the logistics distance stat starts high and then scales even higher) to
relying more on player decisions through the utilization of Supply Depots and Supply Units - this
then creates a way to cut enemy supply lines thus providing an objective in war other than
occupation of territory or engaging armies directly. Supply Limit is an underutilized (and somewhat
bugged) mechanic that we could utilize to further disincentivize doomstacking. Currently all it does
is increase the food consumption of armies when too many regiments are present in a location. This
could be changed to cause attrition once a location is significantly over the limit, let’s say at 2x
over the supply limit (this could be a scaling number from 1-5% as a ballpark). By moving away from
doomstacks fighting singular battles towards fighting separate battles in multiple areas at once we
can open the opportunity to defeat a stronger opponent in detail. Importantly, however, this could
make these smaller units extremely vulnerable to be Stackwiped (goombastomped) so we should increase
the ratio needed from 10x to about 20x while making it be applied consistently with clear game rules
around the mechanic. The speed of combat resolution compared against the speed of army movement and
the game speed of the lobby are key variables to consider in connection with each other. Having
combat be slow in relation to movement pushes everything towards a singular focus point - a
Verdun-like forever battle - where reinforcements stream in from afar and the armies rotate in and
out. Faster battles with higher casualties per round could be seen as a straightforward solution.
The problem with this in a lobby with no pausing is that overdoing this can lead to a situation
where the combination of human reaction time and the latency inherent to MP (combined with the
occasional spike in input lag) makes controlling armies frustrating and inconsistent thus
undermining player skill and decisions. Slowing down army movement speed can make reinforcement of a
battle, especially coming from a distance harder, though this on its own has its limits and can at
best serve to mitigate the issue. Slowing the game speed could also help with the other related
issues, but this too has a limit to how far we can or want to go. TLDR: these are tradeoffs, but I
feel 1.1 combat is on the too fast side atm. Reinforcement and Morale Recovery are currently way too
fast. Winning a battle does not let the winning side make a significant push as the enemy in most
cases recovers fast enough to prevent any real gains from being made. Additionally while Defenders
should certainly enjoy a logistics advantage in their Home Territory the complete lack of any
reinforcement for the Attacker is also a big factor preventing any Momentum from being built up. By
reducing the base Reinforcement per month significantly and slowing down Morale Recovery combined
with letting Attackers reinforce in Enemy Territory at a reduced rate (at around ~25% speed) we can
allow for the possibility of territorial gains after won battles before the total collapse of the
enemy army has occured due to manpower/money shortages. Unit Variety is in a very bad state whether
we look at Unit Types such as cavalry and infantry or Unit Categories that is to say regulars or
mercenaries. In each case there is usually a best choice. Mercs are currently overwhelmingly the
most economical option. Which regiment you spam is decided by the current Age and whether you have a
cav bonus or not - and tacking on bonuses like Combined Arms can at best slightly mitigate the issue
(there will still be a single meta unit composition). Levies should be cheap and accessible in the
moment, but raising them should result in political consequences. Regulars should require a large
upfront investment and their quantity should be limited in the early ages then slowly they should
become the majority of armies over time. Mercenaries should be cheaper than investing into regulars
in the short term but be a more expensive way to fight overall. They should instead serve to bulk
out armies for a campaign and specifically only small and wealthy (‘tall’ if you will) countries
should rely on them as the mainstay of their armies. As for Unit Types, whether cavalry or infantry
is stronger should depend on where the battle takes place instead of simply which one has the
stronger base stats per manpower or per gold cost. To achieve this we should increase terrain combat
modifiers which are currently there but fairly tame and carefully tweak unit stats over time - it is
fairly unlikely we get this exactly correct right off the bat. We should accept that balance here is
delicate, and reaching an equilibrium can only be achieved over time through playtesting and
incremental changes. Forts The main issue with Forts is their spammability. Not only are Fort Limits
extremely high considering each fort only takes up one, they are also fairly affordable and their
cost modifiers are easily stackable (especially for Military Orders). This results in the entirety
of Europe being covered in forts after a few decades. The other issue is the balance between sieges
and assaults where both should be viable options for attacking a fort. One part of the problem is
the fort gap in the Age of Discovery where by this time Castles have become obsolete against
assaults but Bastions are not yet available. The other part is the fact that patch 1.1 has buffed
Garrison sizes to be double so now the whole balance will need rethinking. Let me then also state I
have a slight suspicion that the reason they straight up doubled garrisons might have been their way
of fixing the fort gap. Instead of this it would have been preferable to introduce a new Fort
building between Castles and Bastions in Age of Discovery with the 500 garrison size they now gave
to Castles. I would hold off on this specific change now though until we get extensive experience
with the new values. My expectation is now assaults are just gonna be dead in the early game. As a
quick note Stockades were previously useless and now their 100 garrison is glaringly out of line
with the other forts. I would buff this to be 250 right away and see if this makes these even a
remotely viable option. Let’s start talking about solutions. To reduce fort spam we will make each
fort cost the same amount of Fort Limit as their Fort Level. This is a simple change with major
consequences. To allow countries (especially smaller ones threatened by neighbours) to still heavily
fortify their lands we will also change how Fort Limit is calculated to begin with. As you can see I
found how to insert tables: Age Name Garrison Level / Limit Cost Age of Traditions Stockade 250
(from 100) Fort Level 1 Age of Traditions Castle 500 Fort Level 2 Age of Reformation Bastion 1000
Fort Level 4 Age of Absolutism Star Fort 2000 Fort Level 6 Age of Revolutions Fortress 4000 Fort
Level 8

New Fort Limit calculation: 5 base for every country (up from 1) but bonuses from Country Rank are
removed Each City grants +0.5 (down from 1 per City) Number of Locations grants 0.10 per location
(unchanged) The Offensive Social Value will no longer debuff Fort Defense by scaling -50% but
instead debuff Fort Limit by scaling -50% Most other modifiers should remain unchanged for now,
except for Fort Limit Advances Age Advancement Name Fort Limit Bonuses Placement Age of Traditions
Castellany System +2 Flat / +10% Unresearched Age of Renaissance Border Wardens +4 Flat / +10% Moved
Age of Discovery Defense Bureau +6 Flat / +10% No change Age of Reformation Inspectors General +8
Flat / +10% No change Age of Absolutism Standardized Engineering +12 Flat / +10% No change Age of
Revolutions Fortress +16 Flat / +10% No change

Castellany System should be moved from its original place to under the tech ‘Master Masons’ as a
research option instead of a starting tech. Border Wardens along with its prerequisites
'Infrastructure Efforts’ and ‘Mason Guilds’ move to under ‘Recurrent Warfare’. These are not high
priority changes though, we can live with these advancements remaining in their original place as
well temporarily. It is worth considering another lever we can pull on when discussing sieges and
the balance between offense and defense. The Artillery Barrage stat of Artillery Units where Fort
Level is subtracted from the Barrage stat to get how much the regiment contributes to sieges. As a
rule of thumb 3 fully reinforced artillery regiments are needed for each point of the ‘Artillery
Bonus vs Fort’ bonus. This calculation also means that older cannons are wholly ineffective versus
newer forts. By tweaking the Barrage stat and the techs granting +Arty Bonus vs Fort we can set the
investment required for effective siege stacks. Initially I would not tweak these but as an example
raising the Barrage of each Artillery unit by +0.5 would make it so only 2 regiments would be
required for each point of siege bonus. As part of the Mod all starting Forts in violation of the
adjacency rule should be removed! Finally here is a list of things to investigate as if they are
possible to do we could do some interesting things with Forts: Possibility of disabling owned forts
that touch each other automatically Possibility of applying movement speed modifiers in Zones of
Control to enemy armies Possibility of making Forts function as Supply Depots Possibility of making
fort ZoC occupy enemy territories over the border during war Possibility of tweaking Province
Capital assignment logic so it prefers locations with Forts Logistics This is one of the areas where
a lot could be done to create better gameplay. The problem is the opacity of the system to most
players which means we have to be careful not to make it too hard to understand. Making the player
interact more directly with the supply system is the aim here, not simply to make it more punishing.
Each nerf of a value or an increase to difficulty should be matched by buffing a different method to
supply units! I understand that these changes might be controversial, but I believe we should test
and tune them extensively first before making a call on them. Let’s look at the proposed values: 2x
the food consumption of all units. Currently 1000 men eat the same amount as 1000 Peasants/Laborers.
Unless you do something like raise all levies and put them on a single location with your entire
army the food consumption of units is negligible. The only thing that sometimes makes them consume a
significant amount seems to be a bug with armies exceeding Supply Limit getting several times the
penalties they should be getting. Nerf numbers related to Logistics Distance - this governs how far
away units can get automatic food supply from friendly provinces. Default value can go down from 50
to 40 but we have to carefully monitor the effects of this change. Advances go down from +25 to +10.
The scaling +100% bonus granted by a General's admin skill should be removed and the Offensive
Social Value should give a scaling +50% instead of Army Movement Speed. 4x the number of men per
Supply Unit for all ages along with a commensurate increase to build and maintenance cost and 16x
their food carried. This will bring their unit size up to match Cavalry and let them feed a same age
Infantry regiment for 16 months. Removing micro by having a smaller number of larger supply units
instead of a myriad of tiny ones is a free win. Buff the food capacity of Supply Depots 16x from 50
to 900. Currently creating a Depot costs 100 manpower which seems incredibly low, but I see no
reason to start changing this for now. These advancements affecting Depots should be buffed: Age of
Renaissance: Supply Depots 25 to 300 Age of Discovery: Army Depots 25 to 300 Age of Reformation:
Ammunition Depots 25 to 450 Age of Absolutism: Forward Depots 25 to 450 Age of Revolutions: Campaign
Depots 25 to 600 Exceeding local Supply Limit by over 3x should cause scaling Attrition starting
from 0% up to 2% at over 5x Supply Limit. The reason for the relatively tame numbers is so this does
not completely obliterate AI and inattentive players. We should investigate the possibility and the
effects of moving attrition from a Monthly to a Weekly or a ‘per X days’ tick. This would make it
more of a constant gradual thing instead of it happening in infrequent chunks which makes it
annoying to play around. Touching this value could easily mess up balance so it has to be done
carefully - low priority for now. The default value for Army Reinforcement is 25% of total manpower
per month with full access to required goods. Reinforcement is overall a bit too fast right now so
I’d try reducing the base number to 20% per month to start with. Currently this number is reduced to
50% of the base value in allied or neutral (with food access) territory meaning with new numbers 10%
of total manpower can be reinforced. It should remain possible to reinforce in occupied enemy
territory as well at a heavily reduced speed. To begin with we could try 25% of the base value - so
5% per month. It is important not to overdo this change as the intention is to help winning battles
result in the winning side whether the defenders or attackers gain momentum and not to buff attack
over defense - though that is definitely a side effect. Army Morale Recovery Speed (what a mouthful)
is a base 5% of Max Morale per day. While this number is by itself not necessarily a problem, the
issue is how all other modifiers are additive on top of this. Over time a +1% here or there from
advancements, the Quality social value or country content (shout out Armenia +5%) quickly make
armies regenerate too fast. Nerfing the base value would make armies recovering from a march too
vulnerable, so instead the additional values should be looked at to keep recovery speed from scaling
too high. Unit Categories The balance between Levies, Regulars and Mercenaries since release has
gone through several ups and downs where each of these has at one point been overpowered. Ideally
all of them should have their niche and stay relevant throughout the game. Regulars should start out
as a small part of a country's forces and gain dominance by the end. Levies should be the mainstay
of most countries' armed forces but fall behind in quality and importance by the Age of Absolutism,
importantly however, the Age of Revolutions should see them become relevant again. Mercenaries are
not overpowered just because they are so cheap compared to regulars (they require no advancements or
infrastructure investment!) but they also have serious problems with how they draw manpower from
provinces. Although they definitely need a nerf as is, they should still be viable to be used to
bulk out a country’s army for a specific campaign and smaller but rich nations could rely on them to
form the majority of their armies enabling them to punch above their weight. Mercenaries at the
moment draw their manpower in such a way that they never run out. As merc units upgrade and thus
need more manpower per regiment or as they suffer casualties in a war, more pops will simply leave
to become mercs. This logic is completely backwards. A certain amount of pops (a slow trickle,
really) should leave to become mercenaries and this number should not fluctuate based on what amount
of mercenaries are ‘needed’. Should mercs upgrade to a new unit tier or perish in combat, their
numbers should simply remain low for a while. This would then prevent uninvolved third parties from
suffering massive casualties (in the millions!) in other people's wars. I am not sure if it is even
possible to change merc recruitment logic to this extent but I would consider it absolutely
necessary. Let’s look at some concrete changes: At the moment Control in a location scales Mercenary
Size by -50% Merc Size at 100% Control down to +50% Merc Size at 0% Control. The game considers this
a neutral number and displays it in white, while at the same time treating it as a ‘bonus’ that
certain advances give out etc. - in reality this is a negative stat as it governs how many pops
leave to become mercenaries. This should change to -100% Merc Size at a 100% Control, down to no
change at 0% Control, this way we should hopefully cut down on infinite merc availability somewhat.
Negative Stability also increases Mercenary Size by +50% at -100 Stability and gives no bonus at
positive Stab. This could instead go from +25% at -100 Stab to -25% at +100 Stab. The cost of
Mercenaries recently went from previously being 150% of the base cost of the same type of Regular
down to 25% of base cost (!!!). This should go back to being at least 100% of the base cost of a
Regular. This would still be cheaper than previously and might be too cheap to be fair. We have to
consider the fact that on top of the hiring cost Regulars also need Advancements and Manpower
Buildings, while at the same time killing your own pops when they suffer casualties. We should keep
monitoring this closely and if it proves to be the case that mercs are still by far the best choice
for warfare we will increase their cost further. Similar to how Levies as a category receive an
experience and discipline penalty Mercenaries could receive their own set of bonuses and penalties.
We could represent the fact that they are interested more in making a profit than in serving the
country by perhaps giving them a Morale Damage Received penalty. Currently once an Army is Made
Available for Hire anyone can hire them including Rivals. Even enemy countries in an active war can
hire mercs originating from their opponents lands. If it is possible to put restrictions on hiring
that disallow these behaviours we should do so. Another related consideration is putting a limit on
how many troops a country should even be able to put up as mercenaries as currently the number is
unlimited and this combined with the very high money transfer limits makes the countries able to
support third parties in a war almost as effectively as if they were active participants. Levies are
overall a great addition to EU5 but their current implementation is trying to put too many different
concepts into the same mechanic leading to not really representing any of them well. Feudal Levies
are raised as a whole not per class or culture nor does raising them have any internal political
consequences at all. Tribes, local Militias, or even the later Levee en Masse are also trying to fit
under the same concept. All that is to say that while there is room here for a major rework I also
think this should not be considered anytime soon. It is also important not to fall into the same
mistake as PDX and change all three different unit categories at once essentially randomizing
balance instead of improving it. Let’s collect some ideas to consider nevertheless: Raising levies
should have political consequences. Estates should be unhappy contributing troops to offensive wars
(defense of the realm is another matter), and especially disenfranchised peasants that are armed and
formed into units should be a danger to the stability of feudal order. The percentage of population
available as levies should be revised as some of the troop numbers we see in the game are often
several times higher than is appropriate for the time period. The high troop numbers also contribute
to war not being worth it due to increasing casualties. The cost of war should be high but suffered
by the civilian population in the areas ravaged by war. The Mass Conscription of the French
Revolutionary and Napoleonic Wars should be represented by then increasing the percentage of
population mobilized perhaps with once again increasing levy combat efficiency after the drop in the
previous ages. We should explore the possibility of raising levies and assigning levy
bonuses/penalties by culture and social class.

The issue with Regulars currently is how they are just not worth using compared to Mercenaries. Part
of this is the cost in gold and tech investment. The other part is population loss, but the solution
is, just as with levies, to finish changing Mercs before we start rebalancing regulars. The other
issue we should deal with is the fact that even if Mercs were not dominant, Regulars become
widespread and make levies obsolete too soon and too abruptly. This should instead be a slow and
gradual process. The reason for this in my opinion is the availability of manpower stemming from too
many buildable Armories and Training Fields, this is closely tied to accelerated Urbanization but
that is a topic for a different chapter. It is important to consider that if we nerf manpower we do
not once again make investing into Regulars unappealing, ideally they should require more upfront
investment but be higher quality than levies and more economical than mercs in the long term. During
the Ages of Tradition and Renaissance regulars should be a small but important part of armies, while
by the Age of Reformation they should be the main part but not yet dominant. Only in the last two
ages should regulars dominate with Mercenaries falling behind and Levies reaching a low point during
Absolutism and having a resurgence for Revolutions. Considerations for the future: Rebalance
Manpower Availability to restrict Regulars from becoming the mainstay too early by limiting how many
Armories and Training Fields are possible to build - one per location is probably too restrictive
but we can tweak how many extra possible levels development, population and being a city/town
contributes. Barracks and Regimental Camps could remain unchanged to allow Regular numbers to scale
up starting from the Age of Reformation. Sergeantries could use a buff in how much manpower they
provide and Theocracies and Republics should receive an exact copy for the sake of giving small
countries a leg up. This is a gamey but very direct and clean way to help MP balance. We should take
a thorough look at how fast Manpower Regenerates as currently max manpower is reached in 5 years.
Simply changing this to 10 years would mean a buff as then double the manpower ‘production’ could be
stored. Nerfing monthly manpower from buildings to half and then allowing 10 years of gains to be
stored would be a huge nerf to regulars as then the amount of regiments a country can keep in
service and still retain a positive monthly manpower balance is also halved. Unit Types First of
all, it would be easy and satisfying to start changing the stats of Units right away but this would
be a mistake. We should first settle the balance between Unit Categories, Forts, Logistics etc. as
otherwise doing too much at once would make evaluating the impact of each change hard thus making it
more difficult to achieve the right balance in the end. The latest patch has brought the strength of
Infantry and Cavalry closer together and introduced the new Combined Arms bonus. While altogether
this is a step in the right direction and the changes are welcome, unit variety is still far from
ideal. Which regiment you choose as the main component (<50% of army) is still just based on which
unit type you have the highest Power Bonus for. After this just adding a minimum amount of all other
available units to stack Combined Arms bonuses is enough, which to be fair is a kind of ‘variety’,
but the composition is still static. This is a decision you make exactly once then just replicate
for all army stacks. There are no further decisions made based on the opponents you expect to face
or terrain you expect to have to fight in, there is no dynamism in how you move and use armies.

An important thing to keep in mind is this is a Grand Strategy game so units that might have
operated differently in battle historically don’t necessarily make sense for the game we have. As an
example: how do we represent the difference between a 12-pounder and a 6-pounder cannon with the
in-game battle system? Realistically one or the other would just end up having the better stats,
making their inclusion pointless clutter. We should strive to give each Unit Type its own distinct
identity and role in actual gameplay (an example currently in game would be artillery or
auxiliaries). Thankfully Unit Balance is perhaps a part of the game that is fairly straightforward
to test as it is easy to set up testing scenarios and directly observe the effect of changes made.
Keep that in mind for the following proposals: To make Infantry and Cavalry feel different to use we
should lean heavily into Terrain Combat Penalties. The aim would be to make Infantry be noticeably
stronger in rough terrain (think forest hill, mountain) Cavalry be noticeably stronger on flat,
clear ground with parity between the two on less-rough terrain (e.g. woods plateau, grassland hill).
Under the current balance Cav & Inf are much closer early on in power level, but in later ages
Cavalry still falls behind significantly. I’ll hold off on final judgement for now due to the patch
having just rebalanced everything but I do not think this should happen to this extent where one
Unit Type just becomes clearly and always much weaker than the other options. One thing to consider
is making cavalry units half the size of infantry instead of 40%. This would straight up increase
Cav strength by 25% so safe to say this would need to be done only as part of an overall balance
pass. To open up more room for increasing cavalry unit size and late-game power without making them
overpowered, Heavy Cavalry build cost and maintenance cost could be made more expensive by making
them require more Horses. In the case of Light Cavalry their combat power could be decreased
slightly along with shifting their damage profile towards dealing more morale damage to further
distinguish the two cavalry types (this should be done along with the changes below in the section
about movement speed and not in isolation). Artillery balance through the ages needs extensive
testing. Not only do they gain a lot of stats and unit size relative compared to other unit types.
Their chance to barrage the enemy changes based on Age as well. In terms of balance I’d like to see
them made viable through emphasizing their ability to barrage instead of a simple overall stat
increase. Where the numbers should end up is not something to theorycraft, but should be tested
extensively. Support Units could use a Combat Strength buff to match half the current age Infantry.
This would still make them only about 20% as strong in dealing damage considering unit size but they
at least should not get obliterated by a singular regiment if they get caught out in a separate
stack. They currently also grant a Combined Arms bonus which makes total sense in the case of
Hussite Wagons for example but a bit questionable otherwise (I am not advocating for changing this
as I want to incentivize their inclusion and don’t want to undermine that, but it's still weird).
One area that is closely tied to the balance between different Unit Types and military as a whole is
army speed. General Mil ability and Offensive no longer grant speed as tiny mostly irrelevant
percentage changes could cause issues with own armies or allied armies arrival times falling out of
sync unexpectedly and inconsistently. I propose using different movespeeds for different unit types
as a tool to strengthen their identity. The reason I see this change differently is because the
speed of the unit itself (armies of course move at the speed of the slowest unit contained within
them) is something consistent, clear and thus the player can play around it. Let’s get to the
proposal: Both Infantry Types, Heavy Cavalry and Supply Units should move at a default speed of 2
(the vanilla default speed is 2.5). By slowing most units down the importance of distance and the
positioning of armies increases. The reason for including Heavy Cav with the others is to create a
distinction between them and Light Cav in terms of how you use them and not just combat stats. Light
Cavalry default speed should go up to 3. While this would keep mixed armies at the same speed,
specifically Light Cav could now be used to catch other stacks, or to ‘raid’ enemy supply lines,
occupy province capitals unprotected by Zones of Control etc. and still evade any pursuing stack.
How this would work out in practice in an MP PvP environment is something I very much want to test.
Artillery could potentially be made slower either through applying significant movement speed
penalties based on terrain or by keeping it simple and reducing base movement speed to 1.5 instead.
Other Changes General Abilities have been touched on in several separate sections before. In short
the idea is to redistribute bonuses like this: Admin - out of combat bonuses: Siege Ability scaling
to +10% at a 100 skill Food Consumption scaling to -50% at a 100 skill Army Attrition scaling to
-25% at a 100 skill (need to test if multiplicative or not) Diplo - bonuses around winning through
morale and deploying troops quicker: Morale scaling to +20% at a 100 skill Army Initiative scaling
to +100% at a 100 skill Combat Speed scaling to +25% at a 100 skill Military - bonuses around
winning through casualties and deploying more troops: Discipline scaling to +10% at a 100 skill
Correct Section Chance scaling to +20% at a 100 skill Possible Frontage scaling to +10% at a 100
skill Note that Army Movement Speed was removed as a bonus as the small differences in army speed it
caused were almost always not relevant except occasionally when armies arriving 1 hours apart lead
to stackwipes of otherwise appropriate sized stacks The thing that makes this functionally random
and not possible to play around is the inconsistency of whether it even causes a difference in
arrival times as it mostly does not. Attaching armies also does not fix this in practice - unclear
if this is a bug or not. For now I would consider keeping the General Trait that grants movement
speed as it could be played around. More directly related to Advancements but very relevant to
military balance is a General Revision of Advancement Placements - especially so for techs that
unlock new unit types as an example light and heavy versions of Inf or Cav should be placed side by
side and not sequentially so that we open the possibility for people to switch unit types during the
upgrade each age. And don’t forget ‘Spanish Square’ (my god)...

Some bugs or unintended mechanics that should be tested: Levies supposedly take 100% extra damage
they aren't supposed to. I have not confirmed for sure yet but it does feel like it is so. Next, the
Combined arms bonus takes into account 0 strength units which does not feel intended. Control and
Economy I will state this right away - we are not touching the economy and the governors/control for
a long while. Some of the reasons for this: PDX is still changing the fundamentals of the in-game
economy. Such as proximity, income lost to control going to the Estates… I could go on. We can only
build on a stable base, so we need to give the devs more time until we can begin. This is one area
of the game that affects all others. Changing things here will inevitably require a lot of extra
attention elsewhere increasing workload. Seeing how a tweak to the economy affects things takes time
and scrutiny. It is not as straightforward as reading what a new Advancement does, or how strong a
unit type is. Changes here potentially increase the barrier to entry and frustration more than in
other areas. That said, we can collect ideas and list issues that we should keep an eye on! Here’s a
few things I have in my notes (additions welcome): Constructions fully halting during winter in
Arctic climates could be handled with a large speed penalty instead (think ~90%) - this would at
least let a building that’s a handful of days away from completion still finish if slowly making it
a lot less annoying to play in such regions - without taking away from their ‘character’.
Construction speed could be slowed down in general to tamp down on the economy scaling too fast.
This only really affects countries that have the huge amounts of money to spend required to saturate
construction queues, as for most poorer countries the limiting factor is money anyways leaving them
mostly unaffected. RGOs cost basically nothing as the game goes on. In general when a resource is
exploited it’s the most productive farmland brought to production and the ‘lowest hanging fruit’
that gets harvested first. To represent this RGO upgrade cost and time should scale up with already
existing levels. Quick example: each level above 5 gives a stacking 5% cost and time. So going from
lvl15 to 16 would be twice as expensive and slow. In later ages upgrading buildings becomes very
spammy with a lot of mindless clicking. Simply increasing the employment and production per level
with a commensurate increase in cost could reduce this unnecessary tedium while keeping balance
almost untouched (building limits and max building levels per location would of course need a
similar adjustment). Something should be done to prevent uber-urbanization from occurring right out
of the gate. More punishing diseases for urban areas and tweaks to how food works are a fairly
straightforward way to do this but I suspect these changes would not be very popular… Pop Promotion
feels like it’s not much of a mechanic after the early game. I suspect this has something to do with
modifiers stacking additively overcoming any penalties - should be investigated further. Ideally
this mechanic should matter throughout the game. For example, switching a building's employment type
from Burghers to Laborers should have faster and easier employment as one of its advantages. Right
now due to how pop demand works it’s a straight disadvantage. With the addition of Governors late
game proximity and control seem way too strong. I am gonna keep it at that, I feel like it’s too
early for specific suggestions. Navies and Trade Overview

Trade Dynamism

Unit Types

Other Changes

Technology Overview

Institutions

Advancements

Age Focuses
