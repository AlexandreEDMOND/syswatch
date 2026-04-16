function fmtTokens(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`
  return `${n}`
}

function shortModel(model) {
  if (!model) return '—'
  // "claude-sonnet-4-6" → "Sonnet 4.6"
  const m = model.replace('claude-', '').replace(/-(\d+)-(\d+)$/, ' $1.$2')
  return m.charAt(0).toUpperCase() + m.slice(1)
}

export default function ClaudeCard({ sessions }) {
  if (!sessions || sessions.length === 0) {
    return (
      <div className="claude-empty">
        NO ACTIVE CLAUDE CODE SESSION
      </div>
    )
  }

  return (
    <div className="claude-sessions">
      {sessions.map(s => {
        const total = s.input_tokens + s.output_tokens + s.cache_creation_input_tokens + s.cache_read_input_tokens
        const shortId = s.sessionId.slice(-8)
        const projectName = s.cwd.split('/').pop()

        return (
          <div key={s.sessionId} className="claude-session">
            <div className="claude-meta">
              <span className="claude-model">{shortModel(s.model)}</span>
              <span className="claude-project">{projectName}</span>
              <span className="claude-id">#{shortId}</span>
            </div>
            <div className="claude-metrics">
              <div className="claude-metric">
                <span className="claude-metric-val">{fmtTokens(s.input_tokens)}</span>
                <span className="claude-metric-label">INPUT</span>
              </div>
              <div className="claude-metric">
                <span className="claude-metric-val" style={{ color: 'var(--blue)' }}>{fmtTokens(s.output_tokens)}</span>
                <span className="claude-metric-label">OUTPUT</span>
              </div>
              <div className="claude-metric">
                <span className="claude-metric-val" style={{ color: 'var(--yellow)' }}>{fmtTokens(s.cache_read_input_tokens)}</span>
                <span className="claude-metric-label">CACHE READ</span>
              </div>
              <div className="claude-metric">
                <span className="claude-metric-val" style={{ color: 'var(--orange)' }}>{fmtTokens(s.cache_creation_input_tokens)}</span>
                <span className="claude-metric-label">CACHE WRITE</span>
              </div>
              <div className="claude-metric">
                <span className="claude-metric-val" style={{ color: 'var(--text-bright)' }}>{fmtTokens(total)}</span>
                <span className="claude-metric-label">TOTAL</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
