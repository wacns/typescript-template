import {NS} from "@ns";
import React from "lib/react";
import {WacnPorts} from "WacnOS/ports";
import {DEFAULT_OPEN_CATEGORIES, loadConfig, saveConfig, WacnOSConfig} from "WacnOS/config";
import {HackLoopStatus, readHackLoopStatus} from "WacnOS/status";
import {WACNOS_CSS} from "WacnOS/ui/style";
import {CategoryRow, MeterBar, Row, TelemetryRow, Toggle} from "WacnOS/ui/controls";

const HACKLOOP_SCRIPT = "WacnOS/launcher/hackloop.js";

/**
 * WacnOS's branded entrypoint - a fresh TS/TSX port of SphyxOS's LoaderSphyxOS.jsx structure:
 * persistent JSON config, a categorized React tail menu (WacnOS's own take on SphyxOS's
 * rows.push([...]) system, restyled as a console/terminal panel with a live telemetry readout),
 * and RAM-aware auto-start of the hacking loop.
 */
export async function main(ns: NS): Promise<void> {
    ns.disableLog("ALL");
    const config = loadConfig(ns);

    ns.clearPort(WacnPorts.LOADER_PID);
    ns.writePort(WacnPorts.LOADER_PID, ns.pid);
    ns.atExit(() => {
        saveConfig(ns, config);
        ns.clearPort(WacnPorts.LOADER_PID);
    });

    if (config.autoStartHackLoop && ns.peek(WacnPorts.HACKLOOP_PID) === "NULL PORT DATA") {
        startHackLoop(ns, config);
    }

    ns.ui.openTail();
    ns.ui.setTailTitle("WacnOS Loader");
    ns.ui.resizeTail(420, 470);
    ns.printRaw(<LoaderApp ns={ns} initialConfig={config}/>);

    await new Promise<void>(() => { /* keep the tail alive forever */
    });
}

function startHackLoop(ns: NS, config: WacnOSConfig): boolean {
    const ramNeeded = ns.getScriptRam(HACKLOOP_SCRIPT);
    const ramFree = ns.getServerMaxRam("home") - ns.getServerUsedRam("home");
    if (ramNeeded <= 0 || ramFree < ramNeeded) {
        ns.toast(`WacnOS: not enough home RAM to start the hacking loop (needs ${ramNeeded.toFixed(2)}GB).`, "error");
        return false;
    }
    const args = config.hackLoopPurchaseServers ? ["purchase"] : [];
    return ns.exec(HACKLOOP_SCRIPT, "home", 1, ...args) > 0;
}

function stopHackLoop(ns: NS): void {
    const pid = Number(ns.peek(WacnPorts.HACKLOOP_PID));
    if (Number.isFinite(pid) && pid > 0) ns.kill(pid);
}

/**
 * Kills every running instance of the hacking loop on home, not just the one pid tracked on the
 * port - ns.kill(filename, host) only matches processes launched with the exact same args, so a
 * stray/duplicate instance started with different args wouldn't be caught by that alone.
 */
function stopAllBots(ns: NS): void {
    let killed = 0;
    for (const proc of ns.ps("home")) {
        if (proc.filename === HACKLOOP_SCRIPT && ns.kill(proc.pid)) killed++;
    }
    ns.clearPort(WacnPorts.HACKLOOP_PID);
    ns.toast(killed > 0 ? `WacnOS: stopped ${killed} bot process(es).` : "WacnOS: no bots were running.", killed > 0 ? "success" : "info");
}

function sendCommand(ns: NS, cmd: string): void {
    if (ns.peek(WacnPorts.HACKLOOP_PID) !== "NULL PORT DATA") ns.writePort(WacnPorts.HACKLOOP_CMD, cmd);
}

interface LoaderAppProps {
    ns: NS;
    initialConfig: WacnOSConfig;
}

