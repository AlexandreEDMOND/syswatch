import { useEffect, useRef, useState } from 'react'
import ChartCard from './components/ChartCard'
import ClaudeCard from './components/ClaudeCard'
import PowerCard from './components/PowerCard'
import DetailPlaceholder from './components/DetailPlaceholder'
import PowerDetail from './components/PowerDetail'
import CpuDetail from './components/CpuDetail'
import MemoryDetail from './components/MemoryDetail'
import ClaudeDetail from './components/ClaudeDetail'
import BatteryDetail from './components/BatteryDetail'

const INTERVAL = 3000
const MAX_POINTS = 60
const DETAIL_SECTIONS = new Set(['cpu', 'memory', 'network', 'battery', 'storage', 'power', 'claude'])
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

function apiFetch(path) {
  return fetch(`${API_BASE_URL}${path}`).then(r => {
    if (!r.ok) throw new Error(`API request failed: ${path} (${r.status})`)
    return r.json()
  })
}

function getRoute() {
  const [, first, second] = window.location.pathname.split('/')
  if (first === 'detail' && DETAIL_SECTIONS.has(second)) return second
  return 'overview'
}

function createSeries() {
  return { labels: [], datasets: [[]] }
}

function createValueSeries() {
  return { labels: [], values: [] }
}

function createDualValueSeries() {
  return { labels: [], valuesA: [], valuesB: [] }
}

