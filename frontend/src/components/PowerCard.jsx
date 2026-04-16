function fmtW(mw) {
  if (mw >= 1000) return `${(mw / 1000).toFixed(1)} W`
  return `${mw} mW`
}

const THERMAL_LEVELS = {
  Nominal:  { color: 'var(--accent)',  label: 'NOMINAL' },
  Moderate: { color: 'var(--yellow)',  label: 'MODERATE' },
  Heavy:    { color: 'var(--orange)',  label: 'HEAVY' },
  Tripping: { color: 'var(--red)',     label: 'THROTTLING' },
}

// Heuristique : M5 Air TDP ≈ 15 W max sous charge
const MAX_MW = 15000

export default function PowerCard({ data }) {
  if (!data || !data.available) {
    return (
      <div className="power-unavail">
        DÉMARRER AVEC <span style={{ color: 'var(--accent)' }}>sudo</span> POUR LES DONNÉES DE PUISSANCE
      </div>
    )
  }

  const bars = [
    { label: 'CPU', mw: data.cpu_mw, color: 'var(--accent)' },
    { label: 'GPU', mw: data.gpu_mw, color: 'var(--blue)'   },
    { label: 'ANE', mw: data.ane_mw, color: 'var(--yellow)' },
  ]

  const combinedW = (data.combined_mw / 1000).toFixed(2)
  const thermal = THERMAL_LEVELS[data.thermal_pressure] ?? THERMAL_LEVELS.Nominal

  return (
    <div className="power-card">
      <div className="power-total">
        <span className="power-total-val">{combinedW}<span className="unit"> W</span></span>
        <span className="power-total-label">TOTAL</span>
        <span className="power-thermal" style={{ color: thermal.color }}>
          {thermal.label}
        </span>
      </div>

      <div className="power-bars">
        {bars.map(({ label, mw, color }) => {
          const pct = Math.min(100, Math.round(mw / MAX_MW * 100))
          return (
            <div key={label} className="power-bar-row">
              <span className="power-bar-label">{label}</span>
              <div className="power-bar-track">
                <div
                  className="power-bar-fill"
                  style={{
                    width: `${pct}%`,
                    background: color,
                    boxShadow: `0 0 6px ${color}44`,
                    minWidth: mw > 0 ? '2px' : '0',
                  }}
                />
              </div>
              <span className="power-bar-val" style={{ color }}>{fmtW(mw)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
