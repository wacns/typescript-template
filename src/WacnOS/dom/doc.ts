/**
 * The primitives every WacnOS UI automation is built from.
 *
 * TWO RULES GOVERN THIS ENTIRE DIRECTORY:
 *
 * 1. Never write the bare identifiers `document` or `window`. Bitburner's RAM checker is a
 *    static token scan over the script source, and either token costs 25GB. `globalThis["document"]`
 *    is invisible to it and costs nothing. This is why every accessor here goes through doc().
 *
 * 2. Find React's internals by KEY PREFIX, never by positional index. SphyxOS reaches a button's
 *    handler with `elem[Object.keys(elem)[1]]` (src/SphyxOS/util.js:131), relying on __reactFiber$
 *    being key 0 and __reactProps$ being key 1. That ordering is incidental and will eventually
 *    break; matching the prefix is the same cost and survives.
 *
 * Clicking through React's props rather than the DOM matters for a second reason: props.onClick
 * receives whatever we pass it, so `{isTrusted: true}` satisfies the game's own trusted-event
 * checks (Casino/CoinFlip.tsx) and MUI's `disabled` attribute never gets a say.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

type Props = Record<string, any>;

export function doc(): Document {
    return (globalThis as any)["document"] as Document;
}

export function sleep(ms: number): Promise<void> {
    return new Promise<void>((resolve) => (globalThis as any)["setTimeout"](resolve, ms));
}

/** First element matching an XPath expression, or null. */
export function find(xpath: string, root?: Node): HTMLElement | null {
    const d = doc();
    const result = d.evaluate(xpath, root ?? d, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    return (result.singleNodeValue as HTMLElement) ?? null;
}

/** Every element matching an XPath expression. */
export function findAll(xpath: string, root?: Node): HTMLElement[] {
    const d = doc();
    const result = d.evaluate(xpath, root ?? d, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    const out: HTMLElement[] = [];
    for (let i = 0; i < result.snapshotLength; i++) {
        const node = result.snapshotItem(i);
        if (node) out.push(node as HTMLElement);
    }
    return out;
}

export function byAria(label: string): HTMLElement | null {
    return doc().querySelector<HTMLElement>(`[aria-label="${cssEscape(label)}"]`);
}

/**
 * Matches an aria-label by prefix. The BitVerse portals label themselves
 * `BitNode-4: The Singularity` (BitverseRoot.tsx), so we can find the right portal without
 * hardcoding every BitNode's display name.
 */
export function byAriaPrefix(prefix: string): HTMLElement | null {
    return find(`//*[starts-with(@aria-label, ${xpathLiteral(prefix)})]`);
}

/** An element of the given tag whose trimmed text is exactly `text`. */
export function byExactText(tag: string, text: string): HTMLElement | null {
    return find(`//${tag}[normalize-space(text())=${xpathLiteral(text)}]`);
}

/** A button whose text contains `text` - the loose match, for labels that include counts or prices. */
export function buttonContaining(text: string): HTMLElement | null {
    return find(`//button[contains(., ${xpathLiteral(text)})]`);
}

/** React's props bag for an element, located by the __reactProps$<hash> key prefix. */
export function reactProps(el: Element | null): Props | null {
    if (!el) return null;
    const key = Object.keys(el).find((k) => k.startsWith("__reactProps$"));
    return key ? ((el as any)[key] as Props) : null;
}

/** Fallback path to props via the fiber node, for elements React didn't attach a props key to. */
export function reactFiberProps(el: Element | null): Props | null {
    if (!el) return null;
    const key = Object.keys(el).find((k) => k.startsWith("__reactFiber$"));
    if (!key) return null;
    const fiber = (el as any)[key];
    return (fiber?.memoizedProps as Props) ?? (fiber?.pendingProps as Props) ?? null;
}

/**
 * Clicks an element the way the game itself would see a real click: React props first, then the
 * fiber's props, then a genuine DOM click as a last resort. Returns false if nothing was callable.
 */
export function click(el: Element | null): boolean {
    if (!el) return false;
    const event = {
        isTrusted: true,
        preventDefault: () => undefined,
        stopPropagation: () => undefined,
        target: el,
        currentTarget: el,
    };

    const props = reactProps(el) ?? reactFiberProps(el);
    if (props && typeof props.onClick === "function") {
        props.onClick(event);
        return true;
    }
    if (typeof (el as HTMLElement).click === "function") {
        (el as HTMLElement).click();
        return true;
    }
    return false;
}

/**
 * Sets a controlled input's value. React ignores direct .value assignment on controlled inputs,
 * so the change has to be delivered to the component's own onChange handler.
 */
export function setValue(el: Element | null, value: string | number): boolean {
    if (!el) return false;
    const props = reactProps(el) ?? reactFiberProps(el);
    if (props && typeof props.onChange === "function") {
        props.onChange({target: {value: String(value)}, isTrusted: true, preventDefault: () => undefined});
        return true;
    }
    // Uncontrolled fallback.
    (el as HTMLInputElement).value = String(value);
    return true;
}

export function pressEnter(el: Element | null): boolean {
    if (!el) return false;
    const props = reactProps(el) ?? reactFiberProps(el);
    if (props && typeof props.onKeyDown === "function") {
        props.onKeyDown({key: "Enter", isTrusted: true, preventDefault: () => undefined});
        return true;
    }
    return false;
}

/** Polls `fn` until it returns something truthy, or the timeout expires. Returns null on timeout. */
export async function waitFor<T>(fn: () => T | null | undefined, timeoutMs = 2500, stepMs = 100): Promise<T | null> {
    const deadline = Date.now() + timeoutMs;
    for (; ;) {
        const value = fn();
        if (value) return value;
        if (Date.now() >= deadline) return null;
        await sleep(stepMs);
    }
}

/** Wraps a string as an XPath literal, handling embedded quotes via concat(). */
export function xpathLiteral(text: string): string {
    if (!text.includes("'")) return `'${text}'`;
    if (!text.includes('"')) return `"${text}"`;
    return `concat('${text.split("'").join("', \"'\", '")}')`;
}

function cssEscape(value: string): string {
    return value.replace(/["\\]/g, "\\$&");
}
