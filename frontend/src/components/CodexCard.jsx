function PlanBar({ label, pct, resets, color }) {
  const filled = Math.min(100, pct)
  const warn = pct >= 80

  return (
    <div className="plan-bar-row">
      <div className="plan-bar-header">
        <span className="plan-bar-label">{label}</span>
        <span className="plan-bar-pct" style={{ color: warn ? 'var(--red)' : color }}>
          {pct}<span className="unit">%</span>
        </span>
      </div>
      <div className="plan-bar-track">
        <div
          className="plan-bar-fill"
          style={{
            width: `${filled}%`,
            background: warn ? 'var(--red)' : color,
            boxShadow: `0 0 6px ${warn ? 'var(--red)' : color}44`,
            minWidth: pct > 0 ? '2px' : '0',
          }}
        />
      </div>
      {resets && <span className="plan-bar-resets">Resets {resets}</span>}
    </div>
  )
}

function fmtResets(ts) {
  if (!ts) return null
  const d = new Date(ts * 1000)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' }) +
    ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export default function CodexCard({ data }) {
  const session = data?.[0]

  if (!session) {
    return (
      <div className="claude-card">
        <div className="claude-empty">NO CODEX SESSION DATA</div>
      </div>
    )
  }

  const primaryUsed = 100 - (session.primary_pct ?? 0)
  const secondaryUsed = 100 - (session.secondary_pct ?? 0)

  return (
    <div className="claude-card">
      <div className="plan-section">
        <PlanBar
          label="5h limit"
          pct={primaryUsed}
          resets={fmtResets(session.primary_resets_at)}
          color="var(--yellow)"
        />
        <PlanBar
          label="Weekly"
          pct={secondaryUsed}
          resets={fmtResets(session.secondary_resets_at)}
          color="var(--orange)"
        />
        {session.model && (
          <span className="plan-bar-resets" style={{ marginTop: '2px' }}>
            {session.model} · {session.plan_type}
          </span>
        )}
      </div>
    </div>
  )
}
