import { useRef } from 'react'
import ChartCard from './ChartCard'

const THERMAL_LEVELS = {
  Nominal: { color: 'var(--accent)', label: 'Nominal', score: 25, detail: 'Aucune contrainte thermique visible.' },
  Moderate: { color: 'var(--yellow)', label: 'Moderate', score: 55, detail: 'La machine chauffe mais reste confortable.' },
  Heavy: { color: 'var(--orange)', label: 'Heavy', score: 82, detail: 'Charge thermique elevee, marge reduite.' },
  Tripping: { color: 'var(--red)', label: 'Tripping', score: 100, detail: 'Throttling ou seuil critique approche.' },
}

function fmtW(mw) {
  if (mw == null) return '—'
  const value = Math.abs(mw)
  if (value >= 1000) return `${(mw / 1000).toFixed(2)} W`
  return `${mw} mW`
}

function fmtCurrent(ma) {
  if (ma == null) return '—'
  return `${ma} mA`
}

function fmtVoltage(mv) {
  if (mv == null) return '—'
  return `${(mv / 1000).toFixed(2)} V`
}

function fmtTemp(raw, celsius) {
  if (raw == null) return '—'
  if (celsius == null) return `${raw} raw`
  return `${celsius.toFixed(2)} C`
}

function fmtMinutes(minutes) {
  if (minutes == null || minutes < 0) return '—'
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours > 0) return `${hours}h${String(mins).padStart(2, '0')}`
  return `${mins} min`
}

function createSingleSeries(series) {
  return {
    labels: series.labels,
    datasets: [series.values],
  }
}

