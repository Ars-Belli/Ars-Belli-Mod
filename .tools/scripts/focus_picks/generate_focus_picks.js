// Generates the Ars Belli focus-pick system from focus_data.js:
//   in_game/common/advances/abm_focus_picks_economic.txt
//   in_game/common/advances/abm_focus_picks_military.txt
//   in_game/events/ages.txt                               (same-name replacement of vanilla)
//   main_menu/localization/english/abm_focus_picks_l_english.yml
//
// Usage (from repo root):  node .tools/scripts/focus_picks/generate_focus_picks.js
// Set EU5_GAME to override the vanilla game path used for icon lookup / REPLACE detection.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const GAME = process.env.EU5_GAME || 'E:/Steam/steamapps/common/Europa Universalis V/game';
const ADV_DIR = GAME + '/in_game/common/advances';
const { ages } = require('./focus_data.js');

const BOM = '\uFEFF';
const EOL = '\r\n';
const write = (rel, text, bom = true) => {
	fs.writeFileSync(path.join(ROOT, rel), (bom ? BOM : '') + text.replace(/\r?\n/g, EOL), 'utf8');
	console.log('wrote', rel);
};

// Vanilla advance blocks: key -> { file, icon }
const vanilla = {};
for (const f of fs.readdirSync(ADV_DIR).filter(f => f.endsWith('.txt'))) {
	const t = fs.readFileSync(path.join(ADV_DIR, f), 'utf8').replace(/^\uFEFF/, '');
	for (const m of t.matchAll(/^([A-Za-z_0-9]+)\s*=\s*\{([\s\S]*?)^\}/gm)) {
		const icon = (m[2].match(/^\s*icon\s*=\s*(\S+)/m) || [])[1];
		vanilla[m[1]] = { file: f, icon };
	}
}
const CHOICE_FILES = ['4_choices_adm.txt', '4_choices_dip.txt', '4_choices_mil.txt'];

