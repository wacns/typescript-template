import {NS} from "@ns";
import {WacnOSConfig} from "WacnOS/config";
import {GameSnapshot} from "WacnOS/bridge/gamestate";
import {Phase} from "WacnOS/status";
import {AugBuy, planPurchases, repGoalFor, shouldInstall} from "WacnOS/autopilot/plan";
import {
    BACKDOOR_FACTIONS,
    BN1_LADDER,
    CASINO_LIMIT,
    CITY_FACTIONS,
    DAEDALUS,
    INVITE_ALLOWLIST,
    NETBURNERS_REQ,
} from "WacnOS/autopilot/phases";

/**
 * What to do next.
 *
 * A pure function of the snapshot: same inputs, same answer, no side effects. That's what makes
 * the daemon safe to kill and restart at any moment - it never carries state between ticks, so
 * there is no "resume point" to get wrong after an augmentation install wipes everything.
 *
 * The ordering below is a priority ladder, not a sequence. Each tick asks "what is the most
 * important thing right now" and does one step of it.
 */

export type UnlockAction =
    | { kind: "backdoor"; host: string }
    | { kind: "travel"; city: string }
    | { kind: "hacknet" }
    | { kind: "wait"; reason: string };

export interface Decision {
    phase: Phase;
    /** Ladder position for display, e.g. "3/8". */
    step: string;
    note: string;
    faction?: string;
    buys?: AugBuy[];
    unlock?: UnlockAction;
    /** Set when the phase needs us to be somewhere else first. */
    city?: string;
}

export interface DecideContext {
    snap: GameSnapshot;
    config: WacnOSConfig;
    /** Casino winnings since the last install. */
    casinoWon: number;
    /** True when a resume marker says we were on our way to the BitVerse. */
    pendingBitVerse: boolean;
    hacknetSatisfied: boolean;
}

export function decide(ns: NS, ctx: DecideContext): Decision {
    const {snap, config} = ctx;
    const player = ns.getPlayer();

    // 1. We already committed to leaving this BitNode.
    if (ctx.pendingBitVerse) {
        return {phase: "BITVERSE", step: "8/8", note: "taking the BitVerse portal"};
    }

    // 2. The Red Pill is installed, so the World Daemon is finally on the network.
    if (snap.owned.includes(DAEDALUS.redPill)) {
        return {phase: "WD_BACKDOOR", step: "8/8", note: "backdooring w0r1d_d43m0n"};
    }

    // 3. Bought but not installed - installing is what wires the World Daemon in (Prestige.ts).
    if (snap.queued.includes(DAEDALUS.redPill)) {
        return {phase: "INSTALL", step: "8/8", note: "installing The Red Pill"};
    }

    // 4. In Daedalus: everything now serves the 2.5m reputation for The Red Pill.
    const daedalus = snap.factions["Daedalus"];
    if (daedalus?.joined) {
        if (daedalus.rep >= DAEDALUS.redPillRep) {
            return {phase: "RED_PILL", step: "7/8", faction: "Daedalus", note: "buying The Red Pill"};
        }
        return {
            phase: "DAEDALUS_REP",
            step: "7/8",
            faction: "Daedalus",
            note: `Daedalus reputation ${fmt(daedalus.rep)} / ${fmt(DAEDALUS.redPillRep)}`,
        };
    }

    // 5. Accept any invitation we're allowed to take. Anything else is left pending forever -
    //    joining a city faction would ban Sector-12 and Aevum and strand the aug count.
    const invite = snap.invitations.find((f) => INVITE_ALLOWLIST.has(f) && !snap.factions[f]?.joined);
    if (invite) {
        return {phase: "FACTION_JOIN", step: stepFor(invite), faction: invite, note: `joining ${invite}`};
    }

    // 6. Casino: $10b for a $200k plane ticket, and it re-arms after every install. Do it before
    //    grinding anything, because it dwarfs early hacking income.
    if (config.useCasino && ctx.casinoWon < CASINO_LIMIT - 1e6 && player.money >= 300e3) {
        if (player.city !== "Aevum") {
            return {phase: "MONEY_CASINO", step: "--", city: "Aevum", note: "travelling to Aevum for the casino"};
        }
        return {phase: "MONEY_CASINO", step: "--", note: "farming the casino to its limit"};
    }

    // 7. Install when the queue is deep enough. Doing this before buying more keeps the 1.9x
    //    per-queued-aug price escalation from compounding out of control.
    if (shouldInstall(snap, config.augsAtOnce, DAEDALUS.augs)) {
        return {
            phase: "INSTALL",
            step: augStep(snap),
            note: `installing ${snap.queued.length} queued augmentation(s)`,
        };
    }

    // 8. Buy whatever we can afford within current reputation.
    const joined = Object.values(snap.factions).filter((f) => f.joined).map((f) => f.name);
    const buys = planPurchases(snap, joined, {
        allowNFG: snap.distinctOwned >= DAEDALUS.augs,
        reserve: config.reserveMoney,
    });
    if (buys.length > 0) {
        return {
            phase: "BUY_AUGS",
            step: augStep(snap),
            faction: buys[0].faction,
            buys,
            note: `buying ${buys[0].aug}`,
        };
    }

    // 9. Work down the ladder: unlock the first faction we haven't joined.
    for (const faction of BN1_LADDER) {
        if (snap.factions[faction]?.joined) continue;
        if (snap.factions[faction]?.banned) continue;

        const unlock = unlockActionFor(ns, faction, ctx);
        return {
            phase: "FACTION_UNLOCK",
            step: stepFor(faction),
            faction,
            unlock,
            note: describeUnlock(faction, unlock),
        };
    }

    // 10. All joined - grind reputation for the first faction still holding augs we want.
    for (const faction of BN1_LADDER) {
        const state = snap.factions[faction];
        if (!state?.joined) continue;
        const goal = repGoalFor(snap, faction);
        if (goal > 0 && state.rep < goal) {
            return {
                phase: "FACTION_REP",
                step: stepFor(faction),
                faction,
                note: `${faction} reputation ${fmt(state.rep)} / ${fmt(goal)}`,
            };
        }
    }

    // 11. Nothing to do but grow into the Daedalus gate.
    return idleReason(ns, snap);
}

