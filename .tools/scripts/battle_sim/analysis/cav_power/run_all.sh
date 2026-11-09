#!/bin/sh
# Every run of the cavalry combat power study, from the repo root: sh .tools/scripts/battle_sim/analysis/cav_power/run_all.sh
# "mod" = units.json (cavalry 2.2 / 2.4 / 2.6 / 2.85 / 3.0 / 3.2), "vanilla" = the same data with vanilla cavalry power.
# Two comparisons only: the same regiment count, and the same MAINTENANCE manpower a month (army_meta.js "manpower").
# The simulators lower their own priority to the lowest, so this never slows other programs.
set -e
A=.tools/scripts/battle_sim/analysis/army_meta.js
D=.tools/scripts/battle_sim/analysis/cav_power
R=$D/results
VAN="$(pwd)/$R/units_vanilla_cav.json"
AGES=1,2,3,4,5,6
VIEWS=regiments,manpower
node $D/units_with_cav_power.js "$VAN" 2.6,2.6,2.6,2.85,3.25,3.25
run() { name=$1; shift; echo "$(date +%H:%M:%S) $name"; "$@" > $R/$name.log 2>&1; }
# the named armies, round robin
run named_mod node $A named --ages $AGES --views $VIEWS --n 800 --out $R/named_mod.json
run named_vanilla env EU5_UNITS="$VAN" node $A named --ages $AGES --views $VIEWS --n 800 --out $R/named_vanilla.json
# best army by age, double oracle over the whole grid (as meta_1.4/results/regulars_30)
run meta_mod node $A regulars --ages $AGES --views $VIEWS --n 100 --nm 800 --iters 10 --out $R/meta_mod.json
run meta_vanilla env EU5_UNITS="$VAN" node $A regulars --ages $AGES --views $VIEWS --n 100 --nm 800 --iters 10 --out $R/meta_vanilla.json
# wars of attrition: the best mix against pure heavy cavalry and pure heavy infantry (same regiments, same manpower upkeep)
run wars_mod node $A wars --in $R/meta_mod.json --ages $AGES --wars 500 --months 120 --interval ready --out $R/wars_mod.json
run wars_vanilla env EU5_UNITS="$VAN" node $A wars --in $R/meta_vanilla.json --ages $AGES --wars 500 --months 120 --interval ready --out $R/wars_vanilla.json
# hills and woods, mod power, same regiments
run named_mod_hills node $A named --ages $AGES --views regiments --n 800 --loc '{"topography":"hills","vegetation":"woods"}' --out $R/named_mod_hills.json
# heavy or light infantry, infantry-only armies
run infantry_mix node $A named --ages $AGES --views $VIEWS --n 800 --comps "100hi=hi:1;70hi 30li=hi:0.7,li:0.3;50hi 50li=hi:0.5,li:0.5;30hi 70li=hi:0.3,li:0.7;100li=li:1" --out $R/infantry_mix.json
# age 3 sweep: the mod's other ages, age 3 cavalry at 2.6 (the mod), 2.4, 2.2, 2.0
C="inf 50/50=hi:0.5,li:0.5;100hc=hc:1;40hi 40li 20lc=hi:0.4,li:0.4,lc:0.2;25x4=hi:0.25,li:0.25,hc:0.25,lc:0.25;45hi 45hc 10lc=hi:0.45,hc:0.45,lc:0.1;30hi 30li 20hc 20lc=hi:0.3,li:0.3,hc:0.2,lc:0.2"
for p in 2.6 2.4 2.2 2.0; do
	U="$(pwd)/$R/sweep_units.json"
	node $D/units_with_cav_power.js "$U" 2.2,2.4,$p,2.85,3.0,3.2 > /dev/null
	run age3_sweep_$p env EU5_UNITS="$U" node $A named --ages 3 --views $VIEWS --n 800 --comps "$C" --out $R/age3_sweep_$p.json
	rm -f "$U"
done
echo "$(date +%H:%M:%S) done"
