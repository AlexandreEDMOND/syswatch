const cardStyle = {
  background: '#1a1a1a',
  border: '1px solid #2a2a2a',
  borderRadius: '10px',
  padding: '1.2rem 1.5rem',
  marginBottom: '1rem',
}

function fmt(bytes) {
  const gb = bytes / 1e9
  if (gb >= 1) return `${gb.toFixed(1)} Go`
  return `${(bytes / 1e6).toFixed(0)} Mo`
}

export default function DiskCard({ data }) {
  const pct = Math.round((data.used / data.total) * 100)
  const warn = pct > 80
  const fillColor = warn
    ? 'linear-gradient(90deg, #f7a24f, #f75f5f)'
    : 'linear-gradient(90deg, #4f8ef7, #a78bfa)'

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.8rem' }}>
        <span style={{ fontSize: '0.95rem', color: '#fff', fontWeight: 600 }}>{data.label}</span>
        <span style={{ fontSize: '0.82rem', color: '#555' }}>{data.mount}</span>
      </div>
      <div style={{ background: '#2a2a2a', borderRadius: '999px', height: '10px', overflow: 'hidden', marginBottom: '0.6rem' }}>
        <div style={{ height: '100%', borderRadius: '999px', background: fillColor, width: `${pct}%`, transition: 'width 0.5s ease' }} />
      </div>
      <div style={{ fontSize: '0.82rem', color: '#888', display: 'flex', justifyContent: 'space-between' }}>
        <span>Utilisé : <b style={{ color: '#ccc' }}>{fmt(data.used)}</b></span>
        <span>Libre : <b style={{ color: '#ccc' }}>{fmt(data.free)}</b></span>
        <span>Total : <b style={{ color: '#ccc' }}>{fmt(data.total)}</b></span>
        <b style={{ color: '#ccc' }}>{pct}%</b>
      </div>
    </div>
  )
}
