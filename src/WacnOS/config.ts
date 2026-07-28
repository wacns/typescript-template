import {NS} from "@ns";

/**
 * Config lives as a JSON file, canonically on home - same durability trick as SphyxOS's own
 * loader config file: load pulls the copy from home onto wherever this is currently running,
 * save writes locally then pushes back to home, so it survives even if the Loader is ever
 * exec'd on a remote server.
 */
const CONFIG_FILE = "WacnOS/config.txt";

export const DEFAULT_OPEN_CATEGORIES = ["hackloop", "autopilot", "loader"];

/** Which BitNode progression the autopilot drives. See WacnOS/autopilot/route.ts for the step tables. */
export type RouteId = "bn1-to-bn4" | "bn1-2-3-4" | "farm-bn1-sf13" | "custom";

/**
 * What runs once we land in the next BitNode. "sphyxos" hands off to the vendored SphyxOS
 * autopilot, which only works where Singularity is available (inside BN4, or with SF4 owned).
 */
export type NextNodeDriver = "wacnos" | "sphyxos" | "none";

/** How the Daedalus reputation grind to The Red Pill's 2.5e6 is funded. */
export type RepMode = "grind" | "donate" | "auto";

export interface WacnOSConfig {
    hackLoopMoneyMode: boolean;
    hackLoopPurchaseServers: boolean;
    autoStartHackLoop: boolean;
    /** Ids of menu categories currently expanded in WLoader.tsx - the "layout" SphyxOS itself persists per-menu. */
    openCategories: string[];

    // --- Autopilot ---
    autopilotEnabled: boolean;
    autopilotAutoStart: boolean;
    route: RouteId;
    /** BitNode numbers used when route === "custom". */
    customRoute: number[];
    /** SphyxOS's MOVEON: on finishing a node, take the next portal instead of re-entering this one. */
    moveOnNextNode: boolean;
    nextNodeDriver: NextNodeDriver;
    /** Queue this many distinct augmentations before spending a reset on installing them. */
    augsAtOnce: number;
    /** Money never spent on augmentations, so infrastructure buys can't be starved. */
    reserveMoney: number;
    useCasino: boolean;
    useStocks: boolean;
    useHacknet: boolean;
    /** Deploy ns.share() during the Daedalus grind - a free faction-rep multiplier that needs no SF. */
    useShare: boolean;
    daedalusRepMode: RepMode;
    /** Halt and wait for the user when a UI selector can't be found, instead of retrying next tick. */
    pauseOnSelectorMiss: boolean;
}

const DEFAULT_CONFIG: WacnOSConfig = {
    hackLoopMoneyMode: true,
    hackLoopPurchaseServers: false,
    autoStartHackLoop: true,
    openCategories: [...DEFAULT_OPEN_CATEGORIES],

    autopilotEnabled: false,
    autopilotAutoStart: false,
    route: "bn1-to-bn4",
    customRoute: [],
    moveOnNextNode: true,
    nextNodeDriver: "wacnos",
    augsAtOnce: 11,
    reserveMoney: 1e6,
    useCasino: true,
    useStocks: true,
    useHacknet: true,
    useShare: true,
    daedalusRepMode: "auto",
    pauseOnSelectorMiss: true,
};

export function loadConfig(ns: NS): WacnOSConfig {
    try {
        ns.scp(CONFIG_FILE, ns.getHostname(), "home");
        const raw = ns.read(CONFIG_FILE);
        if (!raw) return {...DEFAULT_CONFIG};
        return {...DEFAULT_CONFIG, ...JSON.parse(raw)};
    } catch {
        return {...DEFAULT_CONFIG};
    }
}

export function saveConfig(ns: NS, config: WacnOSConfig): void {
    ns.write(CONFIG_FILE, JSON.stringify(config), "w");
    ns.scp(CONFIG_FILE, "home");
}
