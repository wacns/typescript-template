/**
 * Shared CSS for every WacnOS tail UI - injected once via a <style> tag by whichever screen
 * renders first. Deliberately a console/terminal idiom (hairline rules, bracket toggles, a
 * blinking cursor caret) rather than a rounded consumer-app one - this renders inside a hacking
 * game's own terminal-styled tail window, so it should read like an ops console, not a phone app.
 *
 * Every line color is derived from ns.ui.getTheme() (theme.well/backgroundsecondary/disabled),
 * never a hardcoded rgba(255,255,255,...) overlay - a fixed white-alpha line/track would go
 * invisible against a light theme instead of actually adapting the way this is meant to.
 */
export const WACNOS_CSS = `
.wacnos-panel {
    font-family: 'Cascadia Code', 'Fira Code', Consolas, 'SF Mono', monospace;
    font-size: 12px;
    line-height: 1.4;
    border-radius: 4px;
    padding: 14px 16px 15px;
    box-shadow: 0 10px 28px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.04) inset;
}
.wacnos-titlebar {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding-bottom: 10px;
    border-bottom: 1px solid;
    margin-bottom: 10px;
}
.wacnos-brand {
    font-weight: 700;
    font-size: 15px;
    letter-spacing: 2px;
    display: block;
}
.wacnos-tagline {
    display: block;
    font-size: 9px;
    font-weight: 600;
    opacity: 0.4;
    letter-spacing: 1.6px;
    text-transform: uppercase;
    margin-top: 2px;
}
.wacnos-version {
    font-size: 10px;
    opacity: 0.4;
    margin-left: 6px;
    letter-spacing: 0.5px;
    font-weight: 400;
}
.wacnos-status {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.5px;
}
.wacnos-caret {
    display: inline-block;
    width: 6px;
    height: 1em;
    margin-left: 2px;
    vertical-align: text-bottom;
    animation: wacnos-blink 1s steps(1) infinite;
}
@media (prefers-reduced-motion: reduce) {
    .wacnos-caret { animation: none; }
}
@keyframes wacnos-blink {
    50% { opacity: 0; }
}
.wacnos-telemetry {
    border-radius: 3px;
    border: 1px solid;
    padding: 9px 10px;
    margin-bottom: 4px;
}
.wacnos-telemetry-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 2px 0;
}
.wacnos-telemetry-label {
    font-size: 9.5px;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    opacity: 0.5;
}
.wacnos-telemetry-value {
    font-size: 11.5px;
    font-weight: 700;
}
.wacnos-meter {
    height: 3px;
    border-radius: 1px;
    overflow: hidden;
    margin: 3px 0 7px;
}
.wacnos-meter-fill {
    height: 100%;
    transition: width 0.3s ease;
}
.wacnos-telemetry-empty {
    font-size: 10.5px;
    opacity: 0.45;
    text-align: center;
    padding: 6px 0;
    letter-spacing: 0.3px;
}
.wacnos-category {
    border-top: 1px solid;
    padding-top: 6px;
    margin-top: 6px;
}
.wacnos-category-header {
    display: flex;
    align-items: center;
    gap: 7px;
    cursor: pointer;
    padding: 2px 0;
}
.wacnos-category-marker {
    width: 10px;
    opacity: 0.5;
    font-weight: 700;
}
.wacnos-category-label {
    font-size: 10.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    opacity: 0.7;
}
.wacnos-category-header:hover .wacnos-category-label {
    opacity: 1;
}
.wacnos-category-body {
    padding: 2px 0 4px 17px;
}
.wacnos-row {
    display: flex;
    align-items: baseline;
    padding: 3px 0;
}
.wacnos-row-label {
    white-space: nowrap;
}
.wacnos-row-leader {
    flex: 1 1 auto;
    border-bottom: 1px dotted;
    margin: 0 6px;
    transform: translateY(-3px);
    min-width: 12px;
}
.wacnos-toggle {
    font-family: inherit;
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.5px;
    padding: 1px 7px;
    border-radius: 2px;
    border: 1px solid currentColor;
    background: transparent;
    cursor: pointer;
}
.wacnos-toggle:focus-visible,
.wacnos-action:focus-visible {
    outline: 1px solid currentColor;
    outline-offset: 2px;
}
.wacnos-actions {
    display: flex;
    gap: 8px;
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid;
}
.wacnos-action {
    flex: 1 1 0;
    font-family: inherit;
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.6px;
    text-transform: uppercase;
    padding: 6px 0;
    border-radius: 2px;
    cursor: pointer;
    text-align: center;
}
.wacnos-action.primary {
    border: 1px solid currentColor;
}
.wacnos-action.ghost {
    background: transparent;
    border: 1px solid;
    opacity: 0.6;
}
.wacnos-action.ghost:hover {
    opacity: 1;
}
`;
