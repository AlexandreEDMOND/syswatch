function fmt(bytes) {
  const gb = bytes / 1e9
  if (gb >= 1) return `${gb.toFixed(1)} GB`
  return `${(bytes / 1e6).toFixed(0)} MB`
}

export default function DiskCard({ data }) {
  const pct = Math.round((data.used / data.total) * 100)
  const warn = pct > 80
  const fillColor = warn ? 'var(--red)' : 'var(--accent)'

  return (
    <div className="disk-card">
      <div className="disk-header">
        <span className="disk-label">{data.label}</span>
        <span className="disk-pct" style={{ color: warn ? 'var(--red)' : 'var(--accent-dim)' }}>{pct}%</span>
      </div>
      <div className="disk-bar-track">
        <div
          className="disk-bar-fill"
          style={{
            width: `${pct}%`,
            background: warn
              ? 'linear-gradient(90deg, #ff2040, #ff6060)'
              : 'linear-gradient(90deg, var(--accent-dim), var(--accent))',
            boxShadow: warn ? '0 0 4px #ff204055' : '0 0 4px #00ff6e33',
          }}
        />
      </div>
      <div className="disk-stats">
        <span>{fmt(data.used)} used</span>
        <span>{fmt(data.free)} free</span>
        <span>{fmt(data.total)} total</span>
      </div>
    </div>
  )
}
