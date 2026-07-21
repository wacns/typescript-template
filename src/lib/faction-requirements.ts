import { NS, PlayerRequirement } from "@ns";

// FactionName isn't an exported type in NetscriptDefinitions.d.ts, so derive it from joinFaction's own signature.
type FactionNameType = Parameters<NS["singularity"]["joinFaction"]>[0];

// FactionName is a string-literal type in the game's defs, not a runtime enum, so there's no
// ns.* call that enumerates "every faction" - this list is ported from NetscriptDefinitions.d.ts's
// FactionNameEnumType and has to be kept in sync by hand if the game adds new factions.
export const ALL_FACTIONS: FactionNameType[] = [
    "Illuminati", "Daedalus", "The Covenant", "ECorp", "MegaCorp", "Bachman & Associates", "Blade Industries",
    "NWO", "Clarke Incorporated", "OmniTek Incorporated", "Four Sigma", "KuaiGong International",
    "Fulcrum Secret Technologies", "BitRunners", "The Black Hand", "NiteSec", "Aevum", "Chongqing", "Ishima",
    "New Tokyo", "Sector-12", "Volhaven", "Speakers for the Dead", "The Dark Army", "The Syndicate", "Silhouette",
    "Tetrads", "Slum Snakes", "Netburners", "Tian Di Hui", "CyberSec", "Bladeburners",
    "Church of the Machine God", "Shadows of Anarchy"
];

// JobField isn't an exported type in NetscriptDefinitions.d.ts, so derive it from applyToCompany's own signature.
type JobField = Parameters<NS["singularity"]["applyToCompany"]>[1];

const JOB_FIELDS: JobField[] = [
    "Software", "Software Consultant", "IT", "Security Engineer", "Network Engineer", "Business",
    "Business Consultant", "Security", "Agent", "Employee", "Part-time Employee", "Waiter", "Part-time Waiter"
];

const NEUROFLUX_GOVERNOR = "NeuroFlux Governor";

// Skills isn't an exported type in NetscriptDefinitions.d.ts, so derive it from getPlayer()'s own return type.
type PlayerSkills = ReturnType<NS["getPlayer"]>["skills"];

/** Recursively checks a requirement (including not/someCondition/everyCondition) against live player state. */
export function isSatisfied(ns: NS, req: PlayerRequirement): boolean {
    switch (req.type) {
        case "money":
            return ns.getPlayer().money >= req.money;
        case "skills":
            return Object.entries(req.skills).every(
                ([skill, level]) => ns.getPlayer().skills[skill as keyof PlayerSkills] >= (level ?? 0)
            );
        case "karma":
            return ns.getPlayer().karma <= req.karma;
        case "numPeopleKilled":
            return ns.getPlayer().numPeopleKilled >= req.numPeopleKilled;
        case "file":
            return ns.fileExists(req.file, "home");
        case "numAugmentations": {
            const owned = [...ns.getResetInfo().ownedAugs.keys()].filter(name => name !== NEUROFLUX_GOVERNOR);
            return req.numAugmentations === 0 ? owned.length === 0 : owned.length >= req.numAugmentations;
        }
        case "employedBy":
            return Object.hasOwn(ns.getPlayer().jobs, req.company);
        case "companyReputation":
            return ns.singularity.getCompanyRep(req.company) >= req.reputation;
        case "jobTitle":
            return Object.values(ns.getPlayer().jobs).includes(req.jobTitle);
        case "city":
            return ns.getPlayer().city === req.city;
        case "location":
            return ns.getPlayer().location === req.location;
        case "backdoorInstalled":
            return !!ns.getServer(req.server).backdoorInstalled;
        case "hacknetRAM":
        case "hacknetCores":
        case "hacknetLevels": {
            let total = 0;
            for (let i = 0; i < ns.hacknet.numNodes(); i++) {
                const stats = ns.hacknet.getNodeStats(i);
                total += req.type === "hacknetRAM" ? stats.ram : req.type === "hacknetCores" ? stats.cores : stats.level;
            }
            const need = req.type === "hacknetRAM" ? req.hacknetRAM : req.type === "hacknetCores" ? req.hacknetCores : req.hacknetLevels;
            return total >= need;
        }
        case "bitNodeN":
            return ns.getResetInfo().currentNode === req.bitNodeN;
        case "sourceFile":
            return (ns.getResetInfo().ownedSF.get(req.sourceFile) ?? 0) > 0;
        case "bladeburnerRank":
            // getRank() throws if the player hasn't joined the Bladeburner division yet.
            try {
                return ns.bladeburner.getRank() >= req.bladeburnerRank;
            } catch {
                return false;
            }
        case "numInfiltrations":
            // Not exposed via any ns.* function - can't verify, so never claim it's satisfied.
            return false;
        case "not":
            return !isSatisfied(ns, req.condition);
        case "someCondition":
            return req.conditions.some(c => isSatisfied(ns, c));
        case "everyCondition":
            return req.conditions.every(c => isSatisfied(ns, c));
    }
}

