import { useState, useRef } from 'react';
import { RotateCcw, Copy, Check } from 'lucide-react';
import { useAppearance, type AccentColor } from '../context/AppearanceContext';
import { useStyle } from '../context/StyleContext';
import './StyleGuide.css';

// ── Font options ──────────────────────────────────────────────────────────────

const BODY_FONTS = [
  { label: 'Plus Jakarta Sans', value: "'Plus Jakarta Sans', -apple-system, sans-serif", google: 'Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700' },
  { label: 'Outfit',            value: "'Outfit', -apple-system, sans-serif",            google: 'Outfit:wght@300;400;500;600' },
  { label: 'Inter',             value: "'Inter', -apple-system, sans-serif",             google: 'Inter:wght@300;400;500;600' },
  { label: 'DM Sans',           value: "'DM Sans', -apple-system, sans-serif",           google: 'DM+Sans:wght@300;400;500;600' },
  { label: 'Nunito',            value: "'Nunito', -apple-system, sans-serif",            google: 'Nunito:wght@300;400;500;600' },
  { label: 'System',            value: '-apple-system, BlinkMacSystemFont, sans-serif',  google: null },
];

const DISPLAY_FONTS = [
  { label: 'Cormorant Garamond', value: "'Cormorant Garamond', Georgia, serif",  google: 'Cormorant+Garamond:wght@300;400;500;600' },
  { label: 'Lora',               value: "'Lora', Georgia, serif",                google: 'Lora:wght@400;500;600' },
  { label: 'Playfair Display',   value: "'Playfair Display', Georgia, serif",    google: 'Playfair+Display:wght@400;500;600' },
  { label: 'DM Serif Display',   value: "'DM Serif Display', Georgia, serif",    google: 'DM+Serif+Display' },
  { label: 'Outfit',             value: "'Outfit', sans-serif",                  google: 'Outfit:wght@300;400;500;600' },
  { label: 'Plus Jakarta Sans',  value: "'Plus Jakarta Sans', sans-serif",       google: 'Plus+Jakarta+Sans:wght@300;400;500;600;700' },
];

const MONO_FONTS = [
  { label: 'JetBrains Mono',  value: "'JetBrains Mono', 'Fira Code', monospace",  google: 'JetBrains+Mono:wght@400;500' },
  { label: 'Fira Code',       value: "'Fira Code', monospace",                    google: 'Fira+Code:wght@400;500' },
  { label: 'Source Code Pro', value: "'Source Code Pro', monospace",              google: 'Source+Code+Pro:wght@400;500' },
  { label: 'Roboto Mono',     value: "'Roboto Mono', monospace",                  google: 'Roboto+Mono:wght@400;500' },
  { label: 'Courier New',     value: "'Courier New', Courier, monospace",         google: null },
];

// ── Accent presets ────────────────────────────────────────────────────────────

const ACCENT_PRESETS: { id: AccentColor; hex: string; label: string }[] = [
  { id: 'teal',   hex: '#2CC295', label: 'Teal'   },
  { id: 'green',  hex: '#3A8C5A', label: 'Green'  },
  { id: 'blue',   hex: '#3A7EC0', label: 'Blue'   },
  { id: 'purple', hex: '#6B52C0', label: 'Purple' },
  { id: 'rose',   hex: '#C04060', label: 'Rose'   },
  { id: 'amber',  hex: '#C07C3A', label: 'Amber'  },
];

// ── Color groups ──────────────────────────────────────────────────────────────

const COLOR_GROUPS = [
  { label: 'Background & Surface',
    vars: ['--color-bg', '--color-bg-raised', '--color-surface', '--color-surface-hover'] },
  { label: 'Text',
    vars: ['--color-text', '--color-text-secondary', '--color-text-muted'] },
  { label: 'Border',
    vars: ['--color-border', '--color-border-light'] },
  { label: 'Accent / Primary',
    vars: ['--color-primary', '--color-primary-light', '--color-primary-dim', '--color-primary-glow', '--color-primary-subtle'] },
  { label: 'Semantic',
    vars: ['--color-success', '--color-warning', '--color-danger'] },
];

