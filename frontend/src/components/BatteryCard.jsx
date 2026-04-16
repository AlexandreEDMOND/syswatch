function fmtTime(secs) {
  if (secs <= 0) return null
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`
}

export default function BatteryCard({ data }) {
  if (!data) {
    return <div className="battery-unavail">AC POWER — NO BATTERY</div>
  }

  const pct = data.percent
  const warn = pct < 20 && !data.plugged
  const color = warn ? 'var(--red)' : data.plugged ? 'var(--blue)' : 'var(--accent)'
  const status = data.plugged ? 'CHARGING' : 'ON BATTERY'
  const timeLeft = !data.plugged && data.secs_left > 0 ? fmtTime(data.secs_left) : null

  return (
    <div className="battery-card">
      <div className="battery-main">
        <span className="battery-pct" style={{ color }}>
          {pct.toFixed(0)}<span className="unit">%</span>
        </span>
        <div className="battery-info">
          <div className="battery-status" style={{ color }}>{status}</div>
          {timeLeft && <div className="battery-time">{timeLeft} LEFT</div>}
        </div>
      </div>
      <div className="battery-bar-wrap">
        <div className="battery-bar-track">
          <div
            className="battery-bar-fill"
            style={{
              width: `${pct}%`,
              background: color,
              boxShadow: `0 0 6px ${color}55`,
            }}
          />
        </div>
        <span className="battery-nub" style={{ background: color }} />
      </div>
    </div>
  )
}
