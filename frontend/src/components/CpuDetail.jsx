import { useMemo, useRef } from 'react'
import ChartCard from './ChartCard'

function fmtPct(value, digits = 1) {
  if (value == null || Number.isNaN(value)) return '—'
  return `${value.toFixed(digits)}%`
}

function fmtLoad(value) {
  if (value == null || Number.isNaN(value)) return '—'
  return value.toFixed(2)
}

function fmtFreq(value) {
  if (value == null || Number.isNaN(value)) return '—'
  if (value >= 1000) return `${(value / 1000).toFixed(2)} GHz`
  return `${value.toFixed(0)} MHz`
}

function createSingleSeries(series) {
  return {
    labels: series?.labels ?? [],
    datasets: [series?.values ?? []],
  }
}

function createDualSeries(series) {
  return {
    labels: series?.labels ?? [],
    datasets: [series?.valuesA ?? [], series?.valuesB ?? []],
  }
}

function clusterLabel(key) {
  if (key === 'E') return 'Efficiency cluster'
  if (key === 'P') return 'Performance cluster'
  if (key === 'S') return 'S cluster'
  return `Cluster ${key ?? '—'}`
}

export default function CpuDetail({ cpu, cpuSeries, loadSeries, clusterFreqSeries, clusterResidencySeries, onBack }) {
  const usageRef = useRef(null)
  const loadRef = useRef(null)
  const freqRef = useRef(null)
  const residencyRef = useRef(null)

  const clusterSummary = useMemo(() => {
    const clusters = cpu?.clusters ?? []
    const preferredOrder = ['P', 'S', 'E']
    return [...clusters].sort((a, b) => {
      const aIndex = preferredOrder.indexOf(a.key)
      const bIndex = preferredOrder.indexOf(b.key)
      return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex)
    })
  }, [cpu])

  const coreRows = useMemo(() => {
    const usage = cpu?.per_core ?? []
    const metricsByCore = new Map((cpu?.core_metrics ?? []).map(entry => [entry.core, entry]))
    return usage.map((percent, index) => ({
      core: index,
      percent,
      ...(metricsByCore.get(index) ?? {}),
    }))
  }, [cpu])

  return (
    <div className="detail-page">
      <div className="scanlines" />

      <header className="detail-header">
        <div className="detail-header-title">
          <span className="logo">SYSWATCH</span>
          <span className="live-dot" />
          <span className="live-label">CPU DETAIL</span>
        </div>

        <button type="button" className="detail-back" onClick={onBack}>
          Retour a l'accueil
        </button>
      </header>

      <main className="power-detail-shell">
        <section className="power-hero detail-panel">
          <div className="power-hero-main">
            <p className="detail-kicker">Processor telemetry</p>
            <h1 className="detail-title power-detail-title">{fmtPct(cpu?.percent)}</h1>
            <p className="detail-copy power-detail-copy">
              Charge globale, load average, frequences de cluster et residencies CPU sur la meme page, en gardant le meme langage visuel que le detail power.
            </p>
          </div>

          <div className="power-hero-stats">
            <div className="power-stat-tile">
              <span className="power-stat-label">Model</span>
              <span className="power-stat-value cpu-stat-compact">{cpu?.model ?? '—'}</span>
            </div>
            <div className="power-stat-tile">
              <span className="power-stat-label">Cores</span>
              <span className="power-stat-value">{cpu?.physical_cores ?? '—'} / {cpu?.logical_cores ?? '—'}</span>
            </div>
            <div className="power-stat-tile">
              <span className="power-stat-label">Load 1m</span>
              <span className="power-stat-value">{fmtLoad(cpu?.load_avg?.one)}</span>
            </div>
            <div className="power-stat-tile">
              <span className="power-stat-label">Kernel / user</span>
              <span className="power-stat-value">{fmtPct(cpu?.times_pct?.system)} / {fmtPct(cpu?.times_pct?.user)}</span>
            </div>
          </div>
        </section>

        <section className="power-detail-grid">
          <div className="detail-panel power-chart-card">
            <div className="power-chart-header">
              <p className="detail-kicker">Global usage</p>
              <span className="power-chart-meta">{fmtPct(cpu?.percent)}</span>
            </div>
            <div className="power-chart-wrap">
              <ChartCard
                chartRef={usageRef}
                id="cpu-detail-usage"
                color="--accent"
                yMax={100}
                initialData={createSingleSeries(cpuSeries)}
              />
            </div>
          </div>

          <div className="detail-panel power-chart-card">
            <div className="power-chart-header">
              <p className="detail-kicker">Load average</p>
              <span className="power-chart-meta">
                {fmtLoad(cpu?.load_avg?.one)} / {fmtLoad(cpu?.load_avg?.fifteen)}
              </span>
            </div>
            <div className="power-chart-wrap">
              <ChartCard
                chartRef={loadRef}
                id="cpu-detail-load"
                color="--blue"
                color2="--yellow"
                label1="1m"
                label2="15m"
                initialData={createDualSeries(loadSeries)}
                tooltipSuffix=""
              />
            </div>
          </div>

          <div className="detail-panel power-chart-card">
            <div className="power-chart-header">
              <p className="detail-kicker">Cluster frequency</p>
              <span className="power-chart-meta">{cpu?.power_metrics_available ? 'powermetrics' : 'Unavailable'}</span>
            </div>
            <div className="power-chart-wrap">
              <ChartCard
                chartRef={freqRef}
                id="cpu-detail-freq"
                color="--orange"
                color2="--accent"
                label1="Primary"
                label2="Secondary"
                yMax={4500}
                initialData={createDualSeries(clusterFreqSeries)}
                tooltipSuffix=" MHz"
              />
            </div>
          </div>

          <div className="detail-panel power-chart-card">
            <div className="power-chart-header">
              <p className="detail-kicker">Cluster active residency</p>
              <span className="power-chart-meta">{cpu?.power_metrics_available ? 'Live' : 'Unavailable'}</span>
            </div>
            <div className="power-chart-wrap">
              <ChartCard
                chartRef={residencyRef}
                id="cpu-detail-residency"
                color="#00ff6e"
                color2="--red"
                label1="Primary active"
                label2="Secondary active"
                yMax={100}
                initialData={createDualSeries(clusterResidencySeries)}
              />
            </div>
          </div>

          <div className="detail-panel power-signals-card cpu-signals-card">
            <p className="detail-kicker">Cluster signals</p>
            <div className="power-signals-grid">
              {clusterSummary.length > 0 ? clusterSummary.map(cluster => (
                <div className="power-signal-row" key={cluster.key}>
                  <span className="power-signal-key">{clusterLabel(cluster.key)}</span>
                  <span className="power-signal-val">
                    {fmtFreq(cluster.frequency_mhz)} / {fmtPct(cluster.active_residency_pct)}
                  </span>
                </div>
              )) : (
                <div className="cpu-empty-state">
                  Les frequences et residencies CPU demandent `powermetrics`, donc un lancement avec `sudo`.
                </div>
              )}
              <div className="power-signal-row">
                <span className="power-signal-key">Idle time</span>
                <span className="power-signal-val">{fmtPct(cpu?.times_pct?.idle)}</span>
              </div>
              <div className="power-signal-row">
                <span className="power-signal-key">Nice time</span>
                <span className="power-signal-val">{fmtPct(cpu?.times_pct?.nice)}</span>
              </div>
              <div className="power-signal-row">
                <span className="power-signal-key">Load 5m</span>
                <span className="power-signal-val">{fmtLoad(cpu?.load_avg?.five)}</span>
              </div>
              <div className="power-signal-row">
                <span className="power-signal-key">Architecture</span>
                <span className="power-signal-val">{cpu?.architecture ?? '—'}</span>
              </div>
            </div>
          </div>

          <div className="detail-panel power-signals-card cpu-cores-card">
            <p className="detail-kicker">Per-core live table</p>
            <div className="cpu-core-table">
              <div className="cpu-core-table-row cpu-core-table-head">
                <span>Core</span>
                <span>Usage</span>
                <span>Freq</span>
                <span>Active</span>
              </div>
              {coreRows.map(row => (
                <div className="cpu-core-table-row" key={row.core}>
                  <span>CPU {row.core}</span>
                  <span>{fmtPct(row.percent)}</span>
                  <span>{fmtFreq(row.frequency_mhz)}</span>
                  <span>{fmtPct(row.active_residency_pct)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
