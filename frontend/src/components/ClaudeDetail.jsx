function PlanBar({ label, pct, resets, color }) {
  const filled = Math.min(100, pct ?? 0)
  const warn = (pct ?? 0) >= 80

  return (
    <div className="plan-bar-row">
      <div className="plan-bar-header">
        <span className="plan-bar-label">{label}</span>
        <span className="plan-bar-pct" style={{ color: warn ? 'var(--red)' : color }}>
          {pct ?? 0}<span className="unit">%</span>
        </span>
      </div>
      <div className="plan-bar-track">
        <div
          className="plan-bar-fill"
          style={{
            width: `${filled}%`,
            background: warn ? 'var(--red)' : color,
            boxShadow: `0 0 6px ${warn ? 'var(--red)' : color}44`,
            minWidth: filled > 0 ? '2px' : '0',
          }}
        />
      </div>
      {resets ? <span className="plan-bar-resets">Resets {resets}</span> : null}
    </div>
  )
}

function fmtInt(value) {
  if (value == null || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat('fr-FR').format(value)
}

function fmtResetFallback(rawTs) {
  if (!rawTs) return null

  const d = new Date(Number(rawTs) * 1000)
  if (Number.isNaN(d.getTime())) return null

  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' })
}

export default function ClaudeDetail({ sessions, plan, codex, onBack }) {
  const hasPlan = plan?.available
  const activeSessions = sessions ?? []
  const codexSessions = codex ?? []
  const totals = activeSessions.reduce((acc, session) => ({
    input: acc.input + (session.input_tokens ?? 0),
    output: acc.output + (session.output_tokens ?? 0),
    cacheCreate: acc.cacheCreate + (session.cache_creation_input_tokens ?? 0),
    cacheRead: acc.cacheRead + (session.cache_read_input_tokens ?? 0),
  }), { input: 0, output: 0, cacheCreate: 0, cacheRead: 0 })
  const codexTotals = codexSessions.reduce((acc, session) => ({
    input: acc.input + (session.input_tokens ?? 0),
    output: acc.output + (session.output_tokens ?? 0),
    total: acc.total + (session.total_tokens ?? 0),
  }), { input: 0, output: 0, total: 0 })
  const codexSession = codexSessions[0]
  const codexPrimaryUsed = codexSession ? (codexSession.primary_pct ?? 0) : 0
  const codexSecondaryUsed = codexSession ? (codexSession.secondary_pct ?? 0) : 0
  const codexPrimaryReset = codexSession?.primary_resets ?? fmtResetFallback(codexSession?.primary_resets_at)
  const codexSecondaryReset = codexSession?.secondary_resets ?? fmtResetFallback(codexSession?.secondary_resets_at)

  return (
    <div className="detail-page">
      <div className="scanlines" />

      <header className="detail-header">
        <div className="detail-header-title">
          <span className="logo">SYSWATCH</span>
          <span className="live-dot" />
          <span className="live-label">CLAUDE DETAIL</span>
        </div>

        <button type="button" className="detail-back" onClick={onBack}>
          Retour a l'accueil
        </button>
      </header>

      <main className="power-detail-shell">
        <section className="power-hero detail-panel">
          <div className="power-hero-main">
            <p className="detail-kicker">Assistant usage</p>
            <h1 className="detail-title power-detail-title">{activeSessions.length}</h1>
            <p className="detail-copy power-detail-copy">
              Vue detaillee des usages Claude Code et Codex avec barres de plan, tokens agreges et sessions recentes.
            </p>
          </div>

          <div className="power-hero-stats">
            <div className="power-stat-tile">
              <span className="power-stat-label">Active sessions</span>
              <span className="power-stat-value">{activeSessions.length}</span>
            </div>
            <div className="power-stat-tile">
              <span className="power-stat-label">Input tokens</span>
              <span className="power-stat-value claude-stat-compact">{fmtInt(totals.input)}</span>
            </div>
            <div className="power-stat-tile">
              <span className="power-stat-label">Output tokens</span>
              <span className="power-stat-value claude-stat-compact">{fmtInt(totals.output)}</span>
            </div>
          </div>
        </section>

        <section className="power-detail-grid">
          <div className="detail-panel power-signals-card">
            <p className="detail-kicker">Claude Code usage</p>
            <div className="claude-detail-stack">
              <div className="power-signals-grid claude-usage-grid">
                <div className="power-signal-row">
                  <span className="power-signal-key">Active sessions</span>
                  <span className="power-signal-val">{activeSessions.length}</span>
                </div>
                <div className="power-signal-row">
                  <span className="power-signal-key">Input</span>
                  <span className="power-signal-val">{fmtInt(totals.input)}</span>
                </div>
                <div className="power-signal-row">
                  <span className="power-signal-key">Output</span>
                  <span className="power-signal-val">{fmtInt(totals.output)}</span>
                </div>
                <div className="power-signal-row">
                  <span className="power-signal-key">Cache read</span>
                  <span className="power-signal-val">{fmtInt(totals.cacheRead)}</span>
                </div>
              </div>
              {hasPlan ? (
                <>
                  <PlanBar label="Session" pct={plan.session_pct} resets={plan.session_resets} color="var(--accent)" />
                  <PlanBar label="Week" pct={plan.week_pct} resets={plan.week_resets} color="var(--blue)" />
                </>
              ) : (
                <div className="cpu-empty-state">
                  {plan?.error ? `Plan usage indisponible: ${plan.error}` : 'Plan usage en attente de collecte.'}
                </div>
              )}
              {activeSessions.length === 0 ? (
                <div className="cpu-empty-state">Aucune session Claude Code active detectee.</div>
              ) : null}
            </div>
          </div>

          <div className="detail-panel power-signals-card">
            <p className="detail-kicker">Codex usage</p>
            <div className="claude-detail-stack">
              <div className="power-signals-grid claude-usage-grid">
                <div className="power-signal-row">
                  <span className="power-signal-key">Sessions</span>
                  <span className="power-signal-val">{codexSessions.length}</span>
                </div>
                <div className="power-signal-row">
                  <span className="power-signal-key">Input</span>
                  <span className="power-signal-val">{fmtInt(codexTotals.input)}</span>
                </div>
                <div className="power-signal-row">
                  <span className="power-signal-key">Output</span>
                  <span className="power-signal-val">{fmtInt(codexTotals.output)}</span>
                </div>
                <div className="power-signal-row">
                  <span className="power-signal-key">Total</span>
                  <span className="power-signal-val">{fmtInt(codexTotals.total)}</span>
                </div>
                <div className="power-signal-row">
                  <span className="power-signal-key">Model</span>
                  <span className="power-signal-val">{codexSession?.model ?? '—'}</span>
                </div>
                <div className="power-signal-row">
                  <span className="power-signal-key">Plan</span>
                  <span className="power-signal-val">{codexSession?.plan_type ?? '—'}</span>
                </div>
              </div>
              {codexSession ? (
                <>
                  <PlanBar label="Session" pct={codexPrimaryUsed} resets={codexPrimaryReset} color="var(--accent)" />
                  <PlanBar label="Week" pct={codexSecondaryUsed} resets={codexSecondaryReset} color="var(--blue)" />
                </>
              ) : (
                <div className="cpu-empty-state">
                  Aucune donnee Codex recente detectee.
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