export default function PowerDetail({ power, batteryDetails, thermalSeries, combinedSeries, batteryTempSeries, onBack }) {
  const thermalRef = useRef(null)
  const combinedRef = useRef(null)
  const batteryTempRef = useRef(null)

  const thermal = THERMAL_LEVELS[power?.thermal_pressure] ?? THERMAL_LEVELS.Nominal
  const batteryAvailable = batteryDetails?.available
  const batteryHealthPct = batteryAvailable && batteryDetails.design_capacity_mah
    ? Math.round((batteryDetails.nominal_charge_capacity_mah / batteryDetails.design_capacity_mah) * 100)
    : null

  return (
    <div className="detail-page">
      <div className="scanlines" />

      <header className="detail-header">
        <div className="detail-header-title">
          <span className="logo">SYSWATCH</span>
          <span className="live-dot" />
          <span className="live-label">POWER DETAIL</span>
        </div>

        <button type="button" className="detail-back" onClick={onBack}>
          Retour a l'accueil
        </button>
      </header>

      <main className="power-detail-shell">
        <section className="power-hero detail-panel">
          <div className="power-hero-main">
            <p className="detail-kicker">Thermal signals</p>
            <h1 className="detail-title power-detail-title">{thermal.label}</h1>
            <p className="detail-copy power-detail-copy">
              {thermal.detail} Ici on affiche les signaux thermiques exploitables du M5, meme quand macOS ne donne pas de temperature CPU/GPU en degres.
            </p>
          </div>

          <div className="power-hero-stats">
            <div className="power-stat-tile">
              <span className="power-stat-label">Combined</span>
              <span className="power-stat-value">{fmtW(power?.combined_mw)}</span>
            </div>
            <div className="power-stat-tile">
              <span className="power-stat-label">Battery power</span>
              <span className="power-stat-value">{fmtW(batteryDetails?.battery_power_mw)}</span>
            </div>
            <div className="power-stat-tile">
              <span className="power-stat-label">Battery temp</span>
              <span className="power-stat-value">{fmtTemp(batteryDetails?.temperature_raw, batteryDetails?.temperature_c)}</span>
            </div>
            <div className="power-stat-tile">
              <span className="power-stat-label">Current</span>
              <span className="power-stat-value">{fmtCurrent(batteryDetails?.instant_amperage_ma)}</span>
            </div>
          </div>
        </section>

        <section className="power-detail-grid">
          <div className="detail-panel power-chart-card">
            <div className="power-chart-header">
              <p className="detail-kicker">Thermal pressure</p>
              <span className="power-chart-meta" style={{ color: thermal.color }}>{power?.thermal_pressure ?? 'Unknown'}</span>
            </div>
            <div className="power-chart-wrap">
              <ChartCard
                chartRef={thermalRef}
                id="power-thermal-score"
                color={thermal.color}
                yMax={100}
                initialData={createSingleSeries(thermalSeries)}
                tooltipSuffix=""
              />
            </div>
          </div>

          <div className="detail-panel power-chart-card">
            <div className="power-chart-header">
              <p className="detail-kicker">Combined power</p>
              <span className="power-chart-meta">{fmtW(power?.combined_mw)}</span>
            </div>
            <div className="power-chart-wrap">
              <ChartCard
                chartRef={combinedRef}
                id="power-combined"
                color="--accent"
                yMax={15000}
                initialData={createSingleSeries(combinedSeries)}
                tooltipSuffix=" mW"
              />
            </div>
          </div>

          <div className="detail-panel power-chart-card">
            <div className="power-chart-header">
              <p className="detail-kicker">Battery temperature</p>
              <span className="power-chart-meta">{fmtTemp(batteryDetails?.temperature_raw, batteryDetails?.temperature_c)}</span>
            </div>
            <div className="power-chart-wrap">
              <ChartCard
                chartRef={batteryTempRef}
                id="battery-temp"
                color="--blue"
                yMax={60}
                initialData={createSingleSeries(batteryTempSeries)}
                tooltipSuffix=" C"
              />
            </div>
          </div>

          <div className="detail-panel power-signals-card">
            <p className="detail-kicker">Live signals</p>
            <div className="power-signals-grid">
              <div className="power-signal-row">
                <span className="power-signal-key">CPU rail</span>
                <span className="power-signal-val">{fmtW(power?.cpu_mw)}</span>
              </div>
              <div className="power-signal-row">
                <span className="power-signal-key">GPU rail</span>
                <span className="power-signal-val">{fmtW(power?.gpu_mw)}</span>
              </div>
              <div className="power-signal-row">
                <span className="power-signal-key">ANE rail</span>
                <span className="power-signal-val">{fmtW(power?.ane_mw)}</span>
              </div>
              <div className="power-signal-row">
                <span className="power-signal-key">Thermal state</span>
                <span className="power-signal-val" style={{ color: thermal.color }}>{thermal.label}</span>
              </div>
              <div className="power-signal-row">
                <span className="power-signal-key">Battery raw temp</span>
                <span className="power-signal-val">{batteryDetails?.temperature_raw ?? '—'}</span>
              </div>
              <div className="power-signal-row">
                <span className="power-signal-key">Virtual temp</span>
                <span className="power-signal-val">{fmtTemp(batteryDetails?.virtual_temperature_raw, batteryDetails?.virtual_temperature_c)}</span>
              </div>
              <div className="power-signal-row">
                <span className="power-signal-key">Battery voltage</span>
                <span className="power-signal-val">{fmtVoltage(batteryDetails?.voltage_mv)}</span>
              </div>
              <div className="power-signal-row">
                <span className="power-signal-key">Battery current</span>
                <span className="power-signal-val">{fmtCurrent(batteryDetails?.amperage_ma)}</span>
              </div>
              <div className="power-signal-row">
                <span className="power-signal-key">Remaining</span>
                <span className="power-signal-val">{fmtMinutes(batteryDetails?.time_remaining_min)}</span>
              </div>
              <div className="power-signal-row">
                <span className="power-signal-key">Cycles</span>
                <span className="power-signal-val">{batteryDetails?.cycle_count ?? '—'}</span>
              </div>
              <div className="power-signal-row">
                <span className="power-signal-key">Health proxy</span>
                <span className="power-signal-val">{batteryHealthPct != null ? `${batteryHealthPct}%` : '—'}</span>
              </div>
              <div className="power-signal-row">
                <span className="power-signal-key">State</span>
                <span className="power-signal-val">
                  {batteryAvailable
                    ? batteryDetails.is_charging
                      ? 'Charging'
                      : batteryDetails.external_connected
                        ? 'AC idle'
                        : 'Discharging'
                    : 'Unavailable'}
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
