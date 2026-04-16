const TITLES = {
  cpu: 'CPU detail',
  memory: 'Memory detail',
  network: 'Network detail',
  battery: 'Battery detail',
  storage: 'Storage detail',
  power: 'Power detail',
  claude: 'Claude Code detail',
}

export default function DetailPlaceholder({ section, onBack }) {
  const title = TITLES[section] ?? 'Detail'

  return (
    <div className="detail-page">
      <div className="scanlines" />

      <header className="detail-header">
        <div className="detail-header-title">
          <span className="logo">SYSWATCH</span>
          <span className="live-dot" />
          <span className="live-label">DETAIL</span>
        </div>

        <button type="button" className="detail-back" onClick={onBack}>
          Retour a l'accueil
        </button>
      </header>

      <main className="detail-shell">
        <div className="detail-panel">
          <p className="detail-kicker">{title}</p>
          <h1 className="detail-title">En construction</h1>
          <p className="detail-copy">
            Cette vue detaillee arrive bientot. Revenez a l’accueil pour continuer le monitoring en direct.
          </p>
          <button type="button" className="detail-cta" onClick={onBack}>
            Revenir au dashboard
          </button>
        </div>
      </main>
    </div>
  )
}
