/**Author:
 * Discord: Sphyxis
 */
const SAVE_DIR = "SphyxOSUserData/themes/"
const DEFAULT_WIDTH = 640
const DEFAULT_HEIGHT = 840

function getReactLib() {
  return globalThis["React"] ?? globalThis["window"]?.React
}
function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value)
}
function cloneEditableObject(source) {
  const clone = {}
  for (const [key, value] of Object.entries(source ?? {})) {
    clone[key] = value
  }
  return clone
}
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}
function toHexByte(value) {
  return clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0")
}
function normalizeHexString(value) {
  const raw = String(value ?? "").trim().replace(/^#/, "")
  if (!raw) return null
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    return "#" + raw.split("").map((part) => part + part).join("").toLowerCase() + "ff"
  }
  if (/^[0-9a-fA-F]{4}$/.test(raw)) {
    return "#" + raw.split("").map((part) => part + part).join("").toLowerCase()
  }
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return "#" + raw.toLowerCase() + "ff"
  if (/^[0-9a-fA-F]{8}$/.test(raw)) return "#" + raw.toLowerCase()
  return null
}
function isColorLike(value) {
  if (typeof value !== "string") return false
  if (!String(value).trim().startsWith("#")) return false
  return normalizeHexString(value) !== null
}
function splitHexColor(value) {
  const normalized = normalizeHexString(value) ?? "#000000ff"
  return {
    hex: normalized,
    rgb: normalized.slice(0, 7),
    alphaByte: parseInt(normalized.slice(7, 9), 16),
    alphaPercent: Math.round((parseInt(normalized.slice(7, 9), 16) / 255) * 100),
  }
}
function composeHexColor(rgb, alphaPercent) {
  const cleanRgb = normalizeHexString(rgb)?.slice(0, 7) ?? "#000000"
  const alphaByte = Math.round((clamp(Number(alphaPercent) || 0, 0, 100) / 100) * 255)
  return cleanRgb + toHexByte(alphaByte)
}
function asNumberString(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return ""
  return Number.isInteger(value) ? String(value) : String(value)
}
function getNumberStep(value, key) {
  if (typeof value !== "number") return "1"
  if (String(key).toLowerCase().includes("opacity")) return "0.01"
  return Number.isInteger(value) ? "1" : "0.1"
}
function safeStringify(value) {
  return JSON.stringify(value, null, 2)
}
function formatObjectForCode(name, value) {
  return `const ${name} = ${safeStringify(value)}\n`
}
function statusMessage(text, tone = "info") {
  return { text, tone, ts: Date.now() }
}
function ColorControl({ label, value, onChange, registerRecent, editorInputProps }) {
  const React = getReactLib()
  const parsed = splitHexColor(value)
  const [textValue, setTextValue] = React.useState(parsed.hex)

  React.useEffect(() => {
    setTextValue(parsed.hex)
  }, [parsed.hex])

  const applyHex = (nextHex, shouldTrack = true) => {
    const normalized = normalizeHexString(nextHex)
    setTextValue(nextHex)
    if (!normalized) return
    onChange(normalized)
    if (shouldTrack) registerRecent(normalized)
  }

  return (
    <div style={styles.settingCard}>
      <div style={styles.settingHead}>
        <div>
          <div style={styles.settingLabel}>{label}</div>
          <div style={styles.settingMeta}>{parsed.hex}</div>
        </div>
        <div style={{ ...styles.colorChip, background: parsed.rgb, opacity: clamp(parsed.alphaByte / 255, 0, 1) }}></div>
      </div>
      <div style={styles.colorRow}>
        <input
          type="color"
          value={parsed.rgb}
          onChange={(event) => {
            const next = composeHexColor(event.target.value, parsed.alphaPercent)
            applyHex(next)
          }}
          {...editorInputProps}
          style={styles.nativeColorInput}
        />
        <input
          value={textValue}
          onChange={(event) => setTextValue(event.target.value)}
          onBlur={() => applyHex(textValue, false)}
          placeholder="#rrggbb or #rrggbbaa"
          {...editorInputProps}
          style={styles.textInput}
        />
      </div>
      <div style={styles.sliderBlock}>
        <div style={styles.sliderLabel}>
          <span>Opacity</span>
          <span>{parsed.alphaPercent}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={parsed.alphaPercent}
          onChange={(event) => {
            const next = composeHexColor(parsed.rgb, Number(event.target.value))
            applyHex(next)
          }}
          {...editorInputProps}
          style={styles.rangeInput}
        />
      </div>
    </div>
  )
}
function GenericControl({ label, value, onChange, editorInputProps }) {
  const React = getReactLib()

  if (typeof value === "boolean") {
    return (
      <label style={{ ...styles.settingCard, ...styles.checkboxCard }}>
        <div>
          <div style={styles.settingLabel}>{label}</div>
          <div style={styles.settingMeta}>{String(value)}</div>
        </div>
        <input
          type="checkbox"
          checked={value}
          onChange={(event) => onChange(event.target.checked)}
          {...editorInputProps}
          style={styles.checkbox}
        />
      </label>
    )
  }

  if (typeof value === "number") {
    const [textValue, setTextValue] = React.useState(asNumberString(value))

    React.useEffect(() => {
      setTextValue(asNumberString(value))
    }, [value])

    const commitNumber = (rawValue) => {
      const trimmed = String(rawValue ?? "").trim()
      if (trimmed === "") return
      const nextValue = Number(trimmed)
      if (!Number.isNaN(nextValue)) onChange(nextValue)
    }

    return (
      <div style={styles.settingCard}>
        <div style={styles.settingHead}>
          <div>
            <div style={styles.settingLabel}>{label}</div>
            <div style={styles.settingMeta}>number</div>
          </div>
        </div>
        <input
          type="number"
          step={getNumberStep(value, label)}
          value={textValue}
          onChange={(event) => setTextValue(event.target.value)}
          onBlur={() => commitNumber(textValue)}
          {...editorInputProps}
          style={styles.textInput}
        />
      </div>
    )
  }

  return (
    <div style={styles.settingCard}>
      <div style={styles.settingHead}>
        <div>
          <div style={styles.settingLabel}>{label}</div>
          <div style={styles.settingMeta}>{typeof value}</div>
        </div>
      </div>
      <input
        value={String(value ?? "")}
        onChange={(event) => onChange(event.target.value)}
        {...editorInputProps}
        style={styles.textInput}
      />
    </div>
  )
}
function SettingsSection({
  title,
  subtitle,
  data,
  onValueChange,
  onApply,
  onReset,
  registerRecent,
  editorInputProps,
  showFilter = false,
  filterText = "",
  onFilterChange = () => { },
}) {
  const entries = Object.entries(data ?? {}).filter(([key]) => key.toLowerCase().includes(filterText.toLowerCase())).sort(([a], [b]) => a.localeCompare(b))

  return (
    <section style={styles.panel}>
      <div style={styles.panelHeader}>
        <div>
          <h2 style={styles.panelTitle}>{title}</h2>
          <div style={styles.panelSubtitle}>{subtitle}</div>
        </div>
        <div style={styles.panelActions}>
          <button type="button" onClick={onApply} style={styles.primaryButton}>Apply</button>
          <button type="button" onClick={onReset} style={styles.secondaryButton}>Reset</button>
        </div>
      </div>
      {showFilter ? (
        <input
          value={filterText}
          onChange={(event) => onFilterChange(event.target.value)}
          placeholder={`Filter ${title.toLowerCase()} keys`}
          {...editorInputProps}
          style={{ ...styles.textInput, marginBottom: 10 }}
        />
      ) : null}
      <div style={styles.statsRow}>
        <span>{entries.length} visible</span>
        <span>{Object.keys(data ?? {}).length} total</span>
      </div>
      <div style={styles.settingsGrid}>
        {entries.map(([key, value]) =>
          isColorLike(value) ? (
            <ColorControl
              key={key}
              label={key}
              value={value}
              onChange={(next) => onValueChange(key, next)}
              registerRecent={registerRecent}
              editorInputProps={editorInputProps}
            />
          ) : (
            <GenericControl
              key={key}
              label={key}
              value={value}
              onChange={(next) => onValueChange(key, next)}
              editorInputProps={editorInputProps}
            />
          ),
        )}
      </div>
    </section>
  )
}
function RecentColors({ colors }) {
  if (!colors.length) return null
  return (
    <section style={styles.compactPanel}>
      <div style={styles.miniTitle}>Recent Colors</div>
      <div style={{ ...styles.panelSubtitle, marginBottom: 8 }}>Reference swatches from your latest edits.</div>
      <div style={styles.recentRow}>
        {colors.map((color) => {
          const parts = splitHexColor(color)
          return (
            <div
              key={color}
              title={color}
              style={{ ...styles.recentColor, background: parts.rgb, opacity: clamp(parts.alphaByte / 255, 0.12, 1) }}
            >
              <span style={styles.recentColorLabel}>{color}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
function ModalShell({ title, children, onClose, cardRef, onBlurCapture, onPointerDownCapture, onKeyDownCapture, onKeyUpCapture }) {
  return (
    <div
      style={styles.modalOverlay}
      onPointerDownCapture={onPointerDownCapture}
      onKeyDownCapture={onKeyDownCapture}
      onKeyUpCapture={onKeyUpCapture}
    >
      <div ref={cardRef} style={styles.modalCard} onBlurCapture={onBlurCapture}>
        <div style={styles.modalHeader}>
          <div style={styles.modalTitle}>{title}</div>
          <button type="button" onClick={onClose} style={styles.modalCloseButton}>Close</button>
        </div>
        {children}
      </div>
    </div>
  )
}
function PreviewPane({ theme, stylesDraft, onApplyAll, onResetAll, onRefresh, onLoad, onSave, onManage, status }) {
  const accent = theme?.primary ?? theme?.button ?? "#00f5d4ff"
  const accentAlt = theme?.secondary ?? theme?.button ?? "#3a86ffff"
  const fg = theme?.primarylight ?? theme?.secondary ?? theme?.text ?? "#d5dde5ff"
  const muted = theme?.primarydark ?? theme?.disabled ?? "#8896a3ff"
  const bg = theme?.backgroundprimary ?? theme?.background ?? "#101820ff"
  const bgAlt = theme?.backgroundsecondary ?? theme?.well ?? "#18232fff"
  const warning = theme?.warning ?? "#ffb703ff"
  const err = theme?.error ?? "#ff5d73ff"
  const success = theme?.success ?? "#39ff14ff"
  const info = theme?.info ?? "#00d1ffff"
  const fontFamily = typeof stylesDraft?.fontFamily === "string" ? stylesDraft.fontFamily : "monospace"
  const fontSize = typeof stylesDraft?.fontSize === "number" ? stylesDraft.fontSize : 14

  return (
    <section style={styles.compactPanel}>
      <div style={styles.previewHeader}>
        <div>
          <div style={styles.miniTitle}>Live Preview</div>
          <div style={styles.panelSubtitle}>Uses your current draft values before you apply them.</div>
        </div>
        <div style={styles.panelActions}>
          <button type="button" onClick={onApplyAll} style={styles.primaryButton}>Apply All</button>
          <button type="button" onClick={onResetAll} style={styles.secondaryButton}>Reset All</button>
          <button type="button" onClick={onRefresh} style={styles.secondaryButton}>Refresh</button>
          <button type="button" onClick={onLoad} style={styles.secondaryButton}>Load</button>
          <button type="button" onClick={onSave} style={styles.secondaryButton}>Save</button>
          <button type="button" onClick={onManage} style={styles.secondaryButton}>Manage</button>
        </div>
      </div>
      <div
        style={{
          ...styles.previewCard,
          background: splitHexColor(bg).rgb,
          color: splitHexColor(fg).rgb,
          fontFamily,
          fontSize,
        }}
      >
        <div style={styles.previewBar}>
          <div style={{ ...styles.previewBadge, background: splitHexColor(accent).rgb, color: "#071013" }}>Primary</div>
          <div style={{ ...styles.previewBadge, background: splitHexColor(accentAlt).rgb, color: "#071013" }}>Secondary</div>
          <div style={{ ...styles.previewBadge, background: splitHexColor(info).rgb, color: "#071013" }}>Info</div>
        </div>
        <div style={styles.previewTitle}>Theme sampling</div>
        <div style={styles.previewText}>Buttons, labels, status chips, backgrounds, and every exposed theme color below.</div>
        <div style={styles.previewPills}>
          <span style={{ ...styles.previewPill, background: splitHexColor(accent).rgb, color: "#071013" }}>Primary</span>
          <span style={{ ...styles.previewPill, background: splitHexColor(success).rgb, color: "#071013" }}>Success</span>
          <span style={{ ...styles.previewPill, background: splitHexColor(info).rgb, color: "#071013" }}>Info</span>
          <span style={{ ...styles.previewPill, background: splitHexColor(warning).rgb, color: "#071013" }}>Warning</span>
          <span style={{ ...styles.previewPill, background: splitHexColor(err).rgb, color: "#ffffff" }}>Error</span>
        </div>
        <div style={styles.previewMockGrid}>
          <div style={{ ...styles.previewMockPanel, background: splitHexColor(bgAlt).rgb, borderColor: splitHexColor(accent).rgb }}>
            <div style={styles.previewMockHeading}>Terminal</div>
            <div style={{ ...styles.previewCodeLine, color: splitHexColor(accent).rgb }}>$ run grow.js n00dles</div>
            <div style={{ ...styles.previewCodeLine, color: splitHexColor(muted).rgb }}>threads: 120</div>
            <div style={{ ...styles.previewCodeLine, color: splitHexColor(success).rgb }}>completed successfully</div>
          </div>
          <div style={{ ...styles.previewMockPanel, background: splitHexColor(bgAlt).rgb, borderColor: splitHexColor(accentAlt).rgb }}>
            <div style={styles.previewMockHeading}>UI States</div>
            <div style={styles.previewActionRow}>
              <button type="button" style={{ ...styles.previewButton, background: splitHexColor(accent).rgb, color: "#071013" }}>Action</button>
              <button type="button" style={{ ...styles.previewButton, background: splitHexColor(err).rgb, color: "#ffffff" }}>Danger</button>
            </div>
            <div style={styles.previewLinkRow}>
              <span style={{ color: splitHexColor(info).rgb }}>link color</span>
              <span style={{ color: splitHexColor(warning).rgb }}>warning text</span>
            </div>
          </div>
        </div>
      </div>
      <div style={{ ...styles.statusBar, ...(status?.tone === "error" ? styles.statusError : styles.statusInfo) }}>
        {status?.text ?? "Ready."}
      </div>
    </section>
  )
}
function ThemeEditorApp({ ns, initialTheme, initialStyles }) {
  const React = getReactLib()
  const appRef = React.useRef(null)
  const modalCardRef = React.useRef(null)
  const saveInputRef = React.useRef(null)
  const loadSelectRef = React.useRef(null)
  const manageSelectRef = React.useRef(null)
  const [themeDraft, setThemeDraft] = React.useState(() => cloneEditableObject(initialTheme))
  const [styleDraft, setStyleDraft] = React.useState(() => cloneEditableObject(initialStyles))
  const [themeFilter, setThemeFilter] = React.useState("")
  const [recentColors, setRecentColors] = React.useState([])
  const [savedLayouts, setSavedLayouts] = React.useState([])
  const [selectedLayoutName, setSelectedLayoutName] = React.useState("")
  const [managedLayoutName, setManagedLayoutName] = React.useState("")
  const [saveName, setSaveName] = React.useState("")
  const [activeDialog, setActiveDialog] = React.useState("")
  const [status, setStatus] = React.useState(statusMessage("Loaded current theme and styles."))

  const focusEditorSoon = () => {
    const focusTarget = () => appRef.current?.focus?.({ preventScroll: true })
    focusTarget()
    //globalThis["setTimeout"]?.(focusTarget, 0)
    //globalThis["setTimeout"]?.(focusTarget, 50)
  }

  const focusDialogControlSoon = () => {
    const focusTarget = () => {
      if (activeDialog === "save") {
        saveInputRef.current?.focus?.({ preventScroll: true })
        saveInputRef.current?.select?.()
        return
      }
      if (activeDialog === "load") {
        loadSelectRef.current?.focus?.({ preventScroll: true })
        return
      }
      if (activeDialog === "manage") {
        manageSelectRef.current?.focus?.({ preventScroll: true })
      }
    }
    focusTarget()
    //If we are losing focus to the terminal still, start enabling these.
    //globalThis["setTimeout"]?.(focusTarget, 0)
    //globalThis["setTimeout"]?.(focusTarget, 50)
    //globalThis["setTimeout"]?.(focusTarget, 150)
    //globalThis["setTimeout"]?.(focusTarget, 350)
  }

  React.useEffect(() => {
    focusEditorSoon()
  }, [])

  React.useEffect(() => {
    if (activeDialog) {
      focusDialogControlSoon()
      return
    }
    focusEditorSoon()
  }, [activeDialog, savedLayouts.length])

  const handleDialogBlurCapture = (event) => {
    const dialogNode = modalCardRef.current
    if (!dialogNode || !activeDialog) return
    const nextFocusTarget = event.relatedTarget
    if (nextFocusTarget && dialogNode.contains(nextFocusTarget)) return
    globalThis["setTimeout"]?.(() => {
      const activeElement = globalThis["document"]?.activeElement
      if (activeElement && dialogNode.contains(activeElement)) return
      focusDialogControlSoon()
    }, 0)
  }

  const handleModalPointerDownCapture = () => {
    if (!activeDialog) return
    globalThis["setTimeout"]?.(() => {
      focusDialogControlSoon()
    }, 0)
  }

  const handleModalKeyCapture = (event) => {
    if (!activeDialog) return
    event.stopPropagation()
  }

  const handleEditorInputPointerDownCapture = (event) => {
    event.stopPropagation()
  }

  const handleEditorInputKeyCapture = (event) => {
    event.stopPropagation()
  }

  const handleEditorInputFocus = (event) => {
    event.stopPropagation()
  }

  const editorInputProps = {
    onPointerDownCapture: handleEditorInputPointerDownCapture,
    onKeyDownCapture: handleEditorInputKeyCapture,
    onKeyUpCapture: handleEditorInputKeyCapture,
    onFocus: handleEditorInputFocus,
  }

  const refreshFromGame = () => {
    try {
      const nextTheme = cloneEditableObject(ns.ui.getTheme())
      const nextStyles = cloneEditableObject(ns.ui.getStyles())
      setThemeDraft(nextTheme)
      setStyleDraft(nextStyles)
      setStatus(statusMessage("Reloaded values from the live game session."))
    } catch (error) {
      setStatus(statusMessage(`Unable to refresh from game: ${String(error?.message ?? error)}`, "error"))
    }
  }

  const rememberColor = (hex) => {
    setRecentColors((current) => [hex, ...current.filter((item) => item !== hex)].slice(0, 10))
  }

  const applyTheme = () => {
    try {
      ns.ui.setTheme(themeDraft)
      setStatus(statusMessage("Theme applied."))
    } catch (error) {
      setStatus(statusMessage(`Theme apply failed: ${String(error?.message ?? error)}`, "error"))
    }
  }

  const applyStyles = () => {
    try {
      ns.ui.setStyles(styleDraft)
      setStatus(statusMessage("Styles applied."))
    } catch (error) {
      setStatus(statusMessage(`Style apply failed: ${String(error?.message ?? error)}`, "error"))
    }
  }

  const applyAll = () => {
    try {
      ns.ui.setTheme(themeDraft)
      ns.ui.setStyles(styleDraft)
      setStatus(statusMessage("Theme and styles applied."))
    } catch (error) {
      setStatus(statusMessage(`Apply all failed: ${String(error?.message ?? error)}`, "error"))
    }
  }

  const resetAll = () => {
    try {
      ns.ui.resetTheme()
      ns.ui.resetStyles()
      const nextTheme = cloneEditableObject(ns.ui.getTheme())
      const nextStyles = cloneEditableObject(ns.ui.getStyles())
      setThemeDraft(nextTheme)
      setStyleDraft(nextStyles)
      setStatus(statusMessage("Theme and styles reset."))
    } catch (error) {
      setStatus(statusMessage(`Reset all failed: ${String(error?.message ?? error)}`, "error"))
    }
  }

  const handleLoad = () => {
    try {
      const layouts = getSavedLayouts()
      setSavedLayouts(layouts)
      setSelectedLayoutName(layouts[0]?.name ?? "")
      setActiveDialog("load")
      setStatus(statusMessage("Choose a saved layout to load."))
    } catch (error) {
      setStatus(statusMessage(`Load failed: ${String(error?.message ?? error)}`, "error"))
    }
  }

  const handleSave = () => {
    try {
      setSaveName("")
      setActiveDialog("save")
      setStatus(statusMessage("Enter a name for the layout you want to save."))
    } catch (error) {
      setStatus(statusMessage(`Save failed: ${String(error?.message ?? error)}`, "error"))
    }
  }

  const handleManage = () => {
    try {
      const layouts = getSavedLayouts()
      setSavedLayouts(layouts)
      setManagedLayoutName(layouts[0]?.name ?? "")
      setActiveDialog("manage")
      setStatus(statusMessage("Select a saved layout to delete."))
    } catch (error) {
      setStatus(statusMessage(`Manage failed: ${String(error?.message ?? error)}`, "error"))
    }
  }

  const getSavedLayouts = () => {
    const files = ns.ls("home", SAVE_DIR)//.map(f => f.substring(SAVE_DIR.length))
    const layouts = []
    for (const file of files) {
      ns.scp(file, ns.self().server, "home")
      layouts.push(JSON.parse(ns.read(file)))
    }
    return layouts.sort((a, b) => a.name > b.name)
  }

  const confirmLoad = () => {
    try {
      const chosen = savedLayouts.find((layout) => layout.name === selectedLayoutName)
      if (!chosen) {
        setStatus(statusMessage("Select a saved layout first.", "error"))
        return
      }
      if (isPlainObject(chosen.theme)) setThemeDraft(cloneEditableObject(chosen.theme))
      if (isPlainObject(chosen.styles)) setStyleDraft(cloneEditableObject(chosen.styles))
      setActiveDialog("")
      setStatus(statusMessage(`Loaded layout "${chosen.name}" into the editor.`))
      focusEditorSoon()
    } catch (error) {
      setStatus(statusMessage(`Load failed: ${String(error?.message ?? error)}`, "error"))
    }
  }

  const confirmDelete = () => {
    try {
      const trimmedName = managedLayoutName.trim()
      if (!trimmedName) {
        setStatus(statusMessage("Select a saved layout first.", "error"))
        return
      }
      const fileName = `${SAVE_DIR}${trimmedName}.txt`
      if (!ns.fileExists(fileName, "home")) {
        setStatus(statusMessage(`Could not find "${trimmedName}" to delete.`, "error"))
        return
      }
      ns.rm(fileName, "home")
      const nextLayouts = getSavedLayouts()
      setSavedLayouts(nextLayouts)
      setManagedLayoutName(nextLayouts[0]?.name ?? "")
      setStatus(statusMessage(`Deleted "${trimmedName}".`))
      if (!nextLayouts.length) {
        setActiveDialog("")
        focusEditorSoon()
      }
    } catch (error) {
      setStatus(statusMessage(`Delete failed: ${String(error?.message ?? error)}`, "error"))
    }
  }

  const confirmSave = () => {
    try {
      const trimmedName = saveName.trim()
      if (!trimmedName) {
        setStatus(statusMessage("Enter a layout name before saving.", "error"))
        return
      }
      const files = ns.ls("home", SAVE_DIR).map(f => f.substring(SAVE_DIR.length))
      if (files.includes(trimmedName + ".txt")) {
        setStatus(statusMessage("A theme by this name already exists.", "error"))
        return
      }
      const payload = {
        name: trimmedName,
        theme: cloneEditableObject(themeDraft),
        styles: cloneEditableObject(styleDraft),
      }
      const serialized = JSON.stringify(payload, null, 2)
      const fileName = SAVE_DIR + trimmedName + ".txt"
      ns.write(fileName, serialized, "w")
      ns.scp(fileName, "home", ns.self().server)
      void serialized
      setActiveDialog("")
      setStatus(statusMessage(`${trimmedName} has been saved.`))
      focusEditorSoon()
    } catch (error) {
      setStatus(statusMessage(`Save failed: ${String(error?.message ?? error)}`, "error"))
    }
  }

  const resetTheme = () => {
    try {
      ns.ui.resetTheme()
      const nextTheme = cloneEditableObject(ns.ui.getTheme())
      setThemeDraft(nextTheme)
      setStatus(statusMessage("Theme reset, then reloaded from ns.ui.getTheme()."))
    } catch (error) {
      setStatus(statusMessage(`Theme reset failed: ${String(error?.message ?? error)}`, "error"))
    }
  }

  const resetStyles = () => {
    try {
      ns.ui.resetStyles()
      const nextStyles = cloneEditableObject(ns.ui.getStyles())
      setStyleDraft(nextStyles)
      setStatus(statusMessage("Styles reset, then reloaded from ns.ui.getStyles()."))
    } catch (error) {
      setStatus(statusMessage(`Style reset failed: ${String(error?.message ?? error)}`, "error"))
    }
  }

  return (
    <div
      ref={appRef}
      tabIndex={-1}
      style={styles.appShell}
      onPointerUp={(event) => {
        const targetTag = String(event.target?.tagName ?? "").toLowerCase()
        if (targetTag === "input" || targetTag === "textarea" || targetTag === "select") return
        focusEditorSoon()
      }}
    >
      <PreviewPane
        theme={themeDraft}
        stylesDraft={styleDraft}
        onApplyAll={applyAll}
        onResetAll={resetAll}
        onRefresh={refreshFromGame}
        onLoad={handleLoad}
        onSave={handleSave}
        onManage={handleManage}
        status={status}
      />
      <div style={styles.stack}>
        <SettingsSection
          title="Styles"
          subtitle="Layout and typography values exposed by ns.ui.getStyles()"
          data={styleDraft}
          onValueChange={(key, nextValue) => setStyleDraft((current) => ({ ...current, [key]: nextValue }))}
          onApply={applyStyles}
          onReset={resetStyles}
          registerRecent={rememberColor}
          editorInputProps={editorInputProps}
          showFilter={false}
        />
        <RecentColors colors={recentColors} />
        <SettingsSection
          title="Theme"
          subtitle="Color-focused values exposed by ns.ui.getTheme()"
          data={themeDraft}
          filterText={themeFilter}
          onFilterChange={setThemeFilter}
          onValueChange={(key, nextValue) => setThemeDraft((current) => ({ ...current, [key]: nextValue }))}
          onApply={applyTheme}
          onReset={resetTheme}
          registerRecent={rememberColor}
          editorInputProps={editorInputProps}
          showFilter={true}
        />
      </div>
      {activeDialog === "load" ? (
        <ModalShell
          title="Load Layout"
          onClose={() => setActiveDialog("")}
          cardRef={modalCardRef}
          onBlurCapture={handleDialogBlurCapture}
          onPointerDownCapture={handleModalPointerDownCapture}
          onKeyDownCapture={handleModalKeyCapture}
          onKeyUpCapture={handleModalKeyCapture}
        >
          <div style={styles.modalBody}>
            {savedLayouts.length ? (
              <select
                ref={loadSelectRef}
                value={selectedLayoutName}
                onChange={(event) => setSelectedLayoutName(event.target.value)}
                style={styles.textInput}
              >
                {savedLayouts.map((layout) => (
                  <option key={layout.name} value={layout.name}>{layout.name}</option>
                ))}
              </select>
            ) : (
              <div style={styles.emptyState}>No saved layouts were returned.</div>
            )}
            <div style={styles.modalActions}>
              <button type="button" onClick={() => setActiveDialog("")} style={styles.secondaryButton}>Cancel</button>
              <button type="button" onClick={confirmLoad} style={styles.primaryButton}>Load Selected</button>
            </div>
          </div>
        </ModalShell>
      ) : null}
      {activeDialog === "manage" ? (
        <ModalShell
          title="Manage Layouts"
          onClose={() => setActiveDialog("")}
          cardRef={modalCardRef}
          onBlurCapture={handleDialogBlurCapture}
          onPointerDownCapture={handleModalPointerDownCapture}
          onKeyDownCapture={handleModalKeyCapture}
          onKeyUpCapture={handleModalKeyCapture}
        >
          <div style={styles.modalBody}>
            {savedLayouts.length ? (
              <select
                ref={manageSelectRef}
                value={managedLayoutName}
                onChange={(event) => setManagedLayoutName(event.target.value)}
                style={styles.textInput}
              >
                {savedLayouts.map((layout) => (
                  <option key={layout.name} value={layout.name}>{layout.name}</option>
                ))}
              </select>
            ) : (
              <div style={styles.emptyState}>No saved layouts are available to manage.</div>
            )}
            <div style={styles.modalActions}>
              <button type="button" onClick={() => setActiveDialog("")} style={styles.secondaryButton}>Close</button>
              <button type="button" onClick={confirmDelete} style={styles.dangerButton} disabled={!savedLayouts.length}>Delete Selected</button>
            </div>
          </div>
        </ModalShell>
      ) : null}
      {activeDialog === "save" ? (
        <ModalShell
          title="Save Layout"
          onClose={() => setActiveDialog("")}
          cardRef={modalCardRef}
          onBlurCapture={handleDialogBlurCapture}
          onPointerDownCapture={handleModalPointerDownCapture}
          onKeyDownCapture={handleModalKeyCapture}
          onKeyUpCapture={handleModalKeyCapture}
        >
          <div style={styles.modalBody}>
            <input
              ref={saveInputRef}
              value={saveName}
              onChange={(event) => setSaveName(event.target.value)}
              placeholder="Enter layout name"
              style={styles.textInput}
            />
            <div style={styles.modalActions}>
              <button type="button" onClick={() => setActiveDialog("")} style={styles.secondaryButton}>Cancel</button>
              <button type="button" onClick={confirmSave} style={styles.primaryButton}>Save Layout</button>
            </div>
          </div>
        </ModalShell>
      ) : null}
    </div>
  )
}
const styles = {
  appShell: {
    color: "#d5dde5",
    background: "linear-gradient(180deg, #0b1220 0%, #091018 100%)",
    minHeight: "100%",
    padding: 12,
    fontFamily: "Consolas, Monaco, monospace",
  },
  stack: {
    display: "grid",
    gap: 12,
  },
  panel: {
    border: "1px solid #1d3140",
    borderRadius: 12,
    background: "rgba(9, 16, 24, 0.94)",
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.25)",
    padding: 12,
  },
  compactPanel: {
    border: "1px solid #1d3140",
    borderRadius: 12,
    background: "rgba(9, 16, 24, 0.94)",
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.25)",
    padding: 12,
    marginBottom: 12,
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  previewHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 10,
  },
  panelTitle: {
    margin: 0,
    fontSize: 18,
    color: "#f4f7fb",
  },
  panelSubtitle: {
    marginTop: 3,
    fontSize: 11,
    color: "#89a0b4",
  },
  panelActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  primaryButton: {
    border: "1px solid #00d1ff",
    background: "linear-gradient(180deg, #00d1ff 0%, #009ec2 100%)",
    color: "#071013",
    padding: "7px 12px",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 12,
  },
  secondaryButton: {
    border: "1px solid #2a455a",
    background: "#111c28",
    color: "#d5dde5",
    padding: "7px 12px",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 12,
  },
  dangerButton: {
    border: "1px solid #8b2f3b",
    background: "linear-gradient(180deg, #b63b4d 0%, #8e2738 100%)",
    color: "#fff5f6",
    padding: "7px 12px",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 12,
  },
  statsRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 11,
    color: "#7891a6",
    marginBottom: 10,
  },
  settingsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    gap: 10,
  },
  settingCard: {
    border: "1px solid #1b2d3c",
    borderRadius: 10,
    background: "#0f1822",
    padding: 10,
  },
  checkboxCard: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  settingHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 8,
  },
  settingLabel: {
    fontSize: 13,
    fontWeight: 700,
    color: "#f4f7fb",
  },
  settingMeta: {
    fontSize: 11,
    color: "#84a0b5",
    marginTop: 2,
  },
  textInput: {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 8,
    border: "1px solid #274155",
    background: "#091018",
    color: "#e6edf3",
    padding: "8px 10px",
    fontSize: 12,
    fontFamily: "Consolas, Monaco, monospace",
  },
  checkbox: {
    width: 18,
    height: 18,
  },
  colorChip: {
    width: 28,
    height: 28,
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.18)",
    boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.25)",
  },
  colorRow: {
    display: "grid",
    gridTemplateColumns: "46px 1fr",
    gap: 8,
    marginBottom: 8,
  },
  nativeColorInput: {
    width: 46,
    height: 36,
    padding: 3,
    borderRadius: 8,
    border: "1px solid #274155",
    background: "#091018",
    cursor: "pointer",
  },
  sliderBlock: {
    marginBottom: 8,
  },
  sliderLabel: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 11,
    color: "#84a0b5",
    marginBottom: 4,
  },
  rangeInput: {
    width: "100%",
  },
  previewCard: {
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.1)",
    padding: 14,
  },
  previewBar: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 8,
  },
  previewBadge: {
    display: "inline-block",
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 800,
  },
  previewTitle: {
    fontSize: 20,
    fontWeight: 800,
    marginBottom: 6,
  },
  previewText: {
    fontSize: 13,
    lineHeight: 1.5,
    opacity: 0.88,
  },
  previewPills: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 10,
    marginBottom: 12,
  },
  previewPill: {
    display: "inline-block",
    padding: "5px 9px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 800,
  },
  statusBar: {
    marginTop: 10,
    borderRadius: 8,
    padding: "8px 10px",
    fontSize: 12,
  },
  statusInfo: {
    background: "rgba(0, 209, 255, 0.12)",
    border: "1px solid rgba(0, 209, 255, 0.35)",
    color: "#b8efff",
  },
  statusError: {
    background: "rgba(255, 93, 115, 0.12)",
    border: "1px solid rgba(255, 93, 115, 0.35)",
    color: "#ffd3d9",
  },
  miniTitle: {
    fontSize: 13,
    fontWeight: 800,
    color: "#f4f7fb",
    marginBottom: 8,
  },
  recentRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
    gap: 8,
  },
  recentColor: {
    minHeight: 40,
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.12)",
    cursor: "pointer",
    position: "relative",
    overflow: "hidden",
  },
  recentColorLabel: {
    position: "absolute",
    inset: "auto 0 0 0",
    fontSize: 10,
    background: "rgba(0, 0, 0, 0.55)",
    color: "#f7fbff",
    padding: "3px 4px",
    textAlign: "center",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(3, 8, 14, 0.76)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    zIndex: 9999,
  },
  modalCard: {
    width: "min(560px, 100%)",
    maxHeight: "80vh",
    overflow: "auto",
    borderRadius: 14,
    border: "1px solid #294357",
    background: "#0b1320",
    boxShadow: "0 24px 56px rgba(0, 0, 0, 0.45)",
    padding: 14,
  },
  modalHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: "#f4f7fb",
  },
  modalCloseButton: {
    border: "1px solid #2a455a",
    background: "#111c28",
    color: "#d5dde5",
    padding: "6px 10px",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
  },
  modalBody: {
    display: "grid",
    gap: 12,
  },
  layoutList: {
    display: "grid",
    gap: 8,
  },
  layoutOption: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #213649",
    background: "#0f1822",
    cursor: "pointer",
  },
  emptyState: {
    borderRadius: 10,
    border: "1px dashed #2a455a",
    background: "#0f1822",
    padding: 12,
    color: "#9db0c1",
    fontSize: 12,
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
    flexWrap: "wrap",
  },
  previewMockGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    marginBottom: 12,
  },
  previewMockPanel: {
    borderRadius: 10,
    border: "1px solid",
    padding: 10,
  },
  previewMockHeading: {
    fontSize: 12,
    fontWeight: 800,
    marginBottom: 8,
  },
  previewCodeLine: {
    fontSize: 12,
    lineHeight: 1.5,
  },
  previewActionRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 8,
  },
  previewButton: {
    border: "none",
    borderRadius: 10,
    padding: "7px 12px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "default",
  },
  previewLinkRow: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    fontSize: 12,
  },
}

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL")
  if (!ns.ui?.getTheme || !ns.ui?.getStyles || !ns.ui?.setTheme || !ns.ui?.setStyles) {
    ns.tprint("This script requires the BitBurner 3.0.0 dev UI theme/style APIs.")
    return
  }

  const React = getReactLib()
  if (!React) {
    ns.tprint("React runtime is unavailable in this BitBurner session.")
    return
  }
  ns.atExit(() => { ns.clearPort(28) })
  ns.clearPort(28)
  ns.writePort(28, ns.pid)

  const initialTheme = cloneEditableObject(ns.ui.getTheme())
  const initialStyles = cloneEditableObject(ns.ui.getStyles())

  ns.ui.openTail()
  ns.ui.resizeTail(DEFAULT_WIDTH, DEFAULT_HEIGHT)
  ns.clearLog()
  ns.printRaw(<ThemeEditorApp ns={ns} initialTheme={initialTheme} initialStyles={initialStyles}></ThemeEditorApp>)
  await new Promise(() => { })
}
