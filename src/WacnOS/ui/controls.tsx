import React from "lib/react";

/** A bracket-style on/off control, e.g. "[ON]" / "[OFF]" - a console idiom, not a phone-app switch. */
export function Toggle({on, activeColor, offColor, onClick}: { on: boolean; activeColor: string; offColor: string; onClick: () => void }) {
    return (
        <button
            className="wacnos-toggle"
            style={{color: on ? activeColor : offColor}}
            onClick={onClick}
        >
            [{on ? "ON" : "OFF"}]
        </button>
    );
}

/**
 * A multi-value counterpart to Toggle, rendered as "< value >" - clicking advances to the next
 * option (shift/right-click steps back). Used for settings with more than two states (route,
 * next-node driver, augs-per-install) without introducing a dropdown, which would look foreign
 * next to the bracket toggles.
 *
 * `disabled` marks options that exist but aren't currently selectable (e.g. handing off to
 * SphyxOS when SphyxOS isn't installed); they're skipped when cycling and dimmed if somehow set.
 */
export function Cycler<T extends string>({value, options, labels, activeColor, offColor, disabled, onChange}: {
    value: T;
    options: readonly T[];
    labels?: Partial<Record<T, string>>;
    activeColor: string;
    offColor: string;
    disabled?: readonly T[];
    onChange: (next: T) => void;
}) {
    const selectable = options.filter((o) => !disabled?.includes(o));
    const step = (delta: number) => {
        if (selectable.length === 0) return;
        const at = selectable.indexOf(value);
        // An unselectable current value still advances predictably: treat it as index -1.
        const next = (at + delta + selectable.length * 2) % selectable.length;
        onChange(selectable[next]);
    };
    const isDisabled = disabled?.includes(value) ?? false;

    return (
        <button
            className="wacnos-cycler"
            style={{color: isDisabled ? offColor : activeColor}}
            onClick={(e) => step(e.shiftKey ? -1 : 1)}
            onContextMenu={(e) => {
                e.preventDefault();
                step(-1);
            }}
        >
            <span className="wacnos-cycler-arrow">&lt;</span>
            {labels?.[value] ?? value}
            <span className="wacnos-cycler-arrow">&gt;</span>
        </button>
    );
}

/** A full-width callout for autopilot pauses - sticky until the user resumes or skips. */
export function Banner({text, color, children}: { text: string; color: string; children?: React.ReactNode }) {
    return (
        <div className="wacnos-banner" style={{borderColor: color, color}}>
            <span className="wacnos-banner-text">{text}</span>
            {children && <span className="wacnos-banner-actions">{children}</span>}
        </div>
    );
}

/** A labeled settings row: label, a dotted leader filling the remaining width, then a control. */
export function Row({label, line, children}: { label: string; line: string; children: React.ReactNode }) {
    return (
        <div className="wacnos-row">
            <span className="wacnos-row-label">{label}</span>
            <span className="wacnos-row-leader" style={{borderBottomColor: line}}/>
            {children}
        </div>
    );
}

/** A thin horizontal meter (security/money level), filled to `percent` in `color` against `track`. */
export function MeterBar({percent, color, track}: { percent: number; color: string; track: string }) {
    const clamped = Math.max(0, Math.min(100, percent));
    return (
        <div className="wacnos-meter" style={{background: track}}>
            <div className="wacnos-meter-fill" style={{width: `${clamped}%`, background: color}}/>
        </div>
    );
}

/** A label/value line inside the telemetry tile. */
export function TelemetryRow({label, value, valueColor}: { label: string; value: React.ReactNode; valueColor?: string }) {
    return (
        <div className="wacnos-telemetry-row">
            <span className="wacnos-telemetry-label">{label}</span>
            <span className="wacnos-telemetry-value" style={valueColor ? {color: valueColor} : undefined}>{value}</span>
        </div>
    );
}

/**
 * A collapsible menu category - WacnOS's own take on SphyxOS's persisted-layout row system
 * (LoaderSphyxOS.jsx's rows.push([title, ...]) + hidden/selected row state), restyled as a
 * console tree entry (a +/- marker, like a directory listing) instead of a rounded accordion card.
 */
export function CategoryRow({title, open, line, onToggle, children}: { title: string; open: boolean; line: string; onToggle: () => void; children: React.ReactNode }) {
    return (
        <div className="wacnos-category" style={{borderTopColor: line}}>
            <div className="wacnos-category-header" onClick={onToggle}>
                <span className="wacnos-category-marker">{open ? "-" : "+"}</span>
                <span className="wacnos-category-label">{title}</span>
            </div>
            {open && <div className="wacnos-category-body">{children}</div>}
        </div>
    );
}
