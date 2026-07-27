import {NS} from "@ns";

/**
 * Config lives as a JSON file, canonically on home - same durability trick as SphyxOS's own
 * loader config file: load pulls the copy from home onto wherever this is currently running,
 * save writes locally then pushes back to home, so it survives even if the Loader is ever
 * exec'd on a remote server.
 */
const CONFIG_FILE = "WacnOS/config.txt";

export const DEFAULT_OPEN_CATEGORIES = ["hackloop", "loader"];

export interface WacnOSConfig {
    hackLoopMoneyMode: boolean;
    hackLoopPurchaseServers: boolean;
    autoStartHackLoop: boolean;
    /** Ids of menu categories currently expanded in WLoader.tsx - the "layout" SphyxOS itself persists per-menu. */
    openCategories: string[];
}

const DEFAULT_CONFIG: WacnOSConfig = {
    hackLoopMoneyMode: true,
    hackLoopPurchaseServers: false,
    autoStartHackLoop: true,
    openCategories: [...DEFAULT_OPEN_CATEGORIES],
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