// ── Loaded Google Fonts tracker ───────────────────────────────────────────────

const _loaded = new Set(['Plus Jakarta Sans', 'Outfit', 'Cormorant Garamond', 'JetBrains Mono']);

function loadFont(family: string, googleParam: string | null) {
  if (!googleParam || _loaded.has(family)) return;
  _loaded.add(family);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${googleParam}&display=swap`;
  document.head.appendChild(link);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function toHexIfPossible(val: string): string {
  if (val.startsWith('#') && (val.length === 7 || val.length === 4)) return val;
  return val;
}

// ── Tab types ─────────────────────────────────────────────────────────────────

type Tab = 'typography' | 'colors' | 'neumorphic' | 'components' | 'spacing';

const TABS: { id: Tab; label: string }[] = [
  { id: 'typography', label: 'Typography' },
  { id: 'colors',     label: 'Colors' },
  { id: 'neumorphic', label: 'Neumorphic' },
  { id: 'components', label: 'Components' },
  { id: 'spacing',    label: 'Spacing' },
];

// ── Color swatch ──────────────────────────────────────────────────────────────

function ColorSwatch({ varName }: { varName: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const label = varName.replace('--', '');

  function handleCopy() {
    navigator.clipboard.writeText(varName).catch(() => {});
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button className="sg-swatch" onClick={handleCopy} title={`Copy ${varName}`} type="button">
      <div className="sg-swatch-color" style={{ background: `var(${varName})` }} />
      <div className="sg-swatch-info">
        <span className="sg-swatch-name">{label}</span>
        <span className="sg-swatch-value">{toHexIfPossible(getCssVar(varName))}</span>
      </div>
      <span className={`sg-swatch-copy${copied ? ' visible' : ''}`}>
        {copied ? <Check size={11} strokeWidth={2.5} /> : <Copy size={11} strokeWidth={1.75} />}
      </span>
    </button>
  );
}

// ── Typography tab ────────────────────────────────────────────────────────────

function TypographyTab({ overrides, setOverride }: { overrides: Record<string, string>; setOverride: (k: string, v: string) => void }) {
  const bodyVal    = overrides['--font-body']    ?? BODY_FONTS[0].value;
  const displayVal = overrides['--font-display'] ?? DISPLAY_FONTS[0].value;
  const monoVal    = overrides['--font-mono']    ?? MONO_FONTS[0].value;

  function pickFont(cssVar: string, value: string, label: string, google: string | null) {
    loadFont(label, google);
    setOverride(cssVar, value);
  }

  return (
    <div className="sg-section">
      <div className="sg-font-controls">
        <div className="sg-control">
          <label className="sg-label">Body Font</label>
          <select className="input sg-select" value={bodyVal}
            onChange={e => {
              const opt = BODY_FONTS.find(f => f.value === e.target.value);
              if (opt) pickFont('--font-body', opt.value, opt.label, opt.google);
            }}
          >
            {BODY_FONTS.map(f => <option key={f.label} value={f.value}>{f.label}</option>)}
          </select>
        </div>
        <div className="sg-control">
          <label className="sg-label">Display Font</label>
          <select className="input sg-select" value={displayVal}
            onChange={e => {
              const opt = DISPLAY_FONTS.find(f => f.value === e.target.value);
              if (opt) pickFont('--font-display', opt.value, opt.label, opt.google);
            }}
          >
            {DISPLAY_FONTS.map(f => <option key={f.label} value={f.value}>{f.label}</option>)}
          </select>
        </div>
        <div className="sg-control">
          <label className="sg-label">Mono Font</label>
          <select className="input sg-select" value={monoVal}
            onChange={e => {
              const opt = MONO_FONTS.find(f => f.value === e.target.value);
              if (opt) pickFont('--font-mono', opt.value, opt.label, opt.google);
            }}
          >
            {MONO_FONTS.map(f => <option key={f.label} value={f.value}>{f.label}</option>)}
          </select>
        </div>
      </div>

      <div className="card sg-type-samples">
        <p className="sg-sample-display">Display Heading — The quick brown fox</p>
        <h2 className="sg-sample-h2">Section Heading</h2>
        <h3 className="sg-sample-h3">Card / Subsection Heading</h3>
        <p className="sg-sample-body">Body text — The quick brown fox jumps over the lazy dog. This is what your main reading content looks like at default size with normal weight. Paragraphs, descriptions, and most UI copy use this style.</p>
        <p className="sg-sample-secondary">Secondary — Supporting information, subtitles, helper text, and less prominent labels.</p>
        <p className="sg-sample-muted">Muted — Timestamps, metadata, placeholders, and captions.</p>
        <code className="sg-sample-mono">mono — const x = "hello"; // 0123456789 &lt;Tag /&gt;</code>
      </div>

      <div className="sg-group-title">Type Scale</div>
      <div className="sg-type-scale card">
        {[
          { size: '2rem',    weight: 500, label: '2rem  ·  500',  tag: 'Display',    font: 'display' },
          { size: '1.5rem',  weight: 500, label: '1.5rem ·  500', tag: 'Heading 2',  font: 'display' },
          { size: '1.25rem', weight: 600, label: '1.25rem · 600', tag: 'Heading 3',  font: 'body' },
          { size: '1rem',    weight: 600, label: '1rem  ·  600',  tag: 'Heading 4',  font: 'body' },
          { size: '0.875rem',weight: 400, label: '0.875rem · 400',tag: 'Body',       font: 'body' },
          { size: '0.8rem',  weight: 400, label: '0.8rem · 400',  tag: 'Small',      font: 'body' },
          { size: '0.72rem', weight: 400, label: '0.72rem · 400', tag: 'Caption',    font: 'body' },
          { size: '0.75rem', weight: 400, label: '0.75rem · 400', tag: 'Mono',       font: 'mono' },
        ].map(({ size, weight, label, tag, font }) => (
          <div key={size + font} className="sg-scale-row">
            <code className="sg-scale-label">{label}</code>
            <span
              className="sg-scale-sample"
              style={{
                fontSize: size,
                fontWeight: weight,
                fontFamily: `var(--font-${font})`,
              }}
            >
              {tag} — The quick brown fox jumps
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Colors tab ────────────────────────────────────────────────────────────────

function ColorsTab({ overrides, setOverride, accentColor, setAccentColor, setCustomAccentHex }: {
  overrides: Record<string, string>;
  setOverride: (k: string, v: string) => void;
  accentColor: AccentColor;
  setAccentColor: (a: AccentColor) => void;
  setCustomAccentHex: (hex: string) => void;
}) {
  const [neuDark, setNeuDark] = useState(() => {
    const saved = overrides['--neu-dark'];
    if (saved) return saved;
    const c = getCssVar('--neu-dark');
    return c.startsWith('#') ? c : '#1d1e1f';
  });
  const [neuLight, setNeuLight] = useState(() => {
    const saved = overrides['--neu-light'];
    if (saved) return saved;
    const c = getCssVar('--neu-light');
    return c.startsWith('#') ? c : '#353638';
  });
  const [customHex, setCustomHex] = useState(getCssVar('--color-primary'));

  return (
    <div className="sg-section">
      <div className="sg-group">
        <div className="sg-group-title">Accent Color</div>
        <div className="sg-accent-row">
          {ACCENT_PRESETS.map(a => (
            <button
              key={a.id}
              className={`sg-accent-chip${accentColor === a.id && !overrides['--color-primary'] ? ' active' : ''}`}
              style={{ '--chip': a.hex } as React.CSSProperties}
              onClick={() => { setAccentColor(a.id); setCustomHex(a.hex); }}
              title={a.label}
              type="button"
            >
              <span className="sg-accent-dot" />
              {a.label}
            </button>
          ))}
          <label className="sg-accent-chip sg-accent-custom" title="Custom">
            <input
              type="color"
              className="sg-hidden-picker"
              value={customHex}
              onChange={e => {
                setCustomHex(e.target.value);
                setCustomAccentHex(e.target.value);
              }}
            />
            <span className="sg-accent-dot" style={{ background: customHex }} />
            Custom
          </label>
        </div>
      </div>

      <div className="sg-group">
        <div className="sg-group-title">Neumorphic Shadow Colors</div>
        <p className="sg-hint">Controls the shadow depths for all neumorphic surfaces. Works best in dark mode where these are opaque hex values.</p>
        <div className="sg-neu-color-row">
          <div className="sg-neu-color-item">
            <label className="sg-label">Shadow Dark <code>--neu-dark</code></label>
            <div className="sg-color-picker-wrap">
              <div className="sg-color-preview" style={{ background: neuDark }} />
              <input type="color" className="sg-color-input" value={neuDark}
                onChange={e => {
                  setNeuDark(e.target.value);
                  setOverride('--neu-dark', e.target.value);
                }}
              />
              <span className="sg-color-hex">{neuDark}</span>
            </div>
          </div>
          <div className="sg-neu-color-item">
            <label className="sg-label">Shadow Light <code>--neu-light</code></label>
            <div className="sg-color-picker-wrap">
              <div className="sg-color-preview" style={{ background: neuLight }} />
              <input type="color" className="sg-color-input" value={neuLight}
                onChange={e => {
                  setNeuLight(e.target.value);
                  setOverride('--neu-light', e.target.value);
                }}
              />
              <span className="sg-color-hex">{neuLight}</span>
            </div>
          </div>
        </div>
      </div>

      {COLOR_GROUPS.map(group => (
        <div key={group.label} className="sg-group">
          <div className="sg-group-title">{group.label}</div>
          <div className="sg-swatch-grid">
            {group.vars.map(v => <ColorSwatch key={v} varName={v} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Neumorphic tab ────────────────────────────────────────────────────────────

function NeumorphicTab() {
  const depths = [
    { label: 'Convex — Large',      cssClass: 'sg-neu-xl',       var: '--shadow-neu' },
    { label: 'Convex — Medium',     cssClass: 'sg-neu-sm',       var: '--shadow-neu-sm' },
    { label: 'Convex — Small',      cssClass: 'sg-neu-xs',       var: '--shadow-neu-xs' },
    { label: 'Concave — Large',     cssClass: 'sg-neu-inset',    var: '--shadow-neu-inset' },
    { label: 'Concave — Small',     cssClass: 'sg-neu-inset-sm', var: '--shadow-neu-inset-sm' },
  ];

  return (
    <div className="sg-section">
      <p className="sg-hint">Neumorphic shadows are computed from <code>--neu-dark</code> and <code>--neu-light</code>, which you can edit in the Colors tab. The shadow scale goes from large (dramatic depth) to small (subtle lift).</p>

      <div className="sg-group-title">Shadow Depths</div>
      <div className="sg-neu-grid">
        {depths.map(({ label, cssClass, var: v }) => (
          <div key={label} className="sg-neu-cell">
            <div className={`sg-neu-box ${cssClass}`} />
            <span className="sg-neu-label">{label}</span>
            <code className="sg-neu-var">var({v})</code>
          </div>
        ))}
      </div>

      <div className="sg-group-title" style={{ marginTop: '2rem' }}>Interactive States</div>
      <p className="sg-hint">The convention: default uses <code>shadow-neu-sm</code>, hover lifts to <code>shadow-neu</code>, pressed goes concave with <code>shadow-neu-inset-sm</code>.</p>
      <div className="sg-state-row">
        {[
          { label: 'Default',  style: 'box-shadow: var(--shadow-neu-sm)', cls: 'sg-state-default' },
          { label: 'Hover',    style: 'box-shadow: var(--shadow-neu)',    cls: 'sg-state-hover' },
          { label: 'Pressed',  style: 'box-shadow: var(--shadow-neu-inset-sm)', cls: 'sg-state-pressed' },
          { label: 'Focused',  style: 'ring: primary-glow',              cls: 'sg-state-focused' },
        ].map(({ label, cls }) => (
          <div key={label} className="sg-state-item">
            <div className={`sg-state-box ${cls}`}>{label}</div>
          </div>
        ))}
      </div>

      <div className="sg-group-title" style={{ marginTop: '2rem' }}>Surface Usage</div>
      <div className="sg-surface-row">
        <div className="sg-surface-item">
          <div className="sg-surface-box sg-surface-bg">
            <span>bg</span>
          </div>
          <code className="sg-neu-var">color-bg</code>
        </div>
        <div className="sg-surface-item">
          <div className="sg-surface-box sg-surface-raised">
            <span>raised</span>
          </div>
          <code className="sg-neu-var">color-bg-raised</code>
        </div>
        <div className="sg-surface-item">
          <div className="sg-surface-box sg-surface-surface">
            <span>surface</span>
          </div>
          <code className="sg-neu-var">color-surface</code>
        </div>
        <div className="sg-surface-item">
          <div className="sg-surface-box sg-surface-card">
            <span>card</span>
          </div>
          <code className="sg-neu-var">.card class</code>
        </div>
      </div>
    </div>
  );
}

// ── Components tab ────────────────────────────────────────────────────────────

function ComponentsTab() {
  const [inputVal, setInputVal] = useState('');
  const [textareaVal, setTextareaVal] = useState('');

  return (
    <div className="sg-section">
      <div className="sg-group">
        <div className="sg-group-title">Buttons</div>
        <div className="sg-component-row">
          <button className="btn btn-primary">Primary</button>
          <button className="btn btn-secondary">Secondary</button>
          <button className="btn btn-ghost">Ghost</button>
          <button className="btn btn-danger">Danger</button>
          <button className="btn btn-danger-solid">Danger Solid</button>
          <button className="btn btn-primary" disabled>Disabled</button>
        </div>
        <div className="sg-component-row sg-component-row--sm">
          <button className="btn btn-primary btn-sm">Primary SM</button>
          <button className="btn btn-secondary btn-sm">Secondary SM</button>
          <button className="btn btn-ghost btn-sm">Ghost SM</button>
          <button className="btn btn-primary btn-lg">Primary LG</button>
        </div>
      </div>

      <div className="sg-group">
        <div className="sg-group-title">Badges</div>
        <div className="sg-component-row">
          <span className="badge badge-purple">Purple</span>
          <span className="badge badge-green">Green</span>
          <span className="badge badge-yellow">Warning</span>
          <span className="badge badge-red">Danger</span>
        </div>
      </div>

      <div className="sg-group">
        <div className="sg-group-title">Form Controls</div>
        <div className="sg-component-col">
          <div className="form-group">
            <label className="form-label">Text Input</label>
            <input className="input" type="text" placeholder="Placeholder text…"
              value={inputVal} onChange={e => setInputVal(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Disabled Input</label>
            <input className="input" type="text" placeholder="Can't touch this" disabled />
          </div>
          <div className="form-group">
            <label className="form-label">Textarea</label>
            <textarea className="textarea" placeholder="Multi-line text…"
              value={textareaVal} onChange={e => setTextareaVal(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Select</label>
            <select className="input select">
              <option>Option one</option>
              <option>Option two</option>
              <option>Option three</option>
            </select>
          </div>
        </div>
      </div>

      <div className="sg-group">
        <div className="sg-group-title">Cards</div>
        <div className="card-grid">
          <div className="card">
            <h3 className="sg-card-title">Default Card</h3>
            <p className="placeholder-text">The global <code>.card</code> class gives you a neumorphic convex surface with <code>--shadow-neu</code>. Hover lifts the shadow.</p>
          </div>
          <div className="card">
            <div className="sg-track-row">
              <div className="sg-track-art" />
              <div className="sg-track-info">
                <span className="sg-track-title">Track Name</span>
                <span className="sg-track-artist">Artist — Album</span>
              </div>
              <button className="btn btn-ghost btn-sm">Play</button>
            </div>
            <div className="sg-track-row sg-track-row--active">
              <div className="sg-track-art sg-track-art--accent" />
              <div className="sg-track-info">
                <span className="sg-track-title" style={{ color: 'var(--color-primary-light)' }}>Active Track</span>
                <span className="sg-track-artist">Playing Now</span>
              </div>
              <button className="btn btn-primary btn-sm">Pause</button>
            </div>
          </div>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="sg-group-title" style={{ marginBottom: 0 }}>Action Card</div>
            <p className="placeholder-text" style={{ margin: 0 }}>Cards can contain any layout including controls.</p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-primary btn-sm">Confirm</button>
              <button className="btn btn-ghost btn-sm">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Spacing tab ───────────────────────────────────────────────────────────────

function SpacingTab({ overrides, setOverride }: { overrides: Record<string, string>; setOverride: (k: string, v: string) => void }) {
  const RADIUS_CONTROLS = [
    { cssVar: '--radius-sm', label: 'Radius SM', default: 8,  min: 0, max: 20  },
    { cssVar: '--radius',    label: 'Radius',    default: 14, min: 0, max: 32  },
    { cssVar: '--radius-lg', label: 'Radius LG', default: 20, min: 0, max: 40  },
  ];

  function getValue(cssVar: string, def: number): number {
    const override = overrides[cssVar];
    if (override) return parseFloat(override);
    const computed = getCssVar(cssVar);
    return parseFloat(computed) || def;
  }

  return (
    <div className="sg-section">
      <div className="sg-group">
        <div className="sg-group-title">Border Radius</div>
        <div className="sg-radius-grid">
          {RADIUS_CONTROLS.map(({ cssVar, label, default: def, min, max }) => {
            const val = getValue(cssVar, def);
            return (
              <div key={cssVar} className="sg-radius-item">
                <div className="sg-radius-preview" style={{ borderRadius: `${val}px` }} />
                <div className="sg-radius-controls">
                  <div className="sg-label-row">
                    <code className="sg-label">{cssVar}</code>
                    <span className="sg-radius-val">{val}px</span>
                  </div>
                  <label className="sg-label" style={{ marginBottom: '0.4rem' }}>{label}</label>
                  <input type="range" min={min} max={max} step={1} value={val}
                    className="sg-range"
                    onChange={e => setOverride(cssVar, `${e.target.value}px`)}
                  />
                  <div className="sg-range-ticks">
                    <span>{min}px</span>
                    <span>{max}px</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="sg-group">
        <div className="sg-group-title">Radius Applied</div>
        <div className="sg-radius-demo-row">
          {[
            { cssVar: '--radius-sm', label: 'SM — inputs, tags' },
            { cssVar: '--radius',    label: 'Base — buttons, cards' },
            { cssVar: '--radius-lg', label: 'LG — modals, panels' },
          ].map(({ cssVar, label }) => {
            const val = getValue(cssVar, 0);
            return (
              <div key={cssVar} className="sg-radius-demo-item" style={{ borderRadius: `${val}px` }}>
                <span className="sg-radius-demo-label">{label}</span>
                <code className="sg-neu-var">var({cssVar})</code>
                <code className="sg-neu-var">{val}px</code>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

function StyleGuide() {
  const [tab, setTab] = useState<Tab>('typography');
  const { overrides, setOverride, resetAll } = useStyle();
  const { accentColor, setAccentColor, setCustomAccentHex } = useAppearance();

  return (
    <div className="page sg-page">
      <div className="sg-header">
        <h1 className="page-title" style={{ marginBottom: 0 }}>Style Guide</h1>
        <button className="btn btn-ghost btn-sm" onClick={resetAll} type="button">
          <RotateCcw size={13} strokeWidth={2} />
          Reset All
        </button>
      </div>

      <div className="sg-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`sg-tab${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
            type="button"
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'typography' && (
        <TypographyTab overrides={overrides} setOverride={setOverride} />
      )}
      {tab === 'colors' && (
        <ColorsTab
          overrides={overrides}
          setOverride={setOverride}
          accentColor={accentColor}
          setAccentColor={setAccentColor}
          setCustomAccentHex={setCustomAccentHex}
        />
      )}
      {tab === 'neumorphic' && <NeumorphicTab />}
      {tab === 'components' && <ComponentsTab />}
      {tab === 'spacing' && (
        <SpacingTab overrides={overrides} setOverride={setOverride} />
      )}
    </div>
  );
}

export default StyleGuide;
