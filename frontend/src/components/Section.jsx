export default function Section({ label, children }) {
  return (
    <div style={{ marginTop: '2rem' }}>
      <p style={{
        fontSize: '0.75rem',
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
        color: '#444',
        marginBottom: '0.75rem',
      }}>
        {label}
      </p>
      {children}
    </div>
  )
}
