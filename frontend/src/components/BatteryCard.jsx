export default function BatteryCard({ data }) {
  if (!data) {
    return <div className="battery-unavail">AC POWER — NO BATTERY</div>
  }

  const pct = data.percent
  const warn = pct < 20 && !data.plugged
  const color = warn ? 'var(--red)' : data.plugged ? 'var(--blue)' : 'var(--accent)'
  const status = data.plugged ? 'CHARGING' : 'ON BATTERY'

  return (
    <div className="battery-inline">
      <span className="battery-pct-sm" style={{ color }}>{pct.toFixed(0)}<span className="unit">%</span></span>
      <span className="battery-status-sm" style={{ color }}>{status}</span>
    </div>
  )
}
