import {NS} from "@ns";
import {buttonContaining, byAria, byAriaPrefix, click, setValue, sleep, waitFor, xpathLiteral} from "WacnOS/dom/doc";
import {find} from "WacnOS/dom/doc";
import {SelectorError} from "WacnOS/dom/guard";
import {deepFind, findReactRoot} from "WacnOS/dom/fiber";
import {dismissModals, goTo} from "WacnOS/dom/nav";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Every action the autopilot performs that has no Netscript equivalent without Source-File 4.
 *
 * All of them share one shape:
 *   1. clear any modal in the way
 *   2. read the precondition - if it's already true, return ok without touching the UI
 *   3. navigate, wait for the control, click it
 *   4. handle whatever confirmation or acknowledgement dialog the game raises
 *   5. VERIFY by re-reading state, because a click that lands on nothing looks identical to a
 *      click that worked
 *
 * Step 2 makes every action idempotent, which is what lets the daemon re-derive its decision from
 * scratch each tick and simply re-issue whatever the current phase calls for.
 *
 * A note on clicking: dom/doc.ts's click() invokes React's own onClick with a synthetic
 * {isTrusted: true}. That is not a nicety - Faction "Join!" (FactionsRoot.tsx:89) and every casino
 * button (Casino/utils.ts trusted()) test event.isTrusted and return silently when it's false, and
 * a real DOM .click() always produces false. The props path is the only one that works.
 */

export interface ActionResult {
    ok: boolean;
    reason?: string;
}

const OK: ActionResult = {ok: true};

function fail(reason: string): ActionResult {
    return {ok: false, reason};
}

/**
 * The tech vendor in each city - TOR, home RAM and home cores are all sold from this one page
 * (Locations/ui/TechVendorLocation.tsx). Chongqing and New Tokyo have no tech vendor, which is
 * fine: the BN1 ladder only ever travels to Ishima, Sector-12 and Aevum.
 */
const TECH_VENDORS: Record<string, string> = {
    "Sector-12": "Alpha Enterprises",
    Aevum: "NetLink Technologies",
    Ishima: "Storm Technologies",
    Volhaven: "CompuTek",
};

export function techVendorFor(city: string): string | null {
    return TECH_VENDORS[city] ?? null;
}

/**
 * Whether we've joined a faction. ns.getPlayer().factions is typed as FactionName[], but every
 * faction name in this project travels as a plain string (they come from the bridge and from
 * autopilot/phases.ts), so the comparison is widened here once instead of casting at each call.
 */
export function isMemberOf(ns: NS, faction: string): boolean {
    return (ns.getPlayer().factions as string[]).includes(faction);
}

/** Opens a location on the City page. Handles both the ASCII map and the plain-list rendering. */
export async function openLocation(ns: NS, location: string, version: string): Promise<ActionResult> {
    await dismissModals();
    await goTo("City", version);

    // ASCII mode gives each location an aria-label; list mode renders a plain button.
    const target = await waitFor(() => byAria(location) ?? buttonContaining(location), 2000, 100);
    if (!target) throw new SelectorError(`location "${location}"`, "openLocation");

    if (!click(target)) return fail(`could not click location "${location}"`);
    await sleep(150);
    return OK;
}

/**
 * Travels to another city.
 *
 * The default (ASCII) world map is not selectable in any reasonable way: each city is a bare
 * <span> containing only its first letter, with no aria-label, and the full name lives in a lazy
 * Tooltip (ui/React/WorldMap.tsx:28-40). So the primary path drives the React component directly -
 * find the fiber whose props are {city, currentCity, onTravel} for our target and invoke its own
 * callback. The list-mode button is the fallback.
 */
export async function travelTo(ns: NS, city: string, version: string): Promise<ActionResult> {
    if (ns.getPlayer().city === city) return OK;

    await dismissModals();
    await goTo("Travel", version);

    let started = false;

    const hits = deepFind(
        (v) => typeof v.onTravel === "function" && v.city === city && v.city !== v.currentCity,
        findReactRoot(),
        8,
    );
    if (hits.length > 0) {
        try {
            hits[0].val.onTravel(city);
            started = true;
        } catch {
            // Fall through to the button path.
        }
    }

    if (!started) {
        const button = buttonContaining(`Travel to ${city}`);
        if (button && click(button)) started = true;
    }

    if (!started) throw new SelectorError(`travel target "${city}"`, "travelTo");

    // Unless SuppressTravelConfirmation is set, a modal asks to confirm (TravelConfirmationModal).
    const confirm = await waitFor(() => find(`//button[contains(., 'Travel') and not(contains(., 'Travel to'))]`), 900, 80);
    if (confirm) click(confirm);

    // ...and on arrival an alert announces the new city. It has no button, only the close icon.
    const arrived = await waitFor(() => (ns.getPlayer().city === city ? true : null), 2500, 100);
    await dismissModals();

    if (!arrived) return fail(`travel to ${city} did not take effect`);
    return OK;
}