// Panel art. Textures must exist in vanilla (a missing one renders as a blank square), so check them here.
const GFX = GAME + '/main_menu/gfx/';
const gfx = rel => {
	if (!fs.existsSync(GFX + rel)) throw new Error('missing vanilla texture: gfx/' + rel);
	return 'gfx/' + rel;
};
// An advance's icon: the data's override, else the vanilla icon line, else the key (engine default).
const advIcon = (key, extra = {}) => gfx(`interface/advance/${extra.icon || (vanilla[key] && vanilla[key].icon) || key}.dds`);
const branchArt = br => gfx(`interface/illustrations/${br.art}.dds`);
const ROMAN = { 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI' };

// Advance effects written out in the panel (one line per modifier), using the game's own modifier
// names ($MODIFIER_TYPE_NAME_x$) and number formats, green for a bonus and red for a malus.
const DEFS = require('./page/defs.js')(GAME);
const { loc: VLOC, fmtValue } = require('./page/modloc.js')(GAME);
const CONST = {};
for (const d of ['main_menu/common/script_values', 'in_game/common/script_values']) {
	const dir = path.join(GAME, d);
	if (!fs.existsSync(dir)) continue;
	for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.txt')))
		for (const m of fs.readFileSync(path.join(dir, f), 'utf8').matchAll(/^@?([a-z0-9_]+)\s*=\s*(-?[\d.]+)\s*$/gm)) CONST[m[1]] = parseFloat(m[2]);
}
// For the advancing country hostile attrition is a bonus, though the game colours the modifier as bad.
const GOOD_ANYWAY = new Set(['global_hostile_attrition']);
const RAW_UNLOCKS = [
	[/unlock_subject_type = march/, 'Unlocks the #Y March#! subject type'],
	[/unlock_casus_belli = cb_exploration/, 'Unlocks the #Y Exploration#! casus belli'],
	[/unlock_country_interaction = abm_sabotage_fort/, 'Unlocks #Y Sabotage Fort#!'],
	[/unlock_diplomacy = \{ infiltrate_administration \}/, 'Unlocks #Y Infiltrate Administration#!'],
	[/unlock_country_interaction = steal_technology/, 'Unlocks #Y Steal Technology#!'],
];
function advEffects(key, mods, extra = {}) {
	const lines = [];
	for (const l of mods.split('\n').filter(Boolean)) {
		const [k, raw] = l.split('=').map(s => s.trim());
		const def = DEFS[k];
		if (!def || !VLOC['MODIFIER_TYPE_NAME_' + k]) throw new Error(`${key}: no definition or name for modifier ${k}`);
		const name = `$MODIFIER_TYPE_NAME_${k}$`;
		if (def.boolean) { lines.push(`#G ${name}#!`); continue; }
		const v = raw in CONST ? CONST[raw] : parseFloat(raw);
		if (Number.isNaN(v)) throw new Error(`${key}: can't resolve value ${raw} for ${k}`);
		const good = GOOD_ANYWAY.has(k) || (def.color === 'bad' ? v < 0 : v > 0);
		const val = fmtValue(def, v).replace(/−/g, '-');
		lines.push(`${name} ${def.color === 'neutral' ? '#Y' : good ? '#G' : '#R'} ${val}#!`);
	}
	for (const [re, text] of RAW_UNLOCKS) if (extra.raw && re.test(extra.raw)) lines.push(text);
	if (!lines.length) throw new Error(`${key}: no effects to show`);
	return lines.join('\\n');
}

const focusVar = id => `abm_focus_${id}`;
const MAX_CHANGES = 3; // focus changes each country may make after picking
const indent = (s, n) => s.split('\n').map(l => (l ? '\t'.repeat(n) + l : l)).join('\n');

// Tree shape per branch: 0 is the root, 1->2(->6) hang off 0, 3->4->5 hang off 0.
// Branches have 5 to 7 advances; a shorter branch just stops early.
const PARENT = [null, 0, 1, 0, 3, 4, 2];
for (const a of ages)
	for (const br of [...a.eco, ...a.mil])
		if (br.adv.length < 2 || br.adv.length > PARENT.length) throw new Error(`branch ${br.id}: ${br.adv.length} advances, supported 2-${PARENT.length}`);

function advanceBlock(ageKey, branch, idx) {
	const [key, mods, extra = {}] = branch.adv[idx];
	const v = vanilla[key];
	if (!v && !key.startsWith('abm_')) throw new Error(`vanilla advance not found: ${key}`);
	if (v && key.startsWith('abm_')) throw new Error(`abm_ key collides with vanilla: ${key}`);
	// Keys that live outside the emptied 4_choices files must be REPLACE:d, not redefined.
	const replace = v && !CHOICE_FILES.includes(v.file);
	const icon = extra.icon || (v && v.icon); // no icon line -> engine default, as in vanilla
	const lines = [];
	lines.push(`${replace ? 'REPLACE:' : ''}${key} = {`);
	lines.push(`\tage = ${ageKey}`);
	if (icon) lines.push(`\ticon = ${icon}`);
	// Branch roots must be explicit roots (depth = 0, like vanilla age roots): an advance with neither
	// requires nor depth gets auto-attached under another node by the engine (Mercenary landed under Court).
	if (PARENT[idx] === null) lines.push('\tdepth = 0');
	else lines.push(`\trequires = ${branch.adv[PARENT[idx]][0]}`);
	lines.push('');
	// potential (not allow): branches not picked stay hidden, like vanilla `for = X` focus advances.
	// potential IS re-checked in game, so a branch appears once its pick sets the variable. Hidden
	// branches also stop unparented vanilla/country advances being auto-attached under them.
	lines.push(`\tpotential = { has_variable = ${focusVar(branch.id)} }`);
	if (mods) { lines.push(''); lines.push(indent(mods, 1)); }
	if (extra.raw) { lines.push(''); lines.push(indent(extra.raw, 1)); }
	lines.push('}');
	return lines.join('\n');
}

function advancesFile(kind) {
	const title = kind === 'eco' ? 'Economic' : 'Military';
	const out = [];
	out.push(`# Ars Belli focus picks - ${title} advances. GENERATED by .tools/scripts/focus_picks/generate_focus_picks.js`);
	out.push('# Edit focus_data.js and re-run the generator instead of editing this file by hand.');
	out.push('#');
	out.push('# Each age offers 3 branches; the pick made in the age event (ages_of_eu.1 / abm_focus_picks.1)');
	out.push('# sets a country variable abm_focus_<branch>, which is the only gate on these advances.');
	out.push('# The engine adm/dip/mil age preference (`for = X`) is no longer used: vanilla 4_choices_*.txt are emptied.');
	for (const a of ages) {
		for (const br of a[kind]) {
			out.push('');
			out.push('############################');
			out.push(`# ${a.age} - ${br.name} (${focusVar(br.id)})`);
			out.push('############################');
			br.adv.forEach((_, i) => { out.push(''); out.push(advanceBlock(a.age, br, i)); });
		}
	}
	return out.join('\n') + '\n';
}

// Ages from index: the branch of age N can be picked once current_age is N or later.
const AGE_KEYS = ['age_2_renaissance', 'age_3_discovery', 'age_4_reformation', 'age_5_absolutism', 'age_6_revolutions'];
const ageReached = age => 'OR = { ' + AGE_KEYS.slice(AGE_KEYS.indexOf(age)).map(k => 'current_age = ' + k).join(' ') + ' }';
const slotTaken = brs => 'OR = { ' + brs.map(x => 'has_variable = ' + focusVar(x.id)).join(' ') + ' }';


function eventsFile() {
	return [
		'namespace = ages_of_eu',
		'namespace = abm_focus_picks',
		'',
		'# Ars Belli: same-name replacement of vanilla in_game/events/ages.txt (listed in replaced_files.txt).',
		'# GENERATED by .tools/scripts/focus_picks/generate_focus_picks.js - edit focus_data.js and re-run.',
		'#',
		'# Vanilla ages_of_eu.1 (fired by the hardcoded on_new_age) offered one adm/dip/mil focus via',
		'# set_age_preference. That engine slot allows a single pick, so it is dropped entirely.',
		'# Every age from the Renaissance on has two focus slots (Economic, Military), 3 branches each.',
		'# Players pick in the Focus Picks panel (gui/shared/abm_focus_picks_panel.gui ->',
		'# scripted_guis/abm_focus_picks_gui.txt). AI countries never pick, by design: a player who',
		'# disconnects must not have the AI choose for them. A pick sets the country',
		'# variable abm_focus_<branch>, which the branch advances use as potential.',
		'#',
		'# abm_focus_picks.1 is a country_event, NOT age_event: the age event window has exactly three',
		'# cards bound to option keys adm/dip/mil and cannot show anything else.',
		'',
		'ages_of_eu.1 = {',
		'\ttype = country_event',
		'\thidden = yes',
		'',
		'\t# Age of Traditions has no focus picks.',
		'\ttrigger = {',
		'\t\tNOT = { current_age = age_1_traditions }',
		'\t}',
		'',
		'\timmediate = {',
		'\t\tif = {',
		'\t\t\tlimit = { is_ai = no }',
		'\t\t\ttrigger_event_non_silently = { id = abm_focus_picks.1 }',
		'\t\t}',
		'\t}',
		'}',
		'',
		'# Player notice: the new age\'s focuses are picked in the Focus Picks panel.',
		'abm_focus_picks.1 = {',
		'\ttype = country_event',
		'',
		'\ttitle = ages_of_eu.1.title',
		'\tdesc = abm_focus_picks.1.desc',
		'\toutcome = neutral',
		'',
		'\tillustration_tags = {',
		'\t\t10 = ages',
		'\t}',
		'',
		'\toption = {',
		'\t\tname = abm_focus_picks.1.a',
		'\t}',
		'}',
		'',
	].join('\n');
}

// Scripted GUIs behind the panel's Pick / Change buttons. Root = the player's country.
//   abm_focus_pick_<b>   shown while the slot (age + Economic/Military) is empty; valid once the age is reached
//   abm_focus_switch_<b> shown while a sibling branch holds the slot; costs 1 of MAX_CHANGES focus changes
//   abm_focus_pending    shown while the current age still has an empty slot (drives the "(!)" button)
function sguiFile() {
	const out = [];
	out.push('# Ars Belli focus picks: scripted GUIs for the Focus Picks panel. GENERATED by');
	out.push('# .tools/scripts/focus_picks/generate_focus_picks.js - edit focus_data.js and re-run.');
	out.push('# Change points: abm_focus_changes_used counts switches (missing = 0); at most ' + MAX_CHANGES + '.');
	for (const a of ages) {
		for (const kind of ['eco', 'mil']) {
			const brs = a[kind];
			for (const br of brs) {
				const others = brs.filter(x => x !== br);
				out.push('');
				out.push('abm_focus_pick_' + br.id + ' = {');
				out.push('\tscope = country');
				out.push('\tis_shown = { NOT = { ' + slotTaken(brs) + ' } }');
				out.push('\tis_valid = {');
				out.push('\t\tcustom_tooltip = {');
				out.push('\t\t\ttext = abm_focus_panel.' + a.age + '.reached_tt');
				out.push('\t\t\t' + ageReached(a.age));
				out.push('\t\t}');
				out.push('\t}');
				out.push('\teffect = { set_variable = ' + focusVar(br.id) + ' }');
				out.push('}');
				out.push('');
				out.push('abm_focus_switch_' + br.id + ' = {');
				out.push('\tscope = country');
				out.push('\tis_shown = {');
				out.push('\t\tNOT = { has_variable = ' + focusVar(br.id) + ' }');
				out.push('\t\t' + slotTaken(others));
				out.push('\t}');
				out.push('\tis_valid = {');
				out.push('\t\tcustom_tooltip = {');
				out.push('\t\t\ttext = ABM_FOCUS_CHANGES_NONE_TT');
				out.push('\t\t\tOR = {');
				out.push('\t\t\t\tNOT = { has_variable = abm_focus_changes_used }');
				out.push('\t\t\t\tvar:abm_focus_changes_used < ' + MAX_CHANGES);
				out.push('\t\t\t}');
				out.push('\t\t}');
				// Researched advances can't be removed by script (no un-research effect) and keep their
				// bonuses, so a pick is only changeable before any of its advances is researched.
				out.push('\t\tcustom_tooltip = {');
				out.push('\t\t\ttext = ABM_FOCUS_NOTHING_RESEARCHED_TT');
				out.push('\t\t\tNOT = { OR = { ' + others.flatMap(o => o.adv.map(x => 'has_advance = ' + x[0])).join(' ') + ' } }');
				out.push('\t\t}');
				out.push('\t}');
				out.push('\teffect = {');
				for (const o of others) out.push('\t\tif = { limit = { has_variable = ' + focusVar(o.id) + ' } remove_variable = ' + focusVar(o.id) + ' }');
				out.push('\t\tset_variable = ' + focusVar(br.id));
				out.push('\t\tif = {');
				out.push('\t\t\tlimit = { has_variable = abm_focus_changes_used }');
				out.push('\t\t\tchange_variable = { name = abm_focus_changes_used add = 1 }');
				out.push('\t\t}');
				out.push('\t\telse = { set_variable = { name = abm_focus_changes_used value = 1 } }');
				out.push('\t}');
				out.push('}');
			}
		}
	}
	// Age state for the panel: banner status line and which age tab opens by default (the current
	// age; the Renaissance while still in the Age of Traditions).
	for (const a of ages) {
		out.push('');
		out.push('abm_focus_age_current_' + a.age + ' = {');
		out.push('\tscope = country');
		out.push('\tis_shown = { current_age = ' + a.age + ' }');
		out.push('}');
		out.push('abm_focus_age_reached_' + a.age + ' = {');
		out.push('\tscope = country');
		out.push('\tis_shown = { ' + ageReached(a.age) + ' }');
		out.push('}');
		out.push('abm_focus_age_default_' + a.age + ' = {');
		out.push('\tscope = country');
		out.push(a.age === AGE_KEYS[0]
			? '\tis_shown = { OR = { current_age = age_1_traditions current_age = ' + a.age + ' } }'
			: '\tis_shown = { current_age = ' + a.age + ' }');
		out.push('}');
	}
	out.push('');
	out.push('abm_focus_pending = {');
	out.push('\tscope = country');
	out.push('\tis_shown = {');
	out.push('\t\tOR = {');
	for (const a of ages) {
		out.push('\t\t\tAND = {');
		out.push('\t\t\t\tcurrent_age = ' + a.age);
		out.push('\t\t\t\tOR = {');
		out.push('\t\t\t\t\tNOT = { ' + slotTaken(a.eco) + ' }');
		out.push('\t\t\t\t\tNOT = { ' + slotTaken(a.mil) + ' }');
		out.push('\t\t\t\t}');
		out.push('\t\t\t}');
	}
	out.push('\t\t}');
	out.push('\t}');
	out.push('}');
	return out.join('\n') + '\n';
}

// Focus changes left, as text (missing variable = none used).
function customLocFile() {
	const out = [
		'# Ars Belli focus picks: remaining focus changes. GENERATED by .tools/scripts/focus_picks/generate_focus_picks.js',
		'abm_focus_changes_left = {',
		'\ttype = country',
	];
	for (let used = 0; used < MAX_CHANGES; used++) {
		out.push('\ttext = {');
		out.push('\t\tlocalization_key = ABM_FOCUS_CHANGES_LEFT_' + (MAX_CHANGES - used));
		out.push(used === 0
			? '\t\ttrigger = { NOT = { has_variable = abm_focus_changes_used } }'
			: '\t\ttrigger = { has_variable = abm_focus_changes_used var:abm_focus_changes_used = ' + used + ' }');
		out.push('\t}');
	}
	out.push('\ttext = {');
	out.push('\t\tlocalization_key = ABM_FOCUS_CHANGES_LEFT_0');
	out.push('\t}');
	out.push('}');
	return out.join('\n') + '\n';
}

function locFile() {
	const L = ['l_english:'];
	const q = s => s.replace(/"/g, '\\"');
	L.push(' # GENERATED by .tools/scripts/focus_picks/generate_focus_picks.js - edit focus_data.js and re-run.');
	L.push('');
	L.push(' # Age event (player notice; AI countries never pick)');
	L.push(' abm_focus_picks.1.desc: "This is the dawning of the [GetCurrentAge.GetName]!\\n\\n[GetCurrentAge.GetDesc]\\n\\nThis [age|e] we choose #Y two#! focuses: one #Y Economic#! and one #Y Military#!. Each unlocks its own branch of [advances|e]. Pick them in the #Y Focus Picks#! panel, from the button in the top right under the age."');
	L.push(' abm_focus_picks.1.a: "We will choose our focuses."');
	L.push('');
	L.push(' # Focus panel');
	L.push(' ABM_FOCUS_PANEL_TOGGLE: "Focus Picks"');
	L.push(' ABM_FOCUS_PANEL_TOGGLE_TOOLTIP: "#T Focus Picks#!\\nOpen the Focus Picks panel: every [age|e]\'s Economic and Military focus branches, the [advances|e] each one unlocks, and where we pick them."');
	L.push(' ABM_FOCUS_PANEL_TOGGLE_PENDING: "#Y Focus Picks (!)#!"');
	L.push(' ABM_FOCUS_PANEL_TOGGLE_PENDING_TOOLTIP: "#T Focus Picks#!\\n#Y We have not picked all our focuses for this [age|e] yet.#!\\n\\nOpen the Focus Picks panel to choose one Economic and one Military focus."');
	L.push(' ABM_FOCUS_PANEL_TITLE: "Focus Picks"');
	L.push(' ABM_FOCUS_PANEL_CLOSE: "Close"');
	L.push(' ABM_FOCUS_PANEL_CLOSE_TOOLTIP: "Close the Focus Picks panel"');
	L.push(' ABM_FOCUS_PANEL_QUOTE: "“Every age had its own kind of war, its own limiting conditions, and its own peculiar preconceptions.”"');
	L.push(' ABM_FOCUS_PANEL_QUOTE_BY: "— Carl von Clausewitz, On War"');
	L.push(` ABM_FOCUS_PANEL_INTRO: "From the Renaissance on, each [age|e] we pick one #Y Economic#! and one #Y Military#! focus, once that age has begun. Only picked branches appear in the [advances|e] tree, and picks from earlier ages stay researchable. A pick can be changed until one of its advances is researched."`);
	L.push(' ABM_FOCUS_FX_HIDE: "Hide advance effects"');
	L.push(' ABM_FOCUS_FX_HIDE_TT: "Show only the advance names, for a shorter list. Hovering an advance still shows its full tooltip."');
	L.push(' ABM_FOCUS_FX_SHOW: "Show advance effects"');
	L.push(' ABM_FOCUS_FX_SHOW_TT: "Show each advance\'s bonuses under its name."');
	L.push(' ABM_FOCUS_PANEL_CHANGES: "Focus changes left: [Country.Custom(\'abm_focus_changes_left\')]"');
	L.push(` ABM_FOCUS_PANEL_CHANGES_TT: "Each country may change a pick at most ${MAX_CHANGES} times per campaign, and only before any of that pick's [advances|e] is researched."`);
	L.push(' ABM_FOCUS_AGE_CURRENT: "#G Current age#!: pick one Economic and one Military focus"');
	L.push(' ABM_FOCUS_AGE_PAST: "#weak Past age: its picks stay researchable#!"');
	L.push(' ABM_FOCUS_AGE_FUTURE: "#R Not begun yet#!: these focuses can be picked once this age begins"');
	L.push(' ABM_FOCUS_SLOT_EMPTY: "#R Not picked yet#!"');
	L.push(' ABM_FOCUS_CARD_PICKED: "#G Our focus for this age#!"');
	for (let n = 0; n <= MAX_CHANGES; n++) L.push(` ABM_FOCUS_CHANGES_LEFT_${n}: "${n === 0 ? '#R 0#!' : '#G ' + n + '#!'}"`);
	L.push(` ABM_FOCUS_CHANGES_NONE_TT: "We have focus changes left (at most ${MAX_CHANGES} per campaign)"`);
	L.push(` ABM_FOCUS_NOTHING_RESEARCHED_TT: "None of the current pick's [advances|e] in this row has been researched yet"`);
	L.push(' ABM_FOCUS_PANEL_ECONOMIC: "Economic Focus"');
	L.push(' ABM_FOCUS_PANEL_MILITARY: "Military Focus"');
	L.push(' ABM_FOCUS_PANEL_PICKED: "#G Picked#!"');
	L.push(' ABM_FOCUS_PICK: "Pick"');
	L.push(' ABM_FOCUS_PICK_TT: "Pick this focus. Its [advances|e] appear in the tree and can be researched."');
	L.push(' ABM_FOCUS_SWITCH: "Change to this"');
	L.push(` ABM_FOCUS_SWITCH_NONE_TT: "#R This focus can't be picked now.#! A pick can only be changed before any of its [advances|e] is researched, and at most ${MAX_CHANGES} times per campaign."`);
	L.push(` ABM_FOCUS_SWITCH_TT: "Replace this [age|e]'s current pick in this row with this focus.\\n\\n#R Uses 1 of our ${MAX_CHANGES} focus changes.#! Only possible while none of the current pick's [advances|e] is researched."`);
	for (const a of ages) {
		L.push(` abm_focus_panel.${a.age}: "Age of $${a.age}$"`);
		L.push(` abm_focus_panel.${a.age}.reached_tt: "The Age of $${a.age}$ has begun"`);
		L.push(` abm_focus_panel.${a.age}.not_reached_tt: "#R Not yet available.#! This focus can be picked once the Age of $${a.age}$ has begun."`);
		L.push(` abm_focus_tab.${a.age}: "${ROMAN[a.n]} · $${a.age}$"`);
		L.push(` abm_focus_tab.${a.age}.tt: "Show the focuses of the Age of $${a.age}$"`);
	}
	for (const kind of ['eco', 'mil']) {
		for (const a of ages) {
			for (const br of a[kind]) {
				L.push('');
				L.push(` # ${a.age} - ${kind === 'eco' ? 'Economic' : 'Military'} - ${br.name}`);
				L.push(` abm_focus_picks.${br.id}: "${q(br.name)} Focus"`);
				const names = br.adv.map(x => `$${x[0]}$`).join(', ');
				// Single-line tooltips (no \n), like vanilla option .tt keys.
				L.push(` abm_focus_picks.${br.id}.tt: "${q(br.desc)}"`);
				L.push(` abm_focus_picks.${br.id}.unlocks_tt: "Unlocks the #Y ${q(br.name)}#! [advances|e]: ${names}"`);
				// Focus panel: one advance per line, as links whose tooltip shows the advance's effects.
				L.push(` abm_focus_panel.${br.id}.advances: "${br.adv.map(x => `• [ShowAdvanceName('${x[0]}')]`).join('\\n')}"`);
				L.push(` abm_focus_name.${br.id}: "${q(br.name)}"`);
				L.push(` abm_focus_panel.${br.id}.chosen: "Picked: #Y ${q(br.name)}#!"`);
				for (const [key] of br.adv) L.push(` abm_focus_adv.${key}: "[ShowAdvanceName('${key}')]"`);
				for (const [key, mods, extra] of br.adv) L.push(` abm_focus_fx.${key}: "${advEffects(key, mods, extra)}"`);
				for (const [key, , extra = {}] of br.adv) {
					if (!extra.name) continue;
					L.push(` ${key}: "${q(extra.name)}"`);
					L.push(` ${key}_desc: "${q(extra.desc)}"`);
				}
			}
		}
	}
	return L.join('\n') + '\n';
}

// Focus Picks panel: a GUI type placed in right_panel.gui next to the Tier List panel and toggled
// client-side via GetVariableSystem('abm_focus_panel_open') (per-player UI state, not a script var).
// Look: vanilla window frame (bg_lateralview + window_header_alt), one tab per age, an age banner with the
// vanilla age illustration, and per branch a card with an illustrated header and the advances as icon rows.
// Only vanilla templates and textures are used (gfx() checks every texture path exists).
function guiFile() {
	const PANEL_W = 800;
	const PANEL_H = 840;
	// 3 cards + 2 x 8 spacing inside the scroll area (panel - 2 x 10 margin - scrollbar - slack).
	const CARD_W = 244;
	const BODY_W = CARD_W - 16; // card body margin 8 each side
	const SGUI_SCOPE = 'GuiScope.SetRoot(GetPlayer.MakeScope).End'; // same form as the tier panel toggles
	const shown = name => `GetScriptedGui('${name}').IsShown(${SGUI_SCOPE})`;
	const picked = id => `GetPlayer.MakeScope.GetVariable('${focusVar(id)}').IsSet`;
	const and = (...xs) => xs.reduce((a, b) => `And(${a}, ${b})`);
	// The open age tab: the one the player clicked, else the current age (Renaissance during Traditions).
	const ageOpen = a => `Or(GetVariableSystem.HasValue('abm_focus_age', '${a.n}'), And(Not(GetVariableSystem.Exists('abm_focus_age')), ${shown('abm_focus_age_default_' + a.age)}))`;
	const SECTION = {
		eco: { label: 'ABM_FOCUS_PANEL_ECONOMIC', color: 'color_economy_texture', icon: gfx('interface/icons/flat_icons/adm.dds') },
		mil: { label: 'ABM_FOCUS_PANEL_MILITARY', color: 'color_military_texture', icon: gfx('interface/icons/flat_icons/mil.dds') },
	};
	const GLOW = gfx('interface/advance/advances_glow/advances_glow_yellow.dds');
	const FADE_MASK = gfx('interface/component_masks/mask_fadehorizontal_middle_thick.dds');
	const CORNER = gfx('interface/component_decoration/bg_corner_flavor_04.dds');
	const PANEL_ART = gfx('interface/illustrations/bg/bg_researches.dds');

	// Each action is an enabled/disabled pair: a tooltip can't switch on validity, so the disabled
	// twin carries the reason (age not begun / no focus changes left).
	const btn = (sgui, text, okTip, noTip) => {
		const g = `GetScriptedGui('${sgui}')`;
		const isShown = `${g}.IsShown(${SGUI_SCOPE})`;
		const valid = `${g}.IsValid(${SGUI_SCOPE})`;
		return `
							button_regular = {
								text = "${text}"
								tooltip = "${okTip}"
								size = { ${BODY_W} 28 }
								visible = "[And(${isShown}, ${valid})]"
								onclick = "[${g}.Execute(${SGUI_SCOPE})]"
							}
							button_regular = {
								text = "${text}"
								tooltip = "${noTip}"
								size = { ${BODY_W} 28 }
								enabled = no
								visible = "[And(${isShown}, Not(${valid}))]"
							}`;
	};

	// Icon, then the name (hover = the game's advance tooltip) with its effects underneath unless the
	// player hid them (client-side abm_focus_hide_fx).
	const FX_W = BODY_W - 30;
	const advanceRow = ([key, , extra = {}]) => `
							hbox = {
								layoutpolicy_horizontal = expanding
								spacing = 6
								vbox = {
									icon = {
										size = { 24 24 }
										texture = "${advIcon(key, extra)}"
									}
									expand = {}
								}
								vbox = {
									layoutpolicy_horizontal = expanding
									text_single = {
										layoutpolicy_horizontal = expanding
										text = "abm_focus_adv.${key}"
										using = Font_Size_Small
										align = left|nobaseline
										max_width = ${FX_W}
										elide = right
									}
									text_multi = {
										visible = "[Not(GetVariableSystem.Exists('abm_focus_hide_fx'))]"
										text = "abm_focus_fx.${key}"
										using = Font_Size_Very_Small
										autoresize = yes
										align = left|nobaseline
										minimumsize = { ${FX_W} -1 }
										maximumsize = { ${FX_W} -1 }
									}
								}
							}`;

	const card = (br, age) => {
		const [leadKey, , leadExtra = {}] = br.adv[0];
		return `
					# ${br.name}
					vbox = {
						minimumsize = { ${CARD_W} -1 }
						maximumsize = { ${CARD_W} -1 }
						layoutpolicy_vertical = expanding
						spacing = 6
						margin_bottom = 8
						using = bg_paper_card
						using = bg_cabinet_card_frame

						# Illustrated header: art, gold glow once picked, dark strip with the lead advance's icon and the name.
						widget = {
							size = { ${CARD_W} 92 }
							background = {
								texture = "${branchArt(br)}"
								fittype = centercrop
							}
							icon = {
								size = { 100% 100% }
								texture = "${GLOW}"
								alpha = 0.6
								visible = "[${picked(br.id)}]"
							}
							icon = {
								size = { 100% 38 }
								parentanchor = bottom
								using = color_black_texture
								alpha = 0.6
							}
							icon = {
								size = { 44 44 }
								parentanchor = bottom|left
								position = { 6 -4 }
								texture = "${advIcon(leadKey, leadExtra)}"
							}
							text_single = {
								parentanchor = bottom|left
								position = { 58 -10 }
								text = "abm_focus_name.${br.id}"
								using = Font_Type_Headers
								using = Font_Size_Medium
								default_format = "#yellow_titles"
								align = left|nobaseline
								max_width = ${CARD_W - 66}
								elide = right
							}
							widget = {
								visible = "[${picked(br.id)}]"
								parentanchor = top|right
								position = { -6 6 }
								size = { 68 22 }
								background = {
									using = color_black_texture
									alpha = 0.7
								}
								text_single = {
									parentanchor = center
									text = "ABM_FOCUS_PANEL_PICKED"
									using = Font_Size_Small
									align = center|nobaseline
								}
							}
						}

						vbox = {
							layoutpolicy_horizontal = expanding
							margin = { 8 0 }
							spacing = 4
							text_multi = {
								text = "abm_focus_picks.${br.id}.tt"
								using = Font_Size_Small
								autoresize = yes
								align = left|nobaseline
								minimumsize = { ${BODY_W} -1 }
								maximumsize = { ${BODY_W} -1 }
							}
${br.adv.map(advanceRow).join('\n')}
						}

						expand = {}

						vbox = {
							layoutpolicy_horizontal = expanding
							margin = { 8 0 }
${btn('abm_focus_pick_' + br.id, 'ABM_FOCUS_PICK', 'ABM_FOCUS_PICK_TT', 'abm_focus_panel.' + age + '.not_reached_tt')}
${btn('abm_focus_switch_' + br.id, 'ABM_FOCUS_SWITCH', 'ABM_FOCUS_SWITCH_TT', 'ABM_FOCUS_SWITCH_NONE_TT')}
							text_single = {
								visible = "[${picked(br.id)}]"
								text = "ABM_FOCUS_CARD_PICKED"
								using = Font_Size_Small
								align = center|nobaseline
								size = { ${BODY_W} 28 }
							}
						}
					}`;
	};

	// Section strip (Economic / Military): tinted band, icon, title, and the slot's state on the right.
	const section = (kind, brs, age) => {
		const s = SECTION[kind];
		return `
				widget = {
					layoutpolicy_horizontal = expanding
					size = { -1 36 }
					background = {
						using = ${s.color}
						alpha = 0.7
						modify_texture = {
							texture = "${FADE_MASK}"
							blend_mode = alphamultiply
						}
					}
					hbox = {
						margin = { 10 0 }
						spacing = 8
						icon = {
							size = { 26 26 }
							texture = "${s.icon}"
						}
						text_single = {
							text = "${s.label}"
							using = Font_Type_Headers
							using = Font_Size_Medium
							default_format = "#yellow_titles"
							align = left|nobaseline
						}
						expand = {}
						text_single = {
							visible = "[${and(...brs.map(b => `Not(${picked(b.id)})`))}]"
							text = "ABM_FOCUS_SLOT_EMPTY"
							using = Font_Size_Small
							align = right|nobaseline
						}
${brs.map(b => `						text_single = {
							visible = "[${picked(b.id)}]"
							text = "abm_focus_panel.${b.id}.chosen"
							using = Font_Size_Small
							align = right|nobaseline
						}`).join('\n')}
					}
				}
				hbox = {
					layoutpolicy_horizontal = expanding
					spacing = 8
${brs.map(br => card(br, age)).join('\n')}
					expand = {}
				}`;
	};

	// Age banner: the vanilla age illustration (as in the advances view), age icon, name, and state.
	const banner = a => `
				widget = {
					layoutpolicy_horizontal = expanding
					size = { -1 96 }
					background = {
						texture = "${gfx(`interface/illustrations/advances/${a.age}.dds`)}"
						fittype = centercrop
					}
					using = scene_fade_horizontal
					blockoverride "scene_fade_alpha" {
						alpha = 0.6
					}
					using = bg_age_event_frame

					hbox = {
						margin = { 14 6 }
						spacing = 12
						icon = {
							size = { 76 76 }
							texture = "${gfx(`interface/icons/age/${a.age}.dds`)}"
						}
						vbox = {
							layoutpolicy_horizontal = expanding
							spacing = 4
							expand = {}
							text_single = {
								text = "abm_focus_panel.${a.age}"
								tooltip = "${a.age}_desc"
								using = Font_Type_Headers
								using = Font_Size_Big
								default_format = "#yellow_titles"
								align = left|nobaseline
							}
							text_single = {
								visible = "[${shown('abm_focus_age_current_' + a.age)}]"
								text = "ABM_FOCUS_AGE_CURRENT"
								using = Font_Size_Small
								align = left|nobaseline
							}
							text_single = {
								visible = "[And(${shown('abm_focus_age_reached_' + a.age)}, Not(${shown('abm_focus_age_current_' + a.age)}))]"
								text = "ABM_FOCUS_AGE_PAST"
								using = Font_Size_Small
								align = left|nobaseline
							}
							text_single = {
								visible = "[Not(${shown('abm_focus_age_reached_' + a.age)})]"
								text = "ABM_FOCUS_AGE_FUTURE"
								using = Font_Size_Small
								align = left|nobaseline
							}
							expand = {}
						}
					}
				}`;

	const ageBlocks = ages.map(a => `
			# ${a.age}
			vbox = {
				visible = "[${ageOpen(a)}]"
				layoutpolicy_horizontal = expanding
				spacing = 8
${banner(a)}
${section('eco', a.eco, a.age)}
${section('mil', a.mil, a.age)}
			}`).join('\n');

	const tabs = ages.map(a => `
				button_secondary_tab_alt = {
					using = layoutpolicy_expanding
					blockoverride "tab_text" {
						text = "abm_focus_tab.${a.age}"
					}
					tooltip = "abm_focus_tab.${a.age}.tt"
					down = "[${ageOpen(a)}]"
					onclick = "[GetVariableSystem.Set('abm_focus_age', '${a.n}')]"
				}`).join('\n');

	return `# Ars Belli Focus Picks panel. GENERATED by .tools/scripts/focus_picks/generate_focus_picks.js
# Edit focus_data.js and re-run the generator instead of editing this file by hand.
# Placed in panels/right_panel/right_panel.gui (search "# Ars Belli focus picks panel"); opened by the
# "Focus Picks" button in the Tier List panel. Advance names use [ShowAdvanceName(...)], so hovering
# shows the game's own advance tooltip with its effects.
# Client-side UI state (per player, never synced): abm_focus_panel_open = panel open,
# abm_focus_age = open age tab (2-6; unset = the current age).
types AbmFocusPicksTypes
{
	# Always-visible opener under the age in the top right (not tied to the MP mechanics rule, unlike
	# the Tier List panel). Swaps to a highlighted "(!)" button while this age still has an empty slot.
	# Placed in right_panel.gui inside the rank block next to Tier List (a copy below the bar was
	# clipped and never showed), plus a standalone copy for games without the MP mechanics rule.
	# Icon-only: a text button next to Tier List covered the age name. ignoreinvisible stops the
	# hidden twin from reserving space (it pushed the visible button over the age name).
	# The inner container is hidden until there is a player country: abm_focus_pending is a country
	# trigger, and evaluating it during loading logged "Scoped object of type 'country' is not valid".
	# (The instance in right_panel.gui sets its own visible, so the guard can't sit on the outer one.)
	type abm_focus_picks_button = flowcontainer {
		direction = horizontal
		ignoreinvisible = yes

		flowcontainer = {
			direction = horizontal
			ignoreinvisible = yes
			visible = "[IsPlayerValid]"

			button_regular = {
				tooltip = "ABM_FOCUS_PANEL_TOGGLE_TOOLTIP"
				onclick = "[GetVariableSystem.Toggle('abm_focus_panel_open')]"
				size = { 30 22 }
				visible = "[Not(${shown('abm_focus_pending')})]"

				icon = {
					texture = "${gfx('interface/icons/flat_icons/ages.dds')}"
					size = { 18 18 }
					parentanchor = center
				}
			}
			button_regular = {
				tooltip = "ABM_FOCUS_PANEL_TOGGLE_PENDING_TOOLTIP"
				onclick = "[GetVariableSystem.Toggle('abm_focus_panel_open')]"
				size = { 30 22 }
				visible = "[${shown('abm_focus_pending')}]"

				icon = {
					texture = "${gfx('interface/icons/alerts_icons/advances.dds')}"
					size = { 20 20 }
					parentanchor = center
				}
			}
		}
	}

	type abm_focus_picks_panel = widget {
		name = "abm_focus_picks_panel"
		layer = top
		parentanchor = top|right
		widgetanchor = top|right
		position = { -810 110 }
		size = { ${PANEL_W} ${PANEL_H} }
		allow_outside = yes
		alwaystransparent = no
		filter_mouse = all
		visible = "[GetVariableSystem.Exists('abm_focus_panel_open')]"

		state = {
			name = _show
			using = Animation_FadeIn_Quick
		}
		state = {
			name = _hide
			using = Animation_FadeOut_Quick
		}

		vbox = {
			using = layoutpolicy_expanding
			using = bg_lateralview

			window_header_alt = {
				blockoverride "header_text" {
					text = "ABM_FOCUS_PANEL_TITLE"
				}
				blockoverride "window_header_alt_color_texture" {
					using = color_advances_texture
				}
			}

			vbox = {
				using = layoutpolicy_expanding
				using = bg_main_inner_image_alt
				blockoverride "image" {
					texture = "${PANEL_ART}"
				}
				margin = { 10 8 }
				spacing = 8

				# Intro: quote, the rules, and focus changes left.
				vbox = {
					layoutpolicy_horizontal = expanding
					margin = { 18 8 }
					spacing = 3
					using = bg_paper_card
					using = bg_corner_flavor
					blockoverride "corner_flavor_texture" {
						texture = "${CORNER}"
						texture_density = 2
						spriteType = Corneredstretched
						spriteborder = { 35 35 }
						margin = { -2 -2 }
					}
					text_multi = {
						layoutpolicy_horizontal = expanding
						text = "ABM_FOCUS_PANEL_QUOTE"
						using = Font_Type_Flavor
						using = Font_Size_Medium
						autoresize = yes
						max_width = 720
						align = center|nobaseline
					}
					text_single = {
						layoutpolicy_horizontal = expanding
						text = "ABM_FOCUS_PANEL_QUOTE_BY"
						using = Font_Size_Very_Small
						default_format = "#weak"
						align = center|nobaseline
					}
					widget = { size = { 10 4 } }
					text_multi = {
						layoutpolicy_horizontal = expanding
						text = "ABM_FOCUS_PANEL_INTRO"
						using = Font_Size_Small
						autoresize = yes
						max_width = 720
						align = center|nobaseline
					}
					hbox = {
						layoutpolicy_horizontal = expanding
						spacing = 12
						expand = {}
						text_single = {
							datacontext = "[GetPlayer]"
							text = "ABM_FOCUS_PANEL_CHANGES"
							tooltip = "ABM_FOCUS_PANEL_CHANGES_TT"
							using = Font_Size_Small
							align = center|nobaseline
						}
						button_regular = {
							visible = "[Not(GetVariableSystem.Exists('abm_focus_hide_fx'))]"
							text = "ABM_FOCUS_FX_HIDE"
							tooltip = "ABM_FOCUS_FX_HIDE_TT"
							size = { 190 24 }
							onclick = "[GetVariableSystem.Set('abm_focus_hide_fx', 'yes')]"
						}
						button_regular = {
							visible = "[GetVariableSystem.Exists('abm_focus_hide_fx')]"
							text = "ABM_FOCUS_FX_SHOW"
							tooltip = "ABM_FOCUS_FX_SHOW_TT"
							size = { 190 24 }
							onclick = "[GetVariableSystem.Clear('abm_focus_hide_fx')]"
						}
						expand = {}
					}
				}

				# One tab per age; the current age is open by default.
				hbox = {
					layoutpolicy_horizontal = expanding
					spacing = 2
${tabs}
				}

				scrollarea = {
					layoutpolicy_horizontal = expanding
					layoutpolicy_vertical = expanding
					scrollbarpolicy_horizontal = always_off
					scrollbar_vertical = {
						using = Scrollbar_Vertical
					}

					scrollwidget = {
						vbox = {
							layoutpolicy_horizontal = expanding
							margin_right = 14 # keep the strips' right-hand text clear of the scrollbar
							spacing = 8
${ageBlocks}
						}
					}
				}
			}
		}

		# Close button, top right like the vanilla views; Escape closes the panel too.
		widget = {
			size = { 100% 40 }
			widget = {
				parentanchor = right
				size = { 40 40 }
				button_close_alt = {
					blockoverride "close_on_action" {
						on_action = "[GetVariableSystem.Clear('abm_focus_panel_open')]"
					}
					blockoverride "close_inputaction" {
						input_action = "close_window"
					}
				}
			}
		}
	}
}
`;
}

write('in_game/gui/shared/abm_focus_picks_panel.gui', guiFile());
write('in_game/common/advances/abm_focus_picks_economic.txt', advancesFile('eco'));
write('in_game/common/advances/abm_focus_picks_military.txt', advancesFile('mil'));
write('in_game/events/ages.txt', eventsFile());
write('in_game/common/scripted_guis/abm_focus_picks_gui.txt', sguiFile());
write('in_game/common/customizable_localization/abm_focus_picks_custom_loc.txt', customLocFile());
write('main_menu/localization/english/abm_focus_picks_l_english.yml', locFile());
