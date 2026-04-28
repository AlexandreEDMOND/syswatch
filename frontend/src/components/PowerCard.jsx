const THERMAL_LEVELS = {
  Nominal: { color: 'var(--accent)', label: 'NOMINAL' },
  Moderate: { color: 'var(--yellow)', label: 'MODERATE' },
  Heavy: { color: 'var(--orange)', label: 'HEAVY' },
  Tripping: { color: 'var(--red)', label: 'THROTTLING' },
}

function fmtPower(mw) {
  if (mw == null || Number.isNaN(mw)) return '-'
  return `${(mw / 1000).toFixed(2)} W`
}

function fmtTemp(celsius) {
  if (celsius == null || Number.isNaN(celsius)) return '-'
  return `${celsius.toFixed(1)} C`
}

function fmtCoverage(seconds, totalSeconds) {
  if (!seconds) return 'collecte en attente'

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const totalHours = Math.floor(totalSeconds / 3600)

  if (seconds >= totalSeconds) return `${totalHours}h completes`
  return `collecte ${hours}h${String(minutes).padStart(2, '0')} / ${totalHours}h`
}

function Metric({ label, value, meta, accent = 'var(--text-bright)' }) {
  return (
    <div className="power-metric-card">
      <span className="power-metric-label">{label}</span>
      <span className="power-metric-value" style={{ color: accent }}>{value}</span>
      <span className="power-metric-meta">{meta}</span>
    </div>
  )
}

export default function PowerCard({ power, batteryDetails }) {
  const thermal = THERMAL_LEVELS[power?.thermal_pressure] ?? THERMAL_LEVELS.Nominal
  const coverageSec = power?.rolling_avg_14h_coverage_sec ?? 0
  const totalWindowSec = power?.rolling_avg_14h_window_sec ?? 14 * 60 * 60
  const avgAvailable = Boolean(power?.rolling_avg_14h_available)
  const instantAvailable = Boolean(power?.available)
  const rails = [
    { label: 'CPU', mw: power?.cpu_mw ?? null, color: 'var(--accent)' },
    { label: 'GPU', mw: power?.gpu_mw ?? null, color: 'var(--blue)' },
    { label: 'ANE', mw: power?.ane_mw ?? null, color: 'var(--yellow)' },
  ]

  const avgMeta = avgAvailable
    ? fmtCoverage(coverageSec, totalWindowSec)
    : 'fenetre 14h en cours'

  const instantMeta = instantAvailable
    ? 'lecture live combinee'
    : 'powermetrics via sudo requis'

  const railAvailable = instantAvailable && rails.some(({ mw }) => mw != null)

  return (
    <div className="power-card">
      <div className="power-hero">
        <div className="power-hero-copy">
          <span className="power-thermal" style={{ color: thermal.color }}>
            {thermal.label}
          </span>
          <span className="power-temp-label">Temperature MacBook</span>
          <span className="power-temp-value">{fmtTemp(batteryDetails?.temperature_c)}</span>
          <span className="power-temp-meta">
            {batteryDetails?.available ? 'sonde batterie AppleSmartBattery' : 'temperature indisponible'}
          </span>
        </div>
      </div>

      <div className="power-metrics-grid">
        <Metric
          label="Moyenne 14h"
          value={avgAvailable ? fmtPower(power?.rolling_avg_14h_mw) : '-'}
          meta={avgMeta}
          accent="var(--accent)"
        />
        <Metric
          label="Instantanee"
          value={instantAvailable ? fmtPower(power?.combined_mw) : '-'}
          meta={instantMeta}
          accent={thermal.color}
        />
      </div>

      <div className="power-footer">
        <span className="power-footer-label">Rails</span>
        {railAvailable ? (
          <div className="power-rail-list">
            {rails.map(({ label, mw, color }) => (
              <div key={label} className="power-rail-chip">
                <span className="power-rail-name">{label}</span>
                <span className="power-rail-value" style={{ color }}>
                  {fmtPower(mw)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="power-unavail">
            demarrer avec <span style={{ color: 'var(--accent)' }}>sudo</span> pour l'instantane
          </div>
        )}
      </div>
    </div>
  )
}