/**
 * Buys the TOR router ($200k), which is the gate on the terminal `buy` command and therefore on
 * every darkweb program. There is no terminal command for this and no Netscript call without SF4 -
 * it is a button on the tech vendor page, so it must be clicked once per augmentation install.
 */
export async function buyTor(ns: NS, version: string): Promise<ActionResult> {
    if (ns.hasTorRouter()) return OK;
    if (ns.getPlayer().money < 200e3) return fail("cannot afford the TOR router");

    const vendor = techVendorFor(ns.getPlayer().city);
    if (!vendor) return fail(`no tech vendor in ${ns.getPlayer().city}`);

    const opened = await openLocation(ns, vendor, version);
    if (!opened.ok) return opened;

    const button = await waitFor(() => buttonContaining("Purchase TOR router"), 2000, 100);
    if (!button) throw new SelectorError("Purchase TOR router button", "buyTor");
    click(button);

    const bought = await waitFor(() => (ns.hasTorRouter() ? true : null), 2000, 100);
    await dismissModals(); // "You have purchased a TOR router!"

    return bought ? OK : fail("TOR purchase did not register");
}

/** Doubles home RAM from the tech vendor page. Returns ok only if maxRam actually changed. */
export async function buyHomeRam(ns: NS, version: string): Promise<ActionResult> {
    const before = ns.getServerMaxRam("home");

    const vendor = techVendorFor(ns.getPlayer().city);
    if (!vendor) return fail(`no tech vendor in ${ns.getPlayer().city}`);

    const opened = await openLocation(ns, vendor, version);
    if (!opened.ok) return opened;

    const button = await waitFor(() => buttonContaining("Upgrade 'home' RAM"), 2000, 100);
    if (!button) throw new SelectorError("Upgrade 'home' RAM button", "buyHomeRam");
    click(button);

    const upgraded = await waitFor(() => (ns.getServerMaxRam("home") > before ? true : null), 2000, 100);
    await dismissModals();

    return upgraded ? OK : fail("home RAM upgrade did not register (unaffordable or at max)");
}

/** Buys a home core. Same page and shape as buyHomeRam; cores help grow/weaken thread strength. */
export async function buyHomeCores(ns: NS, version: string): Promise<ActionResult> {
    const vendor = techVendorFor(ns.getPlayer().city);
    if (!vendor) return fail(`no tech vendor in ${ns.getPlayer().city}`);

    const opened = await openLocation(ns, vendor, version);
    if (!opened.ok) return opened;

    const button = await waitFor(() => buttonContaining("Upgrade 'home' cores"), 2000, 100);
    if (!button) throw new SelectorError("Upgrade 'home' cores button", "buyHomeCores");
    click(button);

    await sleep(250);
    await dismissModals();
    return OK;
}

/**
 * Accepts a pending faction invitation.
 *
 * REFUSES anything outside the allowlist. Joining a faction permanently bans every enemy it
 * declares (FactionHelpers.tsx:45-47), and the four city factions each list Sector-12 and Aevum as
 * enemies - so one wrong accept costs two ladder factions and can put Daedalus's 30-augmentation
 * gate out of reach for the whole run. The check lives here, at the point of action, rather than
 * only in the caller, because this is the irreversible step.
 *
 * The Join! button tests event.isTrusted (FactionsRoot.tsx:89), so this only works through the
 * React props path in click() - a DOM .click() would fail silently.
 */
export async function acceptInvite(
    ns: NS,
    faction: string,
    allowlist: ReadonlySet<string>,
    version: string,
): Promise<ActionResult> {
    if (!allowlist.has(faction)) {
        return fail(`refusing to join "${faction}" - not on the allowlist (joining it would ban its enemies)`);
    }
    if (isMemberOf(ns, faction)) return OK;

    await dismissModals();
    await goTo("Factions", version);

    const row = await waitFor(() => factionRow(faction), 2000, 100);
    if (!row) throw new SelectorError(`faction row "${faction}"`, "acceptInvite");

    const join = find(".//button[normalize-space(text())='Join!']", row);
    if (!join) return fail(`no pending invitation for "${faction}"`);
    click(join);

    const joined = await waitFor(() => (isMemberOf(ns, faction) ? true : null), 2000, 100);
    await dismissModals();

    return joined ? OK : fail(`joining "${faction}" did not register`);
}

