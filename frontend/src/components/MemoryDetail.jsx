import { useRef } from 'react'
import ChartCard from './ChartCard'

function fmtBytes(bytes) {
  if (bytes == null || Number.isNaN(bytes)) return '—'
  const gb = bytes / 1e9
  if (gb >= 1) return `${gb.toFixed(1)} GB`
  const mb = bytes / 1e6
  return `${mb.toFixed(0)} MB`
}

function fmtPct(value, digits = 1) {
  if (value == null || Number.isNaN(value)) return '—'
  return `${value.toFixed(digits)}%`
}

function pressureLabel(value) {
  if (value == null || Number.isNaN(value)) return 'Unavailable'
  if (value >= 80) return 'Comfortable'
  if (value >= 60) return 'Tight'
  return 'High pressure'
}

function pressureColor(value) {
  if (value == null || Number.isNaN(value)) return 'var(--text-label)'
  if (value >= 80) return 'var(--accent)'
  if (value >= 60) return 'var(--yellow)'
  return 'var(--red)'
}

function createSingleSeries(series) {
  return {
    labels: series?.labels ?? [],
    datasets: [series?.values ?? []],
  }
}

export default function MemoryDetail({ ram, usageSeries, compressedSeries, swapSeries, pressureSeries, onBack }) {
  const usageRef = useRef(null)
  const compressedRef = useRef(null)
  const swapRef = useRef(null)
  const pressureRef = useRef(null)

  const pressure = ram?.memory_pressure_pct
  const pressureState = pressureLabel(pressure)
  const pressureTone = pressureColor(pressure)

  return (
    <div className="detail-page">
      <div className="scanlines" />

      <header className="detail-header">
        <div className="detail-header-title">
          <span className="logo">SYSWATCH</span>
          <span className="live-dot" />
          <span className="live-label">MEMORY DETAIL</span>
        </div>

        <button type="button" className="detail-back" onClick={onBack}>
          Retour a l'accueil
        </button>
      </header>

      <main className="power-detail-shell">
        <section className="power-hero detail-panel">
          <div className="power-hero-main">
            <p className="detail-kicker">Memory telemetry</p>
            <h1 className="detail-title power-detail-title">{fmtPct(ram?.percent)}</h1>
            <p className="detail-copy power-detail-copy">
              Vue detaillee de la RAM avec repartition active, inactive, wired, compression et swap, en gardant exactement le meme rythme visuel que les autres pages detail.
            </p>
          </div>

          <div className="power-hero-stats">
            <div className="power-stat-tile">
              <span className="power-stat-label">Used / total</span>
              <span className="power-stat-value">{fmtBytes(ram?.used)} / {fmtBytes(ram?.total)}</span>
            </div>
            <div className="power-stat-tile">
              <span className="power-stat-label">Available</span>
              <span className="power-stat-value">{fmtBytes(ram?.available)}</span>
            </div>
            <div className="power-stat-tile">
              <span className="power-stat-label">Compressed</span>
              <span className="power-stat-value">{fmtBytes(ram?.compressed)}</span>
            </div>
            <div className="power-stat-tile">
              <span className="power-stat-label">Swap used</span>
              <span className="power-stat-value">{fmtBytes(ram?.swap_used)}</span>
            </div>
          </div>
        </section>

        <section className="power-detail-grid">
          <div className="detail-panel power-chart-card">
            <div className="power-chart-header">
              <p className="detail-kicker">Global usage</p>
              <span className="power-chart-meta">{fmtPct(ram?.percent)}</span>
            </div>
            <div className="power-chart-wrap">
              <ChartCard
                chartRef={usageRef}
                id="memory-detail-usage"
                color="#00d9ff"
                yMax={100}
                initialData={usageSeries}
              />
            </div>
          </div>

          <div className="detail-panel power-chart-card">
            <div className="power-chart-header">
              <p className="detail-kicker">Compressed memory</p>
              <span className="power-chart-meta">{fmtBytes(ram?.compressed)}</span>
            </div>
            <div className="power-chart-wrap">
              <ChartCard
                chartRef={compressedRef}
                id="memory-detail-compressed"
                color="#ffd600"
                yMax={Math.max(2, Math.ceil((ram?.total ?? 0) / 1e9))}
                initialData={createSingleSeries(compressedSeries)}
                tooltipSuffix=" GB"
              />
            </div>
          </div>

          <div className="detail-panel power-chart-card">
            <div className="power-chart-header">
              <p className="detail-kicker">Swap used</p>
              <span className="power-chart-meta">{fmtBytes(ram?.swap_used)}</span>
            </div>
            <div className="power-chart-wrap">
              <ChartCard
                chartRef={swapRef}
                id="memory-detail-swap"
                color="#ff7a00"
                yMax={Math.max(2, Math.ceil((ram?.swap_total ?? 0) / 1e9))}
                initialData={createSingleSeries(swapSeries)}
                tooltipSuffix=" GB"
              />
            </div>
          </div>

          <div className="detail-panel power-chart-card">
            <div className="power-chart-header">
              <p className="detail-kicker">Memory pressure</p>
              <span className="power-chart-meta" style={{ color: pressureTone }}>{pressureState}</span>
            </div>
            <div className="power-chart-wrap">
              <ChartCard
                chartRef={pressureRef}
                id="memory-detail-pressure"
                color="#00ff6e"
                yMax={100}
                initialData={createSingleSeries(pressureSeries)}
              />
            </div>
          </div>

          <div className="detail-panel power-signals-card">
            <p className="detail-kicker">Live signals</p>
            <div className="power-signals-grid">
              <div className="power-signal-row">
                <span className="power-signal-key">Active</span>
                <span className="power-signal-val">{fmtBytes(ram?.active)}</span>
              </div>
              <div className="power-signal-row">
                <span className="power-signal-key">Inactive</span>
                <span className="power-signal-val">{fmtBytes(ram?.inactive)}</span>
              </div>
              <div className="power-signal-row">
                <span className="power-signal-key">Wired</span>
                <span className="power-signal-val">{fmtBytes(ram?.wired)}</span>
              </div>
              <div className="power-signal-row">
                <span className="power-signal-key">Free</span>
                <span className="power-signal-val">{fmtBytes(ram?.free)}</span>
              </div>
              <div className="power-signal-row">
                <span className="power-signal-key">Purgeable</span>
                <span className="power-signal-val">{fmtBytes(ram?.purgeable)}</span>
              </div>
              <div className="power-signal-row">
                <span className="power-signal-key">Available</span>
                <span className="power-signal-val">{fmtBytes(ram?.available)}</span>
              </div>
              <div className="power-signal-row">
                <span className="power-signal-key">Swap total</span>
                <span className="power-signal-val">{fmtBytes(ram?.swap_total)}</span>
              </div>
              <div className="power-signal-row">
                <span className="power-signal-key">Swap free</span>
                <span className="power-signal-val">{fmtBytes(ram?.swap_free)}</span>
              </div>
              <div className="power-signal-row">
                <span className="power-signal-key">Swap in</span>
                <span className="power-signal-val">{fmtBytes(ram?.swap_in)}</span>
              </div>
              <div className="power-signal-row">
                <span className="power-signal-key">Swap out</span>
                <span className="power-signal-val">{fmtBytes(ram?.swap_out)}</span>
              </div>
              <div className="power-signal-row">
                <span className="power-signal-key">Pressure state</span>
                <span className="power-signal-val" style={{ color: pressureTone }}>{pressureState}</span>
              </div>
              <div className="power-signal-row">
                <span className="power-signal-key">Free pct</span>
                <span className="power-signal-val">{fmtPct(pressure, 0)}</span>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
