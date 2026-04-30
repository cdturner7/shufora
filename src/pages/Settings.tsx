import { useAppearance, type Theme, type AccentColor } from '../context/AppearanceContext';

const THEMES: { value: Theme; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'dark',   label: 'Dark' },
  { value: 'light',  label: 'Light' },
];

const ACCENTS: { value: AccentColor; label: string; color: string }[] = [
  { value: 'amber',  label: 'Amber',  color: '#C07C3A' },
  { value: 'purple', label: 'Purple', color: '#6B52C0' },
  { value: 'blue',   label: 'Blue',   color: '#3A7EC0' },
  { value: 'teal',   label: 'Teal',   color: '#2A9E8E' },
  { value: 'green',  label: 'Green',  color: '#3A8C5A' },
  { value: 'rose',   label: 'Rose',   color: '#C04060' },
];

function Settings() {
  const { theme, accentColor, setTheme, setAccentColor } = useAppearance();

  return (
    <div className="page">
      <h1 className="page-title">Settings</h1>

      <div className="card">
        <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
          Appearance
        </h3>

        <div className="form-group">
          <label className="form-label">Theme</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {THEMES.map((t) => (
              <button
                key={t.value}
                className={`btn btn-sm ${theme === t.value ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setTheme(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Accent Color</label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {ACCENTS.map((a) => (
              <button
                key={a.value}
                onClick={() => setAccentColor(a.value)}
                title={a.label}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: a.color,
                  border: accentColor === a.value ? '2px solid var(--color-text)' : '2px solid transparent',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s, transform 0.15s',
                  transform: accentColor === a.value ? 'scale(1.15)' : 'scale(1)',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;