/** The work types a faction can offer (FactionRoot.tsx renders one Option button per type). */
export type FactionWorkType = "hacking" | "field" | "security";

const WORK_BUTTONS: Record<FactionWorkType, string> = {
    hacking: "Hacking Contracts",
    field: "Field Work",
    security: "Security Work",
};

/**
 * Starts working for a faction - the only way to earn reputation without Singularity, and
 * therefore the only route to The Red Pill's 2.5m Daedalus reputation.
 *
 * Verification is deliberately two-tier. The bridge knows what work is running, but if it's
 * unavailable we fall back to sampling reputation twice and requiring it to rise, because
 * "the button was clicked" is not evidence that work started.
 */
export async function startFactionWork(
    ns: NS,
    faction: string,
    type: FactionWorkType,
    version: string,
    isWorkingFor?: (faction: string) => boolean,
    repOf?: (faction: string) => number | null,
): Promise<ActionResult> {
    if (isWorkingFor?.(faction)) return OK;
    if (!isMemberOf(ns, faction)) return fail(`not a member of "${faction}"`);

    const opened = await openFaction(ns, faction, version);
    if (!opened.ok) return opened;

    const label = WORK_BUTTONS[type];
    const button = await waitFor(() => find(`//button[normalize-space(text())=${xpathLiteral(label)}]`), 2000, 100);
    if (!button) return fail(`"${faction}" does not offer ${label}`);
    click(button);

    await sleep(400);

    if (isWorkingFor) {
        const started = await waitFor(() => (isWorkingFor(faction) ? true : null), 2000, 100);
        return started ? OK : fail(`work for "${faction}" did not start`);
    }

    if (repOf) {
        const before = repOf(faction);
        await sleep(1500);
        const after = repOf(faction);
        if (before !== null && after !== null && after > before) return OK;
        return fail(`reputation for "${faction}" is not rising`);
    }

    return OK;
}

/**
 * Stops whatever work is running. Every work type labels its own button differently
 * ("Stop Faction work", "Stop training at gym", ...) so this matches the shared prefix
 * (WorkInProgressRoot.tsx:245-468).
 */
export async function stopWork(): Promise<ActionResult> {
    await dismissModals();
    const button = find("//button[starts-with(normalize-space(text()), 'Stop ')]");
    if (!button) return OK; // nothing running
    click(button);
    await sleep(200);
    return OK;
}

/**
 * Opens a faction's augmentation shop (the "Augments" button on its Factions-page row).
 */
export async function openFactionAugs(ns: NS, faction: string, version: string): Promise<ActionResult> {
    await dismissModals();
    await goTo("Factions", version);

    const row = await waitFor(() => factionRow(faction), 2000, 100);
    if (!row) throw new SelectorError(`faction row "${faction}"`, "openFactionAugs");

    const button = find(".//button[normalize-space(text())='Augments']", row);
    if (!button || !click(button)) throw new SelectorError(`Augments button for "${faction}"`, "openFactionAugs");

    await waitFor(() => find("//input[@placeholder='Filter augmentations']"), 2000, 100);
    return OK;
}

/**
 * Buys one augmentation from a faction.
 *
 * The shop can list dozens of augmentations, so rather than scanning rows this types the name into
 * the page's own filter box (AugmentationsPage.tsx:225) to narrow the list, then clicks the single
 * remaining Buy button. That turns a fragile row-matching problem into an exact one.
 *
 * Names are matched by PREFIX because NeuroFlux renders as "NeuroFlux Governor - Level 12"
 * (PurchasableAugmentations.tsx:229), so an exact-text match would never find it.
 */
export async function buyAugmentation(
    ns: NS,
    faction: string,
    aug: string,
    version: string,
    queuedCount: (aug: string) => number,
): Promise<ActionResult> {
    // A COUNT, not a boolean: NeuroFlux can be queued repeatedly, so detecting a second level
    // needs the number to rise, not merely to become non-zero.
    if (aug !== "NeuroFlux Governor" && queuedCount(aug) > 0) return OK;

    const opened = await openFactionAugs(ns, faction, version);
    if (!opened.ok) return opened;

    const filter = find("//input[@placeholder='Filter augmentations']");
    if (!filter) throw new SelectorError("augmentation filter box", "buyAugmentation");
    setValue(filter, aug);
    await sleep(250);

    const row = await waitFor(() => augRow(aug), 2000, 100);
    if (!row) return fail(`"${aug}" not listed for ${faction} after filtering`);

    const buy = find(".//button[normalize-space(text())='Buy']", row);
    if (!buy) return fail(`"${aug}" has no Buy button (unaffordable, or reputation too low)`);

    const queuedBefore = queuedCount(aug);
    click(buy);

    // Unless SuppressBuyAugmentationConfirmation is set, a modal asks to confirm.
    const confirm = await waitFor(() => buttonContaining("Purchase"), 900, 80);
    if (confirm) click(confirm);

    const bought = await waitFor(() => (queuedCount(aug) > queuedBefore ? true : null), 2000, 100);
    await dismissModals(); // "You purchased X"

    return bought ? OK : fail(`purchase of "${aug}" did not register`);
}

