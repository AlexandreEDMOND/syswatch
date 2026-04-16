import { useEffect, useRef, useState } from 'react'
import ChartCard from './components/ChartCard'
import DiskCard from './components/DiskCard'
import BatteryCard from './components/BatteryCard'
import ClaudeCard from './components/ClaudeCard'
import PowerCard from './components/PowerCard'
import DetailPlaceholder from './components/DetailPlaceholder'
import PowerDetail from './components/PowerDetail'
import CpuDetail from './components/CpuDetail'
import MemoryDetail from './components/MemoryDetail'
import ClaudeDetail from './components/ClaudeDetail'

const INTERVAL = 3000
const MAX_POINTS = 60
const DISK_WHITELIST = ['Macintosh HD', 'T7']
const DETAIL_SECTIONS = new Set(['cpu', 'memory', 'network', 'battery', 'storage', 'power', 'claude'])

function getRoute() {
  const [, first, second] = window.location.pathname.split('/')
  if (first === 'detail' && DETAIL_SECTIONS.has(second)) return second
  return 'overview'
}

function createSeries() {
  return { labels: [], datasets: [[]] }
}

function createDualSeries() {
  return { labels: [], datasets: [[], []] }
}

function createValueSeries() {
  return { labels: [], values: [] }
}

function createDualValueSeries() {
  return { labels: [], valuesA: [], valuesB: [] }
}

