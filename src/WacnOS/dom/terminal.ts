import {doc, pressEnter, setValue, sleep, waitFor} from "WacnOS/dom/doc";
import {SelectorError} from "WacnOS/dom/guard";
import {dismissModals, goTo, unfocusWork} from "WacnOS/dom/nav";

/**
 * Terminal command injection - the autopilot's substitute for a whole slice of Singularity.
 *
 * `connect`, `backdoor`, `buy <program>`, `run` and `home` are all real terminal commands, so
 * anything they can do is available without Source-File 4 as long as we can type into the
 * terminal. That covers server backdooring (and therefore the CyberSec / NiteSec / The Black Hand
 * / BitRunners invites) and the entire darkweb program catalogue.
 *
 * A TypeScript port of SphyxOS's util.js terminal() (line 127), with three changes: selectors are
 * matched by React key prefix instead of positional index, a missing terminal raises a
 * SelectorError rather than silently doing nothing, and modals are cleared first - a leftover
 * dialog swallows the keystrokes and the command vanishes with no error at all.
 */

const TERMINAL_INPUT_ID = "terminal-input";

async function terminalInput(version: string): Promise<HTMLInputElement> {
    await dismissModals();
    await unfocusWork();
    await goTo("Terminal", version);

    const input = await waitFor(() => doc().getElementById(TERMINAL_INPUT_ID), 2000, 60);
    if (!input) throw new SelectorError(`#${TERMINAL_INPUT_ID}`, "terminal");
    return input as HTMLInputElement;
}

/** Types one command into the terminal and presses Enter. */
export async function terminal(text: string, version: string): Promise<void> {
    const input = await terminalInput(version);
    setValue(input, text);
    // A tick between setting the value and submitting: React's onChange is async, and submitting
    // in the same frame can send the previous (empty) value.
    await sleep(0);
    if (!pressEnter(input)) throw new SelectorError(`#${TERMINAL_INPUT_ID} onKeyDown`, "terminal");
}

/**
 * Runs several commands as one submission. Bitburner's terminal accepts ";"-separated commands,
 * which matters for connect chains - each hop must be issued from the previous server, so
 * splitting them across separate submissions would race the UI.
 */
export async function terminalSeq(commands: string[], version: string): Promise<void> {
    if (commands.length === 0) return;
    await terminal(commands.join(";"), version);
}

/** Issues a command, then waits out a known-duration action such as `backdoor`. */
export async function terminalAndWait(text: string, waitMs: number, version: string): Promise<void> {
    await terminal(text, version);
    await sleep(waitMs);
}

/**
 * The connect chain to a server, as terminal commands.
 *
 * Path-finding uses the trick SphyxOS relies on in crawl-Basic.js: ns.scan(host)[0] is always the
 * neighbour toward home, so walking it backwards yields the route without a graph search.
 */
export function connectChain(path: string[]): string[] {
    return ["home", ...path.map((host) => `connect ${host}`)];
}
