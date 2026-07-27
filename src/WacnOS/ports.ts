/**
 * WacnOS's Netscript port allocation - the control bus every WacnOS script talks over.
 * Deliberately in the 101-199 range so it can never collide with SphyxOS's own 1-30ish
 * port usage (see src/SphyxOS/bins/LoaderSphyxOS.jsx) if both toolkits ever run in the
 * same game session.
 *
 * "PID" ports: the owning script writes its own ns.pid here on startup and clears it on
 * exit, so anyone can check `ns.peek(port) !== "NULL PORT DATA"` to see if it's running.
 * "CMD" ports: other scripts write command strings here for the owner to read via
 * ns.readPort/ns.peek and act on.
 * "STATUS" ports: the owning script overwrites a single JSON snapshot here every cycle - a
 * one-way broadcast (no request/response) any UI can ns.peek() for live telemetry.
 */
export const WacnPorts = {
    /** hackloop.ts writes its own pid here on start, clears it on exit. */
    HACKLOOP_PID: 101,
    /** hackloop.ts reads command strings from here (see launcher/hackloop.ts for the accepted set). */
    HACKLOOP_CMD: 102,
    /** WLoader.tsx writes its own pid here on start, clears it on exit. */
    LOADER_PID: 103,
    /** hackloop.ts overwrites a JSON HackLoopStatus snapshot here every cycle. */
    HACKLOOP_STATUS: 104,
} as const;
