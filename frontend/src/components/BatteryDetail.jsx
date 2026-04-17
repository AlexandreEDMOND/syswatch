function healthColor(pct) {
  if (pct == null) return 'var(--text-bright)'
  if (pct >= 90) return 'var(--accent)'
  if (pct >= 70) return 'var(--yellow)'
  if (pct >= 50) return 'var(--orange)'
  return 'var(--red)'
}

function fmtPct(v) {
  return v != null ? `${v.toFixed(1)}%` : '—'
}

function fmtMah(v) {
  return v != null ? `${v} mAh` : '—'
}

function fmtVoltage(mv) {
  if (mv == null) return '—'
  return `${(mv / 1000).toFixed(3)} V`
}

function fmtCurrent(ma) {
  if (ma == null) return '—'
  return `${ma} mA`
}

function fmtTemp(c) {
  return c != null ? `${c} °C` : '—'
}

function fmtTime(min) {
  if (min == null || min <= 0 || min === 65535) return '—'
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`
}

function fmtHours(min) {
  if (min == null || min <= 0) return '—'
  const h = (min / 60).toFixed(1)
  return `${h} h`
}

function Row({ label, value, color }) {
  return (
    <div className="power-signal-row">
      <span className="power-signal-key">{label}</span>
      <span className="power-signal-val" style={color ? { color } : undefined}>{value}</span>
    </div>
  )
}

function StatTile({ label, value, color }) {
  return (
    <div className="power-stat-tile">
      <span className="power-stat-label">{label}</span>
      <span className="power-stat-value" style={color ? { color } : undefined}>{value}</span>
    </div>
  )
}

export default function BatteryDetail({ batteryDetails: d, onBack }) {
  const available = d?.available

  const capacityHealth = d?.capacity_health_pct
  const cycleHealth = d?.cycle_health_pct
  const mainHealth = capacityHealth ?? cycleHealth
  const mainColor = healthColor(mainHealth)

  const state = !available
    ? 'Unavailable'
    : d.is_charging
      ? 'Charging'
      : d.external_connected
        ? 'AC idle'
        : 'Discharging'

  const cycleUsedPct = d?.cycle_count != null && d?.design_cycle_count
    ? ((d.cycle_count / d.design_cycle_count) * 100).toFixed(1)
    : null

  return (
    <div className="detail-page">
      <div className="scanlines" />

      <header className="detail-header">
        <div className="detail-header-title">
          <span className="logo">SYSWATCH</span>
          <span className="live-dot" />
          <span className="live-label">BATTERY DETAIL</span>
        </div>
        <button type="button" className="detail-back" onClick={onBack}>
          Retour a l'accueil
        </button>
      </header>

      <main className="power-detail-shell">

        {/* Hero */}
        <section className="power-hero detail-panel">
          <div className="power-hero-main">
            <p className="detail-kicker">Battery health</p>
            <h1 className="detail-title power-detail-title" style={{ color: mainColor }}>
              {mainHealth != null ? `${mainHealth.toFixed(1)}%` : '—'}
            </h1>
            <p className="detail-copy power-detail-copy">
              {available
                ? `${d.device_name ?? 'Battery'} — ${state}. ${d.cycle_count ?? '?'} cycles sur ${d.design_cycle_count ?? '?'} prevus. Capacite messuree : ${fmtMah(d.raw_max_capacity_mah)} sur ${fmtMah(d.design_capacity_mah)} de design.`
                : 'Batterie non disponible ou machine sur secteur.'}
            </p>
          </div>

          <div className="power-hero-stats">
            <StatTile
              label="Capacity health"
              value={fmtPct(capacityHealth)}
              color={healthColor(capacityHealth)}
            />
            <StatTile
              label="Cycle health"
              value={fmtPct(cycleHealth)}
              color={healthColor(cycleHealth)}
            />
            <StatTile
              label="Charge actuelle"
              value={fmtPct(d?.current_capacity_pct)}
            />
            <StatTile
              label="Chargeur"
              value={d?.adapter_watts != null ? `${d.adapter_watts} W` : '—'}
            />
          </div>
        </section>

        {/* 2×2 grid */}
        <section className="power-detail-grid">

          {/* Capacites */}
          <div className="detail-panel power-signals-card">
            <p className="detail-kicker">Capacites</p>
            <div className="power-signals-grid">
              <Row label="Design capacity" value={fmtMah(d?.design_capacity_mah)} />
              <Row label="Max reelle (raw)" value={fmtMah(d?.raw_max_capacity_mah)} />
              <Row label="Full charge (FCC)" value={fmtMah(d?.full_charge_capacity_mah)} />
              <Row label="Nominale" value={fmtMah(d?.nominal_charge_capacity_mah)} />
              <Row label="Max capacity %" value={d?.max_capacity_pct != null ? `${d.max_capacity_pct}%` : '—'} />
              <Row label="Cycles utilises" value={cycleUsedPct != null ? `${cycleUsedPct}%` : '—'} />
              <Row label="Cycles count" value={d?.cycle_count ?? '—'} />
              <Row label="Cycles design" value={d?.design_cycle_count ?? '—'} />
            </div>
          </div>

          {/* Etat live */}
          <div className="detail-panel power-signals-card">
            <p className="detail-kicker">Etat en direct</p>
            <div className="power-signals-grid">
              <Row label="Etat" value={state} color={d?.is_charging ? 'var(--blue)' : d?.external_connected ? 'var(--accent)' : 'var(--orange)'} />
              <Row label="Temps restant" value={fmtTime(d?.time_remaining_min)} />
              <Row label="Tension pack" value={fmtVoltage(d?.voltage_mv)} />
              <Row label="Courant" value={fmtCurrent(d?.amperage_ma)} />
              <Row label="Courant inst." value={fmtCurrent(d?.instant_amperage_ma)} />
              <Row label="Temp batterie" value={fmtTemp(d?.temperature_c)} />
              <Row label="Temp virtuelle" value={fmtTemp(d?.virtual_temperature_c)} />
              <Row label="Tension charge" value={fmtVoltage(d?.charging_voltage_mv)} />
            </div>
          </div>

          {/* Cellules + chargeur */}
          <div className="detail-panel power-signals-card">
            <p className="detail-kicker">Cellules &amp; chargeur</p>
            <div className="power-signals-grid">
              {d?.cell_voltages_mv?.map((v, i) => (
                <Row key={i} label={`Cellule ${i + 1}`} value={fmtVoltage(v)} />
              ))}
              <Row label="Chargeur" value={d?.adapter_watts != null ? `${d.adapter_watts} W` : '—'} />
              <Row label="Tension chargeur" value={fmtVoltage(d?.adapter_voltage_mv)} />
              <Row label="Courant chargeur" value={fmtCurrent(d?.adapter_current_ma)} />
              <Row label="Courant charge" value={fmtCurrent(d?.charging_current_ma)} />
            </div>
          </div>

          {/* Historique de vie */}
          <div className="detail-panel power-signals-card">
            <p className="detail-kicker">Historique de vie</p>
            <div className="power-signals-grid">
              <Row label="Temps utilisation" value={fmtHours(d?.lifetime_operating_time_min)} />
              <Row label="Temp max vie" value={fmtTemp(d?.lifetime_max_temp_c)} />
              <Row label="Temp min vie" value={fmtTemp(d?.lifetime_min_temp_c)} />
              <Row label="Temp moy (raw)" value={d?.lifetime_avg_temp_raw != null ? `${d.lifetime_avg_temp_raw}` : '—'} />
              <Row label="Courant charge max" value={fmtCurrent(d?.lifetime_max_charge_current_ma)} />
              <Row label="Flash writes" value={d?.data_flash_write_count ?? '—'} />
              <Row label="Device" value={d?.device_name ?? '—'} />
            </div>
          </div>

        </section>
      </main>
    </div>
  )
}