export default function App() {
  const [route, setRoute] = useState(() => getRoute())
  const [disks, setDisks]         = useState([])
  const [battery, setBattery]     = useState(null)
  const [batteryDetails, setBatteryDetails] = useState(null)
  const [claudeSessions, setClaudeSessions] = useState([])
  const [plan, setPlan]                     = useState(null)
  const [codex, setCodex]                   = useState([])
  const [power, setPower]                   = useState(null)
  const [cpu, setCpu]                       = useState(null)
  const [ram, setRam]                       = useState(null)
  const [cpuVal, setCpuVal]   = useState('—')
  const [ramVal, setRamVal]   = useState({ pct: '—', detail: '' })
  const [netVal, setNetVal]   = useState({ down: '—', up: '—' })
  const [time, setTime]       = useState(new Date())

  const cpuRef = useRef(null)
  const ramRef = useRef(null)
  const netRef = useRef(null)
  const cpuSeriesRef = useRef(createSeries())
  const ramSeriesRef = useRef(createSeries())
  const netSeriesRef = useRef(createDualSeries())
  const thermalSeriesRef = useRef(createValueSeries())
  const combinedPowerSeriesRef = useRef(createValueSeries())
  const batteryTempSeriesRef = useRef(createValueSeries())
  const cpuLoadSeriesRef = useRef(createDualValueSeries())
  const cpuClusterFreqSeriesRef = useRef(createDualValueSeries())
  const cpuClusterResidencySeriesRef = useRef(createDualValueSeries())
  const ramCompressedSeriesRef = useRef(createValueSeries())
  const ramSwapSeriesRef = useRef(createValueSeries())
  const ramPressureSeriesRef = useRef(createValueSeries())

  function fmt(bytes) {
    const gb = bytes / 1e9
    if (gb >= 1) return `${gb.toFixed(1)} GB`
    const mb = bytes / 1e6
    if (mb >= 1) return `${mb.toFixed(0)} MB`
    return `${(bytes / 1e3).toFixed(0)} KB`
  }

  function fmtSpeed(bps) {
    if (bps >= 1e6) return `${(bps / 1e6).toFixed(1)} MB/s`
    if (bps >= 1e3) return `${(bps / 1e3).toFixed(0)} KB/s`
    return `${bps.toFixed(0)} B/s`
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
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

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
        const [cpu, ram, net, batt, batteryDetailData, disksData, claudeData, powerData, planData, codexData] = await Promise.all([
          fetch('/api/cpu').then(r => r.json()),
          fetch('/api/ram').then(r => r.json()),
          fetch('/api/network').then(r => r.json()),
          fetch('/api/battery').then(r => r.json()),
          fetch('/api/battery-details').then(r => r.json()),
          fetch('/api/disks').then(r => r.json()),
          fetch('/api/claude').then(r => r.json()),
          fetch('/api/power').then(r => r.json()),
          fetch('/api/plan').then(r => r.json()),
          fetch('/api/codex').then(r => r.json()),
        ])

        // CPU
        const cpuColor = cpu.percent > 80 ? '#ff2040' : '#00ff6e'
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
        const ramColor = ram.percent > 80 ? '#ff2040' : '#00d9ff'
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

        // Network
        const recvKB = net.bytes_recv_per_sec / 1e3
        const sentKB = net.bytes_sent_per_sec / 1e3
        pushSeries(netSeriesRef, recvKB, now, 0)
        pushSeries(netSeriesRef, sentKB, now, 1)
        if (netRef.current) {
          netRef.current.data.labels.push(now)
          netRef.current.data.datasets[0].data.push(recvKB)
          netRef.current.data.datasets[1].data.push(sentKB)
          if (netRef.current.data.labels.length > MAX_POINTS) {
            netRef.current.data.labels.shift()
            netRef.current.data.datasets[0].data.shift()
            netRef.current.data.datasets[1].data.shift()
          }
          netRef.current.update('none')
        }
        setNetVal({ down: fmtSpeed(net.bytes_recv_per_sec), up: fmtSpeed(net.bytes_sent_per_sec) })

        setBattery(batt)
        setBatteryDetails(batteryDetailData)
        setDisks(disksData.filter(d => DISK_WHITELIST.includes(d.label)))
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

  const clockStr = time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const dateStr  = time.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
  const cpuNum   = parseFloat(cpuVal)
  const ramNum   = parseFloat(ramVal.pct)

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

      {/* ── Header ── */}
      <header className="header">
        <div className="header-left">
          <span className="logo">SYSWATCH</span>
          <span className="live-dot" />
          <span className="live-label">LIVE</span>
        </div>

        <div className="header-center">
          <div className="header-stat">
            <span className="header-stat-label">CPU</span>
            <span className="header-stat-val" style={{ color: cpuNum > 80 ? 'var(--red)' : 'var(--accent)' }}>
              {cpuVal}%
            </span>
          </div>
          <div className="header-stat">
            <span className="header-stat-label">MEM</span>
            <span className="header-stat-val" style={{ color: ramNum > 80 ? 'var(--red)' : 'var(--blue)' }}>
              {ramVal.pct}%
            </span>
          </div>
          <div className="header-stat">
            <span className="header-stat-label">RX</span>
            <span className="header-stat-val" style={{ color: 'var(--orange)' }}>{netVal.down}</span>
          </div>
          <div className="header-stat">
            <span className="header-stat-label">TX</span>
            <span className="header-stat-val" style={{ color: 'var(--yellow)' }}>{netVal.up}</span>
          </div>
        </div>

        <div className="header-right">
          <span className="clock">{clockStr}</span>
          <span className="date">{dateStr}</span>
        </div>
      </header>

      {/* ── Main grid ── */}
      <main className="main-grid">

        {/* CPU */}
        <button type="button" className="panel panel-button" onClick={() => openDetail('cpu')}>
          <div className="panel-header">
            <span className="panel-label">PROCESSOR</span>
            <div className="panel-value-stack">
              <span className="panel-value" style={{ color: cpuNum > 80 ? 'var(--red)' : 'var(--accent)' }}>
                {cpuVal}<span className="unit">%</span>
              </span>
            </div>
          </div>
          <div className="chart-wrap">
            <ChartCard
              chartRef={cpuRef}
              id="cpu"
              color="#00ff6e"
              yMax={100}
              initialData={cpuSeriesRef.current}
            />
          </div>
        </button>

        {/* RAM */}
        <button type="button" className="panel panel-button" onClick={() => openDetail('memory')}>
          <div className="panel-header">
            <span className="panel-label">MEMORY</span>
            <div className="panel-value-stack">
              <span className="panel-value" style={{ color: ramNum > 80 ? 'var(--red)' : 'var(--blue)' }}>
                {ramVal.pct}<span className="unit">%</span>
              </span>
              <span className="panel-sub">{ramVal.detail}</span>
            </div>
          </div>
          <div className="chart-wrap">
            <ChartCard
              chartRef={ramRef}
              id="ram"
              color="#00d9ff"
              yMax={100}
              initialData={ramSeriesRef.current}
            />
          </div>
        </button>

        {/* Network — spans both rows in col 3 */}
        <button type="button" className="panel panel-button panel-network" onClick={() => openDetail('network')}>
          <div className="panel-header">
            <span className="panel-label">NETWORK</span>
            <div className="panel-net-stats">
              <span><span className="net-arrow-down">↓ </span>{netVal.down}</span>
              <span><span className="net-arrow-up">↑ </span>{netVal.up}</span>
            </div>
          </div>
          <div className="chart-wrap">
            <ChartCard
              chartRef={netRef}
              id="net"
              color="#ff7a00"
              color2="#ffd600"
              label1="↓ RX"
              label2="↑ TX"
              initialData={netSeriesRef.current}
            />
          </div>
        </button>

        {/* Battery */}
        <button type="button" className="panel panel-button" onClick={() => openDetail('battery')}>
          <div className="panel-label-sm">BATTERY</div>
          <BatteryCard data={battery} />
        </button>

        {/* Disks */}
        <button type="button" className="panel panel-button" onClick={() => openDetail('storage')}>
          <div className="panel-label-sm">STORAGE</div>
          <div className="disks-list">
            {disks.map(d => <DiskCard key={d.mount} data={d} />)}
          </div>
        </button>

        {/* Assistant usage */}
        <button type="button" className="panel panel-button panel-claude" onClick={() => openDetail('claude')}>
          <div className="panel-label-sm">AI USAGE</div>
          <ClaudeCard sessions={claudeSessions} plan={plan} codex={codex} />
        </button>

        {/* Power consumption */}
        <button type="button" className="panel panel-button panel-power" onClick={() => openDetail('power')}>
          <div className="panel-label-sm">POWER</div>
          <PowerCard data={power} />
        </button>

      </main>
    </div>
  )
}
