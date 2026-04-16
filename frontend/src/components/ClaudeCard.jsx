function fmtTokens(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`
  return `${n}`
}

function shortModel(model) {
  if (!model) return '—'
  return model.replace('claude-', '').replace(/-(\d+)-(\d+)$/, ' $1.$2')
    .split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

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

export default function ClaudeCard({ sessions, plan }) {
  const hasPlan   = plan && plan.available
  const hasTokens = sessions && sessions.length > 0

  return (
    <div className="claude-card">

      {/* Plan usage bars */}
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

      {/* Token counts */}
      {hasTokens && sessions.map(s => (
        <div key={s.sessionId} className="claude-tokens">
          <span className="claude-model">{shortModel(s.model)}</span>
          <div className="token-grid">
            <span className="token-val">{fmtTokens(s.input_tokens)}</span>
            <span className="token-val" style={{ color: 'var(--blue)' }}>{fmtTokens(s.output_tokens)}</span>
            <span className="token-val" style={{ color: 'var(--yellow)' }}>{fmtTokens(s.cache_read_input_tokens)}</span>
            <span className="token-val" style={{ color: 'var(--orange)' }}>{fmtTokens(s.cache_creation_input_tokens)}</span>
            <span className="token-lbl">IN</span>
            <span className="token-lbl">OUT</span>
            <span className="token-lbl">C.READ</span>
            <span className="token-lbl">C.WRITE</span>
          </div>
        </div>
      ))}

      {!hasPlan && !hasTokens && (
        <div className="claude-empty">NO ACTIVE CLAUDE CODE SESSION</div>
      )}
    </div>
  )
}