function LoaderApp({ns, initialConfig}: LoaderAppProps) {
    const theme = ns.ui.getTheme();
    const [config, setConfig] = React.useState<WacnOSConfig>(initialConfig);
    const [running, setRunning] = React.useState(ns.peek(WacnPorts.HACKLOOP_PID) !== "NULL PORT DATA");
    const [status, setStatus] = React.useState<HackLoopStatus | null>(readHackLoopStatus(ns));

    React.useEffect(() => {
        const timer = setInterval(() => {
            setRunning(ns.peek(WacnPorts.HACKLOOP_PID) !== "NULL PORT DATA");
            setStatus(readHackLoopStatus(ns));
        }, 500);
        return () => clearInterval(timer);
    }, []);

    React.useEffect(() => {
        saveConfig(ns, config);
    }, [config]);

    const update = (patch: Partial<WacnOSConfig>) => setConfig((current) => ({...current, ...patch}));
    const toggle = (patch: Partial<WacnOSConfig>, cmd: string) => {
        update(patch);
        sendCommand(ns, cmd);
    };

    const isOpen = (id: string) => config.openCategories.includes(id);
    const toggleCategory = (id: string) => update({
        openCategories: isOpen(id) ? config.openCategories.filter((c) => c !== id) : [...config.openCategories, id],
    });
    const resetLayout = () => update({openCategories: [...DEFAULT_OPEN_CATEGORIES]});

    const line = theme.well;
    const statusColor = running ? theme.success : theme.error;
    const securityPercent = status ? Math.max(0, 100 - (status.securityCur - status.securityMin) * 5) : 0;
    const moneyPercent = status && status.moneyMax > 0 ? (status.moneyCur / status.moneyMax) * 100 : 0;

    return (
        <div className="wacnos-panel" style={{background: theme.backgroundprimary, color: theme.primary, border: `1px solid ${line}`}}>
            <style>{WACNOS_CSS}</style>

            <div className="wacnos-titlebar" style={{borderBottomColor: line}}>
                <div>
                    <span className="wacnos-brand">WACNOS<span className="wacnos-version">v1</span></span>
                    <span className="wacnos-tagline">automation suite</span>
                </div>
                <span className="wacnos-status" style={{color: statusColor}}>
                    [{running ? "RUNNING" : "STOPPED"}]{running && <span className="wacnos-caret" style={{background: statusColor}}/>}
                </span>
            </div>

            <div className="wacnos-telemetry" style={{background: theme.backgroundsecondary, borderColor: line}}>
                {status ? (
                    <>
                        <TelemetryRow label="target" value={status.target} valueColor={theme.hack}/>
                        <TelemetryRow label="security" value={`${status.securityCur.toFixed(1)} / ${status.securityMin.toFixed(1)}`}/>
                        <MeterBar percent={securityPercent} color={theme.hack} track={line}/>
                        <TelemetryRow label="money" value={`${ns.format.number(status.moneyCur)} / ${ns.format.number(status.moneyMax)}`}/>
                        <MeterBar percent={moneyPercent} color={theme.money} track={line}/>
                        <TelemetryRow label="threads" value={status.threads}/>
                        <TelemetryRow label="phase" value={status.phase}/>
                    </>
                ) : (
                    <div className="wacnos-telemetry-empty">no active session</div>
                )}
            </div>

            <CategoryRow title="Hacking Loop" open={isOpen("hackloop")} line={line} onToggle={() => toggleCategory("hackloop")}>
                <Row label="enabled" line={line}>
                    <Toggle on={running} activeColor={theme.success} offColor={theme.disabled}
                            onClick={() => running ? stopHackLoop(ns) : startHackLoop(ns, config)}/>
                </Row>
                <Row label="money mode" line={line}>
                    <Toggle on={config.hackLoopMoneyMode} activeColor={theme.primary} offColor={theme.disabled}
                            onClick={() => toggle({hackLoopMoneyMode: !config.hackLoopMoneyMode}, config.hackLoopMoneyMode ? "xponly" : "money")}/>
                </Row>
                <Row label="auto-purchase servers" line={line}>
                    <Toggle on={config.hackLoopPurchaseServers} activeColor={theme.primary} offColor={theme.disabled}
                            onClick={() => toggle({hackLoopPurchaseServers: !config.hackLoopPurchaseServers}, config.hackLoopPurchaseServers ? "nopurchase" : "purchase")}/>
                </Row>
            </CategoryRow>

            <CategoryRow title="Loader" open={isOpen("loader")} line={line} onToggle={() => toggleCategory("loader")}>
                <Row label="auto-start on load" line={line}>
                    <Toggle on={config.autoStartHackLoop} activeColor={theme.primary} offColor={theme.disabled}
                            onClick={() => update({autoStartHackLoop: !config.autoStartHackLoop})}/>
                </Row>
            </CategoryRow>

            <div className="wacnos-actions" style={{borderTopColor: line}}>
                <button
                    className="wacnos-action primary"
                    style={{color: theme.error}}
                    onClick={() => stopAllBots(ns)}
                >
                    Stop All
                </button>
                <button
                    className="wacnos-action ghost"
                    style={{color: theme.primary, borderColor: line}}
                    onClick={resetLayout}
                >
                    Reset Layout
                </button>
            </div>
        </div>
    );
}
