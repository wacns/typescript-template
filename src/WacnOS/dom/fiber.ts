/**
 * React fiber traversal - the last-resort escape hatch.
 *
 * Ported from SphyxOS's autoInfil.js (findReactRoot/deepFind, ~line 452), which uses it to reach
 * an infiltration minigame's onSuccess callback. Everything in WacnOS/dom/actions.ts prefers a
 * real selector; this exists for when a control has no stable selector at all, or when the game's
 * markup changes and the only thing still recognizable is the shape of a component's props.
 *
 * Costs nothing in RAM (no `document` token - see doc.ts) but it is a deep walk over the whole
 * render tree, so keep maxDepth small and never call it in a tight loop.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import {doc} from "WacnOS/dom/doc";

export interface FiberHit<T = any> {
    val: T;
    depth: number;
}

/** The root fiber node of the game's React tree, found via the container/fiber keys React stamps on DOM nodes. */
export function findReactRoot(): any | null {
    const all = doc().querySelectorAll("*");
    for (const el of Array.from(all)) {
        for (const key of Object.keys(el)) {
            if (key.startsWith("__reactContainer$")) return (el as any)[key]?.stateNode?.current ?? null;
            if (key.startsWith("__reactFiber$")) return (el as any)[key];
        }
    }
    return null;
}

/**
 * Every state bag hanging off one fiber: its props, and each entry in the linked list of hook
 * states (plus any ref's .current). The guard bounds a hook chain that's circular or absurdly long.
 */
export function* fiberStates(fiber: any): Generator<any> {
    if (!fiber) return;
    yield fiber.memoizedProps;
    yield fiber.pendingProps;
    if (fiber.stateNode) yield fiber.stateNode.state;

    let hook = fiber.memoizedState;
    let guard = 0;
    while (hook && guard++ < 200) {
        yield hook.memoizedState;
        if (hook.memoizedState && typeof hook.memoizedState === "object") yield hook.memoizedState.current;
        hook = hook.next;
    }
}

/** Depth-first search over the fiber tree for state objects matching `predicate`. */
export function deepFind(predicate: (value: any) => boolean, rootFiber: any, maxDepth = 4): FiberHit[] {
    const hits: FiberHit[] = [];
    if (!rootFiber) return hits;

    const visit = (fiber: any, depth: number): void => {
        if (!fiber || depth > maxDepth) return;
        for (const state of fiberStates(fiber)) {
            if (state && typeof state === "object") {
                try {
                    if (predicate(state)) hits.push({val: state, depth});
                } catch {
                    // A getter on the state bag threw - not our object, keep walking.
                }
            }
        }
        visit(fiber.child, depth + 1);
        visit(fiber.sibling, depth);
    };

    visit(rootFiber, 0);
    return hits;
}

/** Convenience: the shallowest state object matching `predicate`, or null. */
export function findComponentState<T = any>(predicate: (value: any) => boolean, maxDepth = 6): T | null {
    const hits = deepFind(predicate, findReactRoot(), maxDepth);
    if (hits.length === 0) return null;
    hits.sort((a, b) => a.depth - b.depth);
    return hits[0].val as T;
}