/** How a faction gets unlocked, given where we are now. */
function unlockActionFor(ns: NS, faction: string, ctx: DecideContext): UnlockAction {
    const player = ns.getPlayer();

    const host = BACKDOOR_FACTIONS[faction];
    if (host) {
        if (!ns.serverExists(host)) return {kind: "wait", reason: `${host} not on the network yet`};
        const need = ns.getServerRequiredHackingLevel(host);
        if (need > player.skills.hacking) {
            return {kind: "wait", reason: `hacking ${need} for ${host} (have ${player.skills.hacking})`};
        }
        return {kind: "backdoor", host};
    }

    const city = CITY_FACTIONS[faction];
    if (city) {
        if (player.skills.hacking < city.hacking) {
            return {kind: "wait", reason: `hacking ${city.hacking} (have ${player.skills.hacking})`};
        }
        if (player.money < city.money) {
            return {kind: "wait", reason: `$${fmt(city.money)} (have $${fmt(player.money)})`};
        }
        if (!city.cities.includes(player.city)) return {kind: "travel", city: city.cities[0]};
        return {kind: "wait", reason: "requirements met - waiting for the invite tick"};
    }

    if (faction === "Netburners") {
        if (player.skills.hacking < NETBURNERS_REQ.hacking) {
            return {kind: "wait", reason: `hacking ${NETBURNERS_REQ.hacking} (have ${player.skills.hacking})`};
        }
        if (!ctx.hacknetSatisfied) return {kind: "hacknet"};
        return {kind: "wait", reason: "requirements met - waiting for the invite tick"};
    }

    return {kind: "wait", reason: "no known unlock path"};
}

function describeUnlock(faction: string, unlock: UnlockAction): string {
    switch (unlock.kind) {
        case "backdoor":
            return `backdooring ${unlock.host} for ${faction}`;
        case "travel":
            return `travelling to ${unlock.city} for ${faction}`;
        case "hacknet":
            return `growing the hacknet for ${faction}`;
        default:
            return `${faction} needs ${unlock.reason}`;
    }
}

/**
 * What we're waiting on once the ladder is exhausted. Daedalus wants 30 distinct installed
 * augmentations, $100b and hacking 2500 - usually the augmentations come first and the other two
 * follow from simply continuing to run.
 */
function idleReason(ns: NS, snap: GameSnapshot): Decision {
    const player = ns.getPlayer();
    const step = augStep(snap);

    if (snap.distinctOwned < DAEDALUS.augs) {
        const short = DAEDALUS.augs - snap.distinctOwned;
        return {
            phase: "IDLE",
            step,
            note: `${short} more augmentation(s) for Daedalus - earning reputation and money`,
        };
    }
    if (player.money < DAEDALUS.money) {
        return {phase: "IDLE", step, note: `banking toward $${fmt(DAEDALUS.money)} (have $${fmt(player.money)})`};
    }
    if (player.skills.hacking < DAEDALUS.hacking) {
        return {
            phase: "IDLE",
            step,
            note: `training hacking to ${DAEDALUS.hacking} (have ${player.skills.hacking})`,
        };
    }
    return {phase: "IDLE", step, note: "Daedalus requirements met - waiting for the invite tick"};
}

function stepFor(faction: string): string {
    const index = (BN1_LADDER as readonly string[]).indexOf(faction);
    return index >= 0 ? `${index + 1}/${BN1_LADDER.length}` : "--";
}

function augStep(snap: GameSnapshot): string {
    return `${snap.distinctOwned}/${DAEDALUS.augs}`;
}

function fmt(n: number): string {
    if (n >= 1e9) return `${(n / 1e9).toFixed(2)}b`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(2)}m`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
    return n.toFixed(0);
}
