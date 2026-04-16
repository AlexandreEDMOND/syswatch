const cardStyle = {
  background: '#1a1a1a',
  border: '1px solid #2a2a2a',
  borderRadius: '10px',
  padding: '1.2rem 1.5rem',
  marginBottom: '1rem',
}

function fmtTime(secs) {
  if (secs <= 0) return null
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`
}

export default function BatteryCard({ data }) {
  if (!data) {
    return (
      <div style={cardStyle}>
        <span style={{ fontSize: '0.82rem', color: '#555' }}>Non disponible (secteur fixe)</span>
      </div>
    )
  }

  const icon = data.plugged ? '⚡' : data.percent > 20 ? '🔋' : '🪫'
  const status = data.plugged ? 'En charge' : 'Sur batterie'
  const timeLeft = !data.plugged && data.secs_left > 0 ? fmtTime(data.secs_left) : null

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span style={{ fontSize: '1.6rem' }}>{icon}</span>
        <div>
          <div style={{ fontSize: '1.1rem', color: '#fff', fontWeight: 600 }}>
            {data.percent.toFixed(0)}%
          </div>
          <div style={{ fontSize: '0.82rem', color: '#888', marginTop: '2px' }}>
            {status}{timeLeft ? ` — ${timeLeft} restantes` : ''}
          </div>
        </div>
      </div>
    </div>
  )
}
