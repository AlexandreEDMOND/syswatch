function PlanBar({ label, pct, resets, color }) {
  const filled = Math.min(100, pct)
  const warn   = pct >= 80

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

function CodexPlanBar({ label, pct, resets, color }) {
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

function fmtCodexReset(ts) {
  if (!ts) return null
  const d = new Date(ts * 1000)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

export default function ClaudeCard({ sessions, plan, codex }) {
  const hasPlan = plan && plan.available
  const codexSession = codex?.[0]
  const hasCodex = !!codexSession
  const codexPrimaryUsed = hasCodex ? 100 - (codexSession.primary_pct ?? 0) : 0
  const codexSecondaryUsed = hasCodex ? 100 - (codexSession.secondary_pct ?? 0) : 0

  return (
    <div className="claude-card">
      <div className="assistant-mini-block">
        <div className="assistant-mini-header">
          <span className="assistant-mini-title">Claude Code</span>
          <span className="assistant-mini-meta">{sessions?.length ?? 0} session{(sessions?.length ?? 0) > 1 ? 's' : ''}</span>
        </div>
        {hasPlan ? (
          <div className="plan-section">
            <PlanBar
              label="Session"
              pct={plan.session_pct}
              resets={plan.session_resets}
              color="var(--accent)"
            />
            <PlanBar
              label="Week"
              pct={plan.week_pct}
              resets={plan.week_resets}
              color="var(--blue)"
            />
            {plan.budget > 0 && (
              <div className="plan-extra">
                <PlanBar
                  label="Extra"
                  pct={plan.extra_pct}
                  resets={plan.extra_resets}
                  color="var(--orange)"
                />
                <span className="plan-spent">
                  ${plan.spent.toFixed(2)} / ${plan.budget.toFixed(2)} spent
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="plan-loading">
            {plan && plan.error
              ? <span style={{ color: 'var(--red)', fontSize: '0.55rem' }}>plan: {plan.error}</span>
              : <span>FETCHING PLAN USAGE…</span>
            }
          </div>
        )}
      </div>

      <div className="assistant-mini-block assistant-mini-block-codex">
        <div className="assistant-mini-header">
          <span className="assistant-mini-title">Codex</span>
          <span className="assistant-mini-meta">{hasCodex ? (codexSession.plan_type ?? 'active') : 'no data'}</span>
        </div>
        {hasCodex ? (
          <div className="plan-section">
            <CodexPlanBar
              label="5h limit"
              pct={codexPrimaryUsed}
              resets={fmtCodexReset(codexSession.primary_resets_at)}
              color="var(--yellow)"
            />
            <CodexPlanBar
              label="Weekly"
              pct={codexSecondaryUsed}
              resets={fmtCodexReset(codexSession.secondary_resets_at)}
              color="var(--orange)"
            />
          </div>
        ) : (
          <div className="claude-empty">NO CODEX SESSION DATA</div>
        )}
      </div>
    </div>
  )
}