function fmtLoad(value) {
  if (value == null || Number.isNaN(value)) return '—'
  return value.toFixed(2)
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function initTheme() {
  const saved = localStorage.getItem('sw-theme') ?? 'dark'
  document.documentElement.dataset.theme = saved === 'light' ? 'light' : ''
  return saved === 'light' ? 'light' : 'dark'
}

export default function App() {
  const [route, setRoute] = useState(() => getRoute())
  const [batteryDetails, setBatteryDetails] = useState(null)
  const [claudeSessions, setClaudeSessions] = useState([])
  const [plan, setPlan]                     = useState(null)
  const [codex, setCodex]                   = useState([])
  const [power, setPower]                   = useState(null)
  const [cpu, setCpu]                       = useState(null)
  const [ram, setRam]                       = useState(null)
  const [cpuVal, setCpuVal]   = useState('—')
  const [ramVal, setRamVal]   = useState({ pct: '—', detail: '' })

  const cpuRef = useRef(null)
  const ramRef = useRef(null)
  const cpuSeriesRef = useRef(createSeries())
  const ramSeriesRef = useRef(createSeries())
  const thermalSeriesRef = useRef(createValueSeries())
  const combinedPowerSeriesRef = useRef(createValueSeries())
  const batteryTempSeriesRef = useRef(createValueSeries())
  const cpuLoadSeriesRef = useRef(createDualValueSeries())
  const cpuClusterFreqSeriesRef = useRef(createDualValueSeries())
  const cpuClusterResidencySeriesRef = useRef(createDualValueSeries())
  const ramCompressedSeriesRef = useRef(createValueSeries())
  const ramSwapSeriesRef = useRef(createValueSeries())
  const ramPressureSeriesRef = useRef(createValueSeries())

  useEffect(() => {
    initTheme()
  }, [])

  function fmt(bytes) {
    const gb = bytes / 1e9
    if (gb >= 1) return `${gb.toFixed(1)} GB`
    const mb = bytes / 1e6
    if (mb >= 1) return `${mb.toFixed(0)} MB`
    return `${(bytes / 1e3).toFixed(0)} KB`
  }

  function pushPoint(chartRef, value, label, datasetIndex = 0) {
    const chart = chartRef.current
    if (!chart) return
    chart.data.labels.push(label)
    chart.data.datasets[datasetIndex].data.push(value)
    if (chart.data.labels.length > MAX_POINTS) {
      chart.data.labels.shift()
      chart.data.datasets[datasetIndex].data.shift()
    }
    chart.update('none')
  }

  function pushSeries(seriesRef, value, label, datasetIndex = 0) {
    const series = seriesRef.current
    if (datasetIndex === 0) {
      series.labels.push(label)
      if (series.labels.length > MAX_POINTS) series.labels.shift()
    }

    series.datasets[datasetIndex].push(value)
    if (series.datasets[datasetIndex].length > MAX_POINTS) {
      series.datasets[datasetIndex].shift()
    }
  }

  function openDetail(section) {
    const nextPath = `/detail/${section}`
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath)
    }
    setRoute(section)
  }

  function pushValueSeries(seriesRef, value, label) {
    if (value == null || Number.isNaN(value)) return
    const series = seriesRef.current
    series.labels.push(label)
    series.values.push(value)
    if (series.labels.length > MAX_POINTS) series.labels.shift()
    if (series.values.length > MAX_POINTS) series.values.shift()
  }

  function pushDualValueSeries(seriesRef, valueA, valueB, label) {
    if ([valueA, valueB].every(value => value == null || Number.isNaN(value))) return
    const series = seriesRef.current
    series.labels.push(label)
    series.valuesA.push(valueA ?? null)
    series.valuesB.push(valueB ?? null)
    if (series.labels.length > MAX_POINTS) series.labels.shift()
    if (series.valuesA.length > MAX_POINTS) series.valuesA.shift()
    if (series.valuesB.length > MAX_POINTS) series.valuesB.shift()
  }

  function goBackToOverview() {
    if (window.location.pathname !== '/') {
      window.history.pushState({}, '', '/')
    }
    setRoute('overview')
  }

  useEffect(() => {
    function handlePopState() {
      setRoute(getRoute())
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    async function refresh() {
      const now = new Date().toLocaleTimeString('fr-FR')
      try {
        const [cpu, ram, batteryDetailData, claudeData, powerData, planData, codexData] = await Promise.all([
          apiFetch('/api/cpu'),
          apiFetch('/api/ram'),
          apiFetch('/api/battery-details'),
          apiFetch('/api/claude'),
          apiFetch('/api/power'),
          apiFetch('/api/plan'),
          apiFetch('/api/codex'),
        ])

        // CPU
        const cpuColor = cpu.percent > 80 ? cssVar('--red') : cssVar('--accent')
        if (cpuRef.current) {
          cpuRef.current.data.datasets[0].borderColor = cpuColor
          cpuRef.current.data.datasets[0].backgroundColor = cpuColor + '15'
        }
        pushSeries(cpuSeriesRef, cpu.percent, now)
        pushPoint(cpuRef, cpu.percent, now)
        setCpu(cpu)
        setCpuVal(cpu.percent.toFixed(1))
        pushDualValueSeries(cpuLoadSeriesRef, cpu.load_avg?.one ?? null, cpu.load_avg?.fifteen ?? null, now)
        const primaryCluster = cpu.clusters?.[0] ?? null
        const secondaryCluster = cpu.clusters?.[1] ?? null
        pushDualValueSeries(
          cpuClusterFreqSeriesRef,
          primaryCluster?.frequency_mhz ?? null,
          secondaryCluster?.frequency_mhz ?? null,
          now,
        )
        pushDualValueSeries(
          cpuClusterResidencySeriesRef,
          primaryCluster?.active_residency_pct ?? null,
          secondaryCluster?.active_residency_pct ?? null,
          now,
        )

        // RAM
        const ramColor = ram.percent > 80 ? cssVar('--red') : cssVar('--blue')
        if (ramRef.current) {
          ramRef.current.data.datasets[0].borderColor = ramColor
          ramRef.current.data.datasets[0].backgroundColor = ramColor + '15'
        }
        pushSeries(ramSeriesRef, ram.percent, now)
        pushPoint(ramRef, ram.percent, now)
        setRam(ram)
        setRamVal({ pct: ram.percent.toFixed(1), detail: `${fmt(ram.used)} / ${fmt(ram.total)}` })
        pushValueSeries(ramCompressedSeriesRef, (ram.compressed ?? 0) / 1e9, now)
        pushValueSeries(ramSwapSeriesRef, (ram.swap_used ?? 0) / 1e9, now)
        pushValueSeries(ramPressureSeriesRef, ram.memory_pressure_pct ?? null, now)

        setBatteryDetails(batteryDetailData)
        setClaudeSessions(claudeData)
        setPlan(planData)
        setCodex(codexData)
        setPower(powerData)
        const thermalScores = { Nominal: 25, Moderate: 55, Heavy: 82, Tripping: 100 }
        pushValueSeries(thermalSeriesRef, thermalScores[powerData.thermal_pressure] ?? 0, now)
        pushValueSeries(combinedPowerSeriesRef, powerData.combined_mw ?? 0, now)
        pushValueSeries(batteryTempSeriesRef, batteryDetailData.temperature_c ?? null, now)
      } catch (e) {
        console.error(e)
      }
    }

    refresh()
    const id = setInterval(refresh, INTERVAL)
    return () => clearInterval(id)
  }, [])

  const cpuNum   = parseFloat(cpuVal)
  const ramNum   = parseFloat(ramVal.pct)
  const ramSwap = ram?.swap_used ?? 0
  const ramCompressed = ram?.compressed ?? 0
  const ramAvailable = ram?.available ?? null

  if (route !== 'overview') {
    if (route === 'cpu') {
      return (
        <CpuDetail
          cpu={cpu}
          cpuSeries={cpuSeriesRef.current}
          loadSeries={cpuLoadSeriesRef.current}
          clusterFreqSeries={cpuClusterFreqSeriesRef.current}
          clusterResidencySeries={cpuClusterResidencySeriesRef.current}
          onBack={goBackToOverview}
        />
      )
    }
    if (route === 'memory') {
      return (
        <MemoryDetail
          ram={ram}
          usageSeries={ramSeriesRef.current}
          compressedSeries={ramCompressedSeriesRef.current}
          swapSeries={ramSwapSeriesRef.current}
          pressureSeries={ramPressureSeriesRef.current}
          onBack={goBackToOverview}
        />
      )
    }
    if (route === 'power') {
      return (
        <PowerDetail
          power={power}
          batteryDetails={batteryDetails}
          thermalSeries={thermalSeriesRef.current}
          combinedSeries={combinedPowerSeriesRef.current}
          batteryTempSeries={batteryTempSeriesRef.current}
          onBack={goBackToOverview}
        />
      )
    }
    if (route === 'battery') {
      return (
        <BatteryDetail
          batteryDetails={batteryDetails}
          onBack={goBackToOverview}
        />
      )
    }
    if (route === 'claude') {
      return (
        <ClaudeDetail
          sessions={claudeSessions}
          plan={plan}
          codex={codex}
          onBack={goBackToOverview}
        />
      )
    }
    return <DetailPlaceholder section={route} onBack={goBackToOverview} />
  }

  return (
    <div className="app">
      <div className="scanlines" />
      <main className="main-grid">
        <button type="button" className="panel panel-button panel-cpu-main" onClick={() => openDetail('cpu')}>
          <div className="panel-header panel-header-main">
            <span className="panel-label">PROCESSOR</span>
            <div className="panel-value-stack">
              <span className="panel-value" style={{ color: cpuNum > 80 ? 'var(--red)' : 'var(--accent)' }}>
                {cpuVal}<span className="unit">%</span>
              </span>
              <span className="panel-sub">
                load {fmtLoad(cpu?.load_avg?.one)} • {cpu?.physical_cores ?? '—'} cores
              </span>
            </div>
          </div>
          <div className="panel-stats-row">
            <div className="panel-stat-chip">
              <span className="panel-stat-chip-label">System</span>
              <span className="panel-stat-chip-value">{cpu?.times_pct?.system?.toFixed(1) ?? '—'}%</span>
            </div>
            <div className="panel-stat-chip">
              <span className="panel-stat-chip-label">User</span>
              <span className="panel-stat-chip-value">{cpu?.times_pct?.user?.toFixed(1) ?? '—'}%</span>
            </div>
            <div className="panel-stat-chip">
              <span className="panel-stat-chip-label">Model</span>
              <span className="panel-stat-chip-value panel-stat-chip-value-wide">{cpu?.model ?? '—'}</span>
            </div>
          </div>
          <div className="chart-wrap">
            <ChartCard
              chartRef={cpuRef}
              id="cpu"
              color="--accent"
              yMax={100}
              initialData={cpuSeriesRef.current}
            />
          </div>
        </button>

        <button type="button" className="panel panel-button panel-memory-main" onClick={() => openDetail('memory')}>
          <div className="panel-header panel-header-main">
            <span className="panel-label">MEMORY</span>
            <div className="panel-value-stack">
              <span className="panel-value" style={{ color: ramNum > 80 ? 'var(--red)' : 'var(--blue)' }}>
                {ramVal.pct}<span className="unit">%</span>
              </span>
              <span className="panel-sub">{ramVal.detail}</span>
            </div>
          </div>
          <div className="panel-stats-row">
            <div className="panel-stat-chip">
              <span className="panel-stat-chip-label">Available</span>
              <span className="panel-stat-chip-value">{ramAvailable == null ? '—' : fmt(ramAvailable)}</span>
            </div>
            <div className="panel-stat-chip">
              <span className="panel-stat-chip-label">Compressed</span>
              <span className="panel-stat-chip-value">{ram == null ? '—' : fmt(ramCompressed)}</span>
            </div>
            <div className="panel-stat-chip">
              <span className="panel-stat-chip-label">Swap</span>
              <span className="panel-stat-chip-value">{ram == null ? '—' : fmt(ramSwap)}</span>
            </div>
          </div>
          <div className="chart-wrap">
            <ChartCard
              chartRef={ramRef}
              id="ram"
              color="--blue"
              yMax={100}
              initialData={ramSeriesRef.current}
            />
          </div>
        </button>

        <button type="button" className="panel panel-button panel-claude panel-claude-main" onClick={() => openDetail('claude')}>
          <div className="panel-header panel-header-main panel-header-ai-compact">
            <span className="panel-label">AI USAGE</span>
          </div>
          <ClaudeCard plan={plan} codex={codex} />
        </button>

        <button type="button" className="panel panel-button panel-power panel-power-compact" onClick={() => openDetail('power')}>
          <div className="panel-label-sm">POWER</div>
          <PowerCard power={power} batteryDetails={batteryDetails} />
        </button>
      </main>
    </div>
  )
}
