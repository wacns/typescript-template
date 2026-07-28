import {byExactText, buttonContaining, click, doc, find, findAll, reactFiberProps, reactProps, sleep, waitFor, xpathLiteral} from "WacnOS/dom/doc";
import {SelectorError} from "WacnOS/dom/guard";
import {getRouter} from "WacnOS/bridge/webpack";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type PageName =
    | "Terminal"
    | "Stats"
    | "Factions"
    | "Augmentations"
    | "City"
    | "Travel"
    | "Hacknet"
    | "Stock Market"
    | "Active Scripts"
    | "Options";

/**
 * Buttons that are always safe to click to get rid of a dialog.
 *
 * This allowlist is a safety mechanism, not a convenience. A "click whatever button is there"
 * heuristic would eventually click "Join!" on a city-faction invite - and joining Chongqing,
 * New Tokyo, Ishima or Volhaven permanently bans Sector-12 AND Aevum, which would strand the
 * autopilot short of the 30 augmentations Daedalus requires. Leaving an invite pending costs
 * nothing; accepting the wrong one is unrecoverable without a reset.
 *
 * "OK" covers alerts created with canBeDismissedEasily: false (AlertManager.tsx), which render
 * an explicit button; ordinary alerts render none at all and are closed by the CloseIcon below,
 * which ui/React/Modal.tsx renders unconditionally for every modal in the game.
 */
const SAFE_DISMISS_LABELS = ["Decide later", "Cancel", "Close", "OK"];

/** Dismisses any open modal via a known-safe control. Returns how many it closed. */
export async function dismissModals(): Promise<number> {
    let closed = 0;

    // NOTE: not named `attempt` - Bitburner's RAM checker resolves bare identifiers against the
    // whole ns API tree by name, and `attempt` matches codingcontract.attempt for 10GB.
    for (let round = 0; round < 5; round++) {
        const modal = find("//div[contains(@class,'MuiModal-root')]");
        if (!modal) break;

        let acted = false;
        for (const label of SAFE_DISMISS_LABELS) {
            const button = find(`.//button[normalize-space(text())=${xpathLiteral(label)}]`, modal);
            if (button && click(button)) {
                acted = true;
                break;
            }
        }
        if (!acted) {
            const closeIcon = find(".//button[.//*[@data-testid='CloseIcon']]", modal);
            if (closeIcon && click(closeIcon)) acted = true;
        }
        if (!acted) break;

        closed++;
        await waitFor(() => !find("//div[contains(@class,'MuiModal-root')]"), 400, 50);
    }

    return closed;
}

/**
 * Leaves focused work so the terminal can accept input. While focused, the game replaces the
 * normal UI with the work screen and terminal typing goes nowhere - this is the guard SphyxOS
 * opens its own terminal injector with (src/SphyxOS/util.js:136).
 *
 * Matched with contains(.) rather than contains(text()): the label is rendered by a MUI Button,
 * whose text may sit in a nested node rather than as a direct text child, and text() only sees
 * direct children.
 */
const UNFOCUS_BUTTON = "//button[contains(., 'Do something else simultaneously')]";

export async function unfocusWork(): Promise<boolean> {
    const button = find(UNFOCUS_BUTTON);
    if (!button) return false;
    const ok = click(button);
    if (ok) await waitFor(() => !find(UNFOCUS_BUTTON), 600, 50);
    return ok;
}

/**
 * Returns to focused work after an interruption (CharacterOverview.tsx's "Focus" button).
 * Matched on exact text - a contains() match would also hit "Unfocus"-style labels. Unfocused
 * faction work still earns reputation at a penalty, so failing here costs throughput, not
 * correctness.
 */
export async function refocusWork(): Promise<boolean> {
    const button = byExactText("button", "Focus") ?? buttonContaining("Focus");
    return button ? click(button) : false;
}

/**
 * A DOM element unique to each page, used to confirm a navigation actually happened.
 *
 * This replaces asking the Router. `Router` is an `export let` that GameRoot REASSIGNS on every
 * render (ui/GameRoot.tsx:244), and its `page()` closes over that render's `pageWithContext` - so
 * a reference captured once by the bridge reports whichever page was current when it was captured,
 * forever. Its `toPage` stays usable (setState functions are stable across renders), which is why
 * it survives as tier 3 below, but `page()` cannot be trusted as a verdict.
 *
 * Pages without a distinctive marker return null; for those, goTo is best-effort and the caller's
 * own precondition read is what actually confirms the navigation.
 */
function pageMarker(page: PageName): (() => HTMLElement | null) | null {
    switch (page) {
        case "Terminal":
            return () => doc().getElementById("terminal-input");
        case "Factions":
            return () => find("//h4[contains(., 'Factions')]");
        case "Augmentations":
            return () => find("//h4[normalize-space(text())='Augmentations']");
        case "Hacknet":
            return () => find("//h4[starts-with(normalize-space(text()), 'Hacknet')]");
        case "Travel":
            return () => find("//h4[contains(., 'Travel Agency')]");
        case "Stock Market":
            return () => find("//h4[contains(., 'Stock Market')]");
        default:
            // Stats and City render no h4 heading of their own.
            return null;
    }
}