export function describeRequirement(req: PlayerRequirement): string {
    switch (req.type) {
        case "money": return `$${req.money.toLocaleString()}`;
        case "skills": return Object.entries(req.skills).map(([s, n]) => `${s} ${n}`).join(", ");
        case "karma": return `karma <= ${req.karma}`;
        case "numPeopleKilled": return `${req.numPeopleKilled} people killed`;
        case "file": return `file '${req.file}'`;
        case "numAugmentations": return `${req.numAugmentations} augmentations installed`;
        case "employedBy": return `employed at ${req.company}`;
        case "companyReputation": return `${req.reputation} reputation with ${req.company}`;
        case "jobTitle": return `job title '${req.jobTitle}'`;
        case "city": return `located in ${req.city}`;
        case "location": return `located at ${req.location}`;
        case "backdoorInstalled": return `backdoor on ${req.server}`;
        case "hacknetRAM": return `${req.hacknetRAM}GB total Hacknet RAM`;
        case "hacknetCores": return `${req.hacknetCores} total Hacknet cores`;
        case "hacknetLevels": return `${req.hacknetLevels} total Hacknet levels`;
        case "bitNodeN": return `in BitNode ${req.bitNodeN}`;
        case "sourceFile": return `Source-File ${req.sourceFile}`;
        case "bladeburnerRank": return `Bladeburner rank ${req.bladeburnerRank}`;
        case "numInfiltrations": return `${req.numInfiltrations} infiltrations (can't auto-verify)`;
        case "not": return `NOT (${describeRequirement(req.condition)})`;
        case "someCondition": return `(${req.conditions.map(describeRequirement).join(" OR ")})`;
        case "everyCondition": return req.conditions.map(describeRequirement).join(", ");
    }
}

/**
 * Recursively attempts to satisfy a requirement with a one-shot, low-risk action (travel, apply to a
 * job, install a backdoor). Leaves anything that needs sustained grinding (money, rep, skills, karma) or
 * an irreversible/disruptive action (quitting a job to satisfy a "not employed by X") unattempted -
 * those are reported instead. Returns true once the requirement reads as satisfied.
 */
export async function tryAutoSatisfy(ns: NS, req: PlayerRequirement): Promise<boolean> {
    if (isSatisfied(ns, req)) return true;

    switch (req.type) {
        case "city":
            ns.singularity.travelToCity(req.city);
            return isSatisfied(ns, req);
        case "employedBy":
            for (const field of JOB_FIELDS) {
                if (ns.singularity.applyToCompany(req.company, field)) return true;
            }
            return false;
        case "backdoorInstalled":
            // Delegate to the existing network-wide backdoor script instead of re-walking the network here.
            if (!ns.isRunning("Utils/scan-install-backdoor.js", "home")) {
                ns.exec("Utils/scan-install-backdoor.js", "home", 1, -1);
            }
            return false;
        case "someCondition":
            for (const sub of req.conditions) {
                if (await tryAutoSatisfy(ns, sub)) return true;
            }
            return false;
        case "everyCondition": {
            let allSatisfied = true;
            for (const sub of req.conditions) {
                if (!(await tryAutoSatisfy(ns, sub))) allSatisfied = false;
            }
            return allSatisfied;
        }
        default:
            // money / skills / karma / companyReputation / numAugmentations / hacknet* / bladeburnerRank /
            // sourceFile / bitNodeN / file / jobTitle / not / numInfiltrations: no safe one-shot action.
            return false;
    }
}