/**
 * Finds an augmentation's row in the shop by matching the visible name by prefix, then walking up
 * to the Paper that also holds its Buy button.
 */
export function augRow(aug: string): HTMLElement | null {
    const label = find(`//*[starts-with(normalize-space(text()), ${xpathLiteral(aug)})]`);
    let node: HTMLElement | null = label;
    for (let up = 0; up < 8 && node; up++) {
        if (node.querySelector("button")) return node;
        node = node.parentElement;
    }
    return null;
}

/**
 * Installs queued augmentations. THIS PRESTIGES THE GAME - every script is killed and the autopilot
 * dies with it, so the caller must write its resume marker and arm the relaunch timer BEFORE
 * calling this. Nothing after the click in this function is guaranteed to run.
 */
export async function commitInstall(ns: NS, version: string): Promise<ActionResult> {
    await dismissModals();
    await goTo("Augmentations", version);

    const button = await waitFor(() => buttonContaining("Install Augmentations"), 2000, 100);
    if (!button) throw new SelectorError("Install Augmentations button", "commitInstall");
    click(button);

    const confirm = await waitFor(() => buttonContaining("Confirm"), 1200, 80);
    if (confirm) click(confirm);

    await sleep(1000);
    return OK;
}

/**
 * Takes a BitVerse portal. THIS ENDS THE BITNODE - like commitInstall, the caller must
 * have written its resume marker and armed the relaunch timer first.
 *
 * Both render modes are handled. With ASCII art on (the default) each portal is an IconButton
 * carrying aria-label="BitNode-4: The Singularity"; with DisableASCIIArt it becomes a plain
 * button whose text says the same thing but which has NO aria-label (BitverseRoot.tsx:92-105).
 * The confirmation button is stable across both: aria-label="enter-bitnode-4".
 *
 * `dryRun` opens the portal modal and reports what it found WITHOUT confirming - the only safe way
 * to verify these selectors, since the real thing is irreversible.
 */
export async function clickBitVersePortal(
    ns: NS,
    bitNode: number,
    version: string,
    dryRun = false,
): Promise<ActionResult> {
    await dismissModals();

    const portal = await waitFor(
        () => byAriaPrefix(`BitNode-${bitNode}:`) ?? buttonContaining(`BitNode-${bitNode}:`),
        3000,
        150,
    );
    if (!portal) throw new SelectorError(`BitNode-${bitNode} portal`, "clickBitVersePortal");
    click(portal);

    const confirm = await waitFor(() => byAria(`enter-bitnode-${bitNode}`), 2500, 100);
    if (!confirm) throw new SelectorError(`enter-bitnode-${bitNode} button`, "clickBitVersePortal");

    if (dryRun) {
        const label = confirm.getAttribute("aria-label") ?? "";
        const text = (confirm.textContent ?? "").trim();
        await dismissModals();
        return {ok: true, reason: `dry run: found [aria-label="${label}"] reading "${text}" (not clicked)`};
    }

    click(confirm);
    await sleep(1500);
    return OK;
}

/** Opens a faction's own page from the Factions list (the "Details" button on its row). */
export async function openFaction(ns: NS, faction: string, version: string): Promise<ActionResult> {
    await dismissModals();
    await goTo("Factions", version);

    const row = await waitFor(() => factionRow(faction), 2000, 100);
    if (!row) throw new SelectorError(`faction row "${faction}"`, "openFaction");

    const button = find(".//button[normalize-space(text())='Details']", row);
    if (!button || !click(button)) throw new SelectorError(`Details button for "${faction}"`, "openFaction");

    await sleep(150);
    return OK;
}

/**
 * The <Paper> row for one faction on the Factions page. Located by finding the span holding the
 * faction's name and walking up to the row that also contains its buttons (FactionsRoot.tsx:95).
 */
export function factionRow(faction: string): HTMLElement | null {
    const label = find(`//span[normalize-space(text())=${xpathLiteral(faction)}]`);
    let node: HTMLElement | null = label;
    for (let up = 0; up < 8 && node; up++) {
        if (node.querySelector("button")) return node;
        node = node.parentElement;
    }
    return null;
}
