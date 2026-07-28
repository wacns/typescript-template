import {NS} from "@ns";
import React from "lib/react";
import {WacnPorts} from "WacnOS/ports";
import {DEFAULT_OPEN_CATEGORIES, loadConfig, NextNodeDriver, RepMode, RouteId, saveConfig, WacnOSConfig} from "WacnOS/config";
import {AutopilotStatus, HackLoopStatus, readAutopilotStatus, readHackLoopStatus} from "WacnOS/status";
import {WACNOS_CSS} from "WacnOS/ui/style";
import {Banner, CategoryRow, Cycler, MeterBar, Row, TelemetryRow, Toggle} from "WacnOS/ui/controls";
import {ROUTE_IDS, ROUTE_LABELS} from "WacnOS/autopilot/route";
import {clearMarker, readMarker} from "WacnOS/autopilot/resume";

const HACKLOOP_SCRIPT = "WacnOS/launcher/hackloop.js";
const AUTOPILOT_SCRIPT = "WacnOS/autopilot/daemon.js";
const SPHYXOS_LOADER = "SphyxOS/bins/LoaderSphyxOS.js";

const NEXT_NODE_DRIVERS: NextNodeDriver[] = ["wacnos", "sphyxos", "none"];
const REP_MODES: RepMode[] = ["grind", "donate", "auto"];
const AUGS_AT_ONCE = ["4", "8", "11", "16"] as const;

/**
 * WacnOS's branded entrypoint - a fresh TS/TSX port of SphyxOS's LoaderSphyxOS.jsx structure:
 * persistent JSON config, a categorized React tail menu (WacnOS's own take on SphyxOS's
 * rows.push([...]) system, restyled as a console/terminal panel with a live telemetry readout),
 * and RAM-aware auto-start of the hacking loop.
 *
 * RAM WARNING: Bitburner's cost checker resolves every bare identifier in a script's whole
 * dependency tree against the ns API BY NAME, ignoring namespaces (Script/RamCalculations.ts
 * findFunc). Naming a local function `workForFaction` or `installAugmentations` silently bills it
 * 48GB or 80GB even though ns.singularity is never touched, and the identifiers `window` and
 * `document` cost 25GB each. Before adding anything here, check `mem WacnOS/WLoader.js` in game.
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

    // `run WacnOS/WLoader.js autopilot` is how the autopilot gets going again after an
    // augmentation install or a BitNode entry - without SF4 there's no installAugmentations
    // callback script, so autopilot/resume.ts arms a browser timer that types exactly that.
    resumeAfterRestart(ns, config);

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

/**
 * Decides what drives the game after a restart, and starts it.
 *
 * Two things can bring us here: the relaunch timer armed before an augmentation install or a
 * BitVerse portal (passing the "autopilot" arg), or an ordinary manual launch that finds a resume
 * marker left behind because the timer never fired. Both are treated the same.
 *
 * The handoff is the interesting case. Singularity is available inside BitNode 4 even without
 * owning SF4 (canAccessBitNodeFeature checks bitNodeN === 4), so once we arrive there the vendored
 * SphyxOS autopilot becomes usable and is a far more complete BN4 player than anything we'd
 * rebuild. The port-22 handshake and "autoPilot" argument are copied from SphyxOS's own restart
 * path (LoaderSphyxOS.jsx:82-88) so the handoff looks identical to SphyxOS restarting itself.
 */
function resumeAfterRestart(ns: NS, config: WacnOSConfig): void {
    const marker = readMarker(ns);
    const relaunched = ns.args.includes("autopilot");
    if (marker) clearMarker(ns);

    if (ns.peek(WacnPorts.AUTOPILOT_PID) !== "NULL PORT DATA") return;
    if (!relaunched && !marker && !config.autopilotAutoStart) return;

    const reset = ns.getResetInfo();
    const arrivedInPlannedNode = marker?.bitNode === reset.currentNode;
    const hasSingularity = (reset.ownedSF.get(4) ?? 0) > 0 || reset.currentNode === 4;
    const driver = marker?.handoff ?? config.nextNodeDriver;

    if (arrivedInPlannedNode && driver === "sphyxos" && hasSingularity && ns.fileExists(SPHYXOS_LOADER, "home")) {
        ns.writePort(22, "silent");
        ns.writePort(22, config.moveOnNextNode ? "moveon" : "nomoveon");
        if (ns.exec(SPHYXOS_LOADER, "home", 1, "autoPilot") > 0) {
            ns.toast(`WacnOS: handed BitNode ${reset.currentNode} over to SphyxOS.`, "success");
            return;
        }
        ns.toast("WacnOS: SphyxOS handoff failed, continuing with the WacnOS autopilot.", "warning");
    }

    if (driver === "none" && marker) {
        ns.toast(`WacnOS: arrived in BitNode ${reset.currentNode}; autopilot left stopped as configured.`, "info");
        return;
    }

    if (config.autopilotEnabled || relaunched || marker) startAutopilot(ns);
}