/**
 * Expands any collapsed sidebar category.
 *
 * SidebarAccordion wraps its items in <Collapse unmountOnExit>, so a collapsed category removes
 * its entries from the DOM completely - "Factions" is not merely hidden, it does not exist to
 * query. Collapsed headers show an ExpandMore icon; open ones show ExpandLess.
 */
export async function expandSidebar(): Promise<number> {
    const drawer = doc().querySelector(".MuiDrawer-root");
    if (!drawer) return 0;

    const collapsed = Array.from(drawer.querySelectorAll("svg[data-testid='ExpandMoreIcon']"));
    let opened = 0;
    for (const icon of collapsed) {
        // Walk up to whichever ancestor owns the toggle handler.
        let node: HTMLElement | null = icon.parentElement;
        for (let up = 0; up < 5 && node; up++) {
            const props = reactProps(node) ?? reactFiberProps(node);
            if (props && typeof props.onClick === "function") {
                click(node);
                opened++;
                break;
            }
            node = node.parentElement;
        }
    }
    if (opened > 0) await sleep(250);
    return opened;
}

/**
 * The page the Router last reported. UNRELIABLE for verification - see pageMarker above - and kept
 * only as a diagnostic hint.
 */
export function currentPage(): string | null {
    try {
        const router = (globalThis as any)["__wacnBridge"]?.Router;
        return router ? String(router.page()) : null;
    } catch {
        return null;
    }
}

/**
 * Navigates to a top-level page, trying three independent strategies before giving up.
 *
 * Tier 1 finds the sidebar entry by its visible text and walks up to whichever ancestor actually
 * carries React's onClick - the sidebar nests the label several levels below the clickable row,
 * and that nesting depth is exactly the kind of thing that changes between versions.
 * Tier 2 is SphyxOS's fixed structural selector.
 * Tier 3 asks the game's Router directly, which always works but skips the UI's own transition.
 */
export async function goTo(page: PageName, version: string): Promise<boolean> {
    const marker = pageMarker(page);
    if (marker?.()) return true; // already there

    // Tier 1: sidebar entry -> nearest clickable ancestor.
    //
    // Two things this must get right. The label is a MUI <Typography>, which renders as <p> by
    // default, NOT <span> - so the match has to be element-agnostic. And it must be scoped to the
    // sidebar drawer: an unscoped text match can hit the same word elsewhere on the page, and
    // walking up from there would find some unrelated onClick and click the wrong control.
    const selector = `//div[contains(@class,'MuiDrawer-root')]//*[normalize-space(text())=${xpathLiteral(page)}]`;
    let clicked = false;

    // The entry may exist but be unmounted inside a collapsed category, so open them first.
    if (findAll(selector).length === 0) await expandSidebar();

    for (const label of findAll(selector)) {
        let node: HTMLElement | null = label;
        for (let up = 0; up < 6 && node; up++) {
            const props = reactProps(node) ?? reactFiberProps(node);
            if (props && typeof props.onClick === "function") {
                click(node);
                clicked = true;
                // Stats and City render nothing uniquely identifiable, so a successful click is
                // the best evidence available; their callers verify by reading real state anyway.
                if (!marker) {
                    await sleep(200);
                    return true;
                }
                if (await settled(marker)) return true;
                break;
            }
            node = node.parentElement;
        }
        if (clicked) break;
    }

    // Tier 2: SphyxOS's structural path.
    const items = Array.from(doc().querySelectorAll<HTMLElement>("#root > div > div > div > ul > div > div > div > div"));
    const match = items.find((el) => el.textContent === page);
    if (match) {
        match.click();
        clicked = true;
        if (!marker) {
            await sleep(200);
            return true;
        }
        if (await settled(marker)) return true;
    }

    // Tier 3: the Router. Its toPage still works even on a stale reference, because the setState
    // function it closes over is stable across renders - only page() goes stale.
    //
    // This is not just a fallback for broken markup: several sidebar entries are gated on progress
    // (SidebarRoot.tsx:157 - Factions appears only once you have an invite, a faction, a rumor, an
    // augmentation or knowledge of the BitVerse; Augmentations likewise). On a fresh BitNode the
    // entries genuinely do not exist, and routing directly is the only way in.
    const router = getRouter(version);
    if (router) {
        try {
            router.toPage(page);
            clicked = true;
            if (await settled(marker)) return true;
        } catch {
            // Fall through.
        }
    }

    // Nothing could even be clicked - that's a genuine selector failure worth stopping for.
    if (!clicked) throw new SelectorError(`sidebar entry "${page}"`, "goTo");

    // We clicked but couldn't prove the page changed. For pages with no marker that's expected;
    // the caller's own precondition read is the real check.
    return marker === null;
}

/** Waits for a page's marker to appear. Pages without one are accepted after a short beat. */
async function settled(marker: (() => HTMLElement | null) | null): Promise<boolean> {
    if (!marker) {
        await sleep(200);
        return false; // "unproven", so goTo keeps trying the remaining tiers
    }
    return (await waitFor(marker, 1500, 60)) !== null;
}