function startAutopilot(ns: NS): boolean {
    const ramNeeded = ns.getScriptRam(AUTOPILOT_SCRIPT);
    const ramFree = ns.getServerMaxRam("home") - ns.getServerUsedRam("home");
    if (ramNeeded <= 0 || ramFree < ramNeeded) {
        ns.toast(`WacnOS: not enough home RAM to start the autopilot (needs ${ramNeeded.toFixed(2)}GB).`, "error");
        return false;
    }
    return ns.exec(AUTOPILOT_SCRIPT, "home", 1) > 0;
}

function stopAutopilot(ns: NS): void {
    const pid = Number(ns.peek(WacnPorts.AUTOPILOT_PID));
    if (Number.isFinite(pid) && pid > 0) ns.kill(pid);
}

function sendAutopilotCommand(ns: NS, cmd: string): void {
    if (ns.peek(WacnPorts.AUTOPILOT_PID) !== "NULL PORT DATA") ns.writePort(WacnPorts.AUTOPILOT_CMD, cmd);
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
    const [autoRunning, setAutoRunning] = React.useState(ns.peek(WacnPorts.AUTOPILOT_PID) !== "NULL PORT DATA");
    const [autoStatus, setAutoStatus] = React.useState<AutopilotStatus | null>(readAutopilotStatus(ns));

    React.useEffect(() => {
        const timer = setInterval(() => {
            setRunning(ns.peek(WacnPorts.HACKLOOP_PID) !== "NULL PORT DATA");
            setStatus(readHackLoopStatus(ns));
            setAutoRunning(ns.peek(WacnPorts.AUTOPILOT_PID) !== "NULL PORT DATA");
            setAutoStatus(readAutopilotStatus(ns));
        }, 500);
        return () => clearInterval(timer);
    }, []);

    React.useEffect(() => {
        saveConfig(ns, config);
        // The daemon holds its own copy of the config, so a settings change here has to be
        // pushed rather than polled - it re-reads the file on "reload".
        sendAutopilotCommand(ns, "reload");
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
    // Handing the next node to SphyxOS is only offerable if SphyxOS is actually installed.
    const sphyxAvailable = ns.fileExists(SPHYXOS_LOADER, "home");
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

            <CategoryRow title="Autopilot" open={isOpen("autopilot")} line={line} onToggle={() => toggleCategory("autopilot")}>
                {autoStatus && (
                    <div className="wacnos-telemetry" style={{background: theme.backgroundsecondary, borderColor: line, marginBottom: 6}}>
                        <TelemetryRow label="phase" value={autoStatus.phase}
                                      valueColor={autoStatus.paused ? theme.error : theme.hack}/>
                        <TelemetryRow label="step" value={`${autoStatus.step}  ${autoStatus.label}`}/>
                        <TelemetryRow label="augs" value={`${autoStatus.ownedAugs} / ${autoStatus.augGoal}`}/>
                        <MeterBar percent={(autoStatus.ownedAugs / Math.max(1, autoStatus.augGoal)) * 100}
                                  color={theme.money} track={line}/>
                        <TelemetryRow label="daedalus"
                                      value={`${ns.format.number(autoStatus.daedalusRep)} / ${ns.format.number(autoStatus.daedalusRepGoal)}`}/>
                        <MeterBar percent={(autoStatus.daedalusRep / Math.max(1, autoStatus.daedalusRepGoal)) * 100}
                                  color={theme.hack} track={line}/>
                        <TelemetryRow label="bitnode" value={`${autoStatus.bitNode} -> ${autoStatus.nextBitNode}`}/>
                        <TelemetryRow label="bridge" value={autoStatus.bridgeOk ? "OK" : "DEGRADED"}
                                      valueColor={autoStatus.bridgeOk ? theme.success : theme.warning}/>
                    </div>
                )}

                {autoStatus?.paused && (
                    <Banner text={autoStatus.pausedReason || "autopilot paused"} color={theme.error}>
                        <button className="wacnos-toggle" style={{color: theme.success}}
                                onClick={() => sendAutopilotCommand(ns, "resume")}>[RESUME]
                        </button>
                        <button className="wacnos-toggle" style={{color: theme.warning}}
                                onClick={() => sendAutopilotCommand(ns, "skip")}>[SKIP]
                        </button>
                    </Banner>
                )}

                <Row label="enabled" line={line}>
                    <Toggle on={autoRunning} activeColor={theme.success} offColor={theme.disabled}
                            onClick={() => {
                                if (autoRunning) stopAutopilot(ns);
                                else if (startAutopilot(ns)) update({autopilotEnabled: true});
                            }}/>
                </Row>
                <Row label="auto-start on load" line={line}>
                    <Toggle on={config.autopilotAutoStart} activeColor={theme.primary} offColor={theme.disabled}
                            onClick={() => update({autopilotAutoStart: !config.autopilotAutoStart})}/>
                </Row>
                <Row label="route" line={line}>
                    <Cycler<RouteId> value={config.route} options={ROUTE_IDS} labels={ROUTE_LABELS}
                                     activeColor={theme.primary} offColor={theme.disabled}
                                     onChange={(route) => update({route})}/>
                </Row>
                <Row label="start on next node" line={line}>
                    <Toggle on={config.moveOnNextNode} activeColor={theme.primary} offColor={theme.disabled}
                            onClick={() => update({moveOnNextNode: !config.moveOnNextNode})}/>
                </Row>
                <Row label="next-node driver" line={line}>
                    <Cycler<NextNodeDriver> value={config.nextNodeDriver} options={NEXT_NODE_DRIVERS}
                                            activeColor={theme.primary} offColor={theme.disabled}
                                            disabled={sphyxAvailable ? [] : ["sphyxos"]}
                                            onChange={(nextNodeDriver) => update({nextNodeDriver})}/>
                </Row>
                <Row label="augs per install" line={line}>
                    <Cycler value={String(config.augsAtOnce) as typeof AUGS_AT_ONCE[number]} options={AUGS_AT_ONCE}
                            activeColor={theme.primary} offColor={theme.disabled}
                            onChange={(v) => update({augsAtOnce: Number(v)})}/>
                </Row>
                <Row label="daedalus rep" line={line}>
                    <Cycler<RepMode> value={config.daedalusRepMode} options={REP_MODES}
                                     activeColor={theme.primary} offColor={theme.disabled}
                                     onChange={(daedalusRepMode) => update({daedalusRepMode})}/>
                </Row>
                <Row label="use casino" line={line}>
                    <Toggle on={config.useCasino} activeColor={theme.money} offColor={theme.disabled}
                            onClick={() => update({useCasino: !config.useCasino})}/>
                </Row>
                <Row label="use stocks" line={line}>
                    <Toggle on={config.useStocks} activeColor={theme.money} offColor={theme.disabled}
                            onClick={() => update({useStocks: !config.useStocks})}/>
                </Row>
                <Row label="use hacknet" line={line}>
                    <Toggle on={config.useHacknet} activeColor={theme.money} offColor={theme.disabled}
                            onClick={() => update({useHacknet: !config.useHacknet})}/>
                </Row>
                <Row label="use share (rep boost)" line={line}>
                    <Toggle on={config.useShare} activeColor={theme.primary} offColor={theme.disabled}
                            onClick={() => update({useShare: !config.useShare})}/>
                </Row>
                <Row label="pause on selector miss" line={line}>
                    <Toggle on={config.pauseOnSelectorMiss} activeColor={theme.primary} offColor={theme.disabled}
                            onClick={() => update({pauseOnSelectorMiss: !config.pauseOnSelectorMiss})}/>
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
