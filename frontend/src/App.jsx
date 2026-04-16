import { useEffect, useRef, useState } from 'react'
import ChartCard from './components/ChartCard'
import DiskCard from './components/DiskCard'
import BatteryCard from './components/BatteryCard'
import ClaudeCard from './components/ClaudeCard'
import PowerCard from './components/PowerCard'

const INTERVAL = 3000
const MAX_POINTS = 60
const DISK_WHITELIST = ['Macintosh HD', 'T7']

export default function App() {
  const [disks, setDisks]         = useState([])
  const [battery, setBattery]     = useState(null)
  const [claudeSessions, setClaudeSessions] = useState([])
  const [plan, setPlan]                     = useState(null)
  const [power, setPower]                   = useState(null)
  const [cpuVal, setCpuVal]   = useState('—')
  const [ramVal, setRamVal]   = useState({ pct: '—', detail: '' })
  const [netVal, setNetVal]   = useState({ down: '—', up: '—' })
  const [time, setTime]       = useState(new Date())

  const cpuRef = useRef(null)
  const ramRef = useRef(null)
  const netRef = useRef(null)

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

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    async function refresh() {
      const now = new Date().toLocaleTimeString('fr-FR')
      try {
        const [cpu, ram, net, batt, disksData, claudeData, powerData, planData] = await Promise.all([
          fetch('/api/cpu').then(r => r.json()),
          fetch('/api/ram').then(r => r.json()),
          fetch('/api/network').then(r => r.json()),
          fetch('/api/battery').then(r => r.json()),
          fetch('/api/disks').then(r => r.json()),
          fetch('/api/claude').then(r => r.json()),
          fetch('/api/power').then(r => r.json()),
          fetch('/api/plan').then(r => r.json()),
        ])

        // CPU
        const cpuColor = cpu.percent > 80 ? '#ff2040' : '#00ff6e'
        if (cpuRef.current) {
          cpuRef.current.data.datasets[0].borderColor = cpuColor
          cpuRef.current.data.datasets[0].backgroundColor = cpuColor + '15'
        }
        pushPoint(cpuRef, cpu.percent, now)
        setCpuVal(cpu.percent.toFixed(1))

        // RAM
        const ramColor = ram.percent > 80 ? '#ff2040' : '#00d9ff'
        if (ramRef.current) {
          ramRef.current.data.datasets[0].borderColor = ramColor
          ramRef.current.data.datasets[0].backgroundColor = ramColor + '15'
        }
        pushPoint(ramRef, ram.percent, now)
        setRamVal({ pct: ram.percent.toFixed(1), detail: `${fmt(ram.used)} / ${fmt(ram.total)}` })

        // Network
        const recvKB = net.bytes_recv_per_sec / 1e3
        const sentKB = net.bytes_sent_per_sec / 1e3
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
        setDisks(disksData.filter(d => DISK_WHITELIST.includes(d.label)))
        setClaudeSessions(claudeData)
        setPlan(planData)
        setPower(powerData)
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
        <div className="panel">
          <div className="panel-header">
            <span className="panel-label">PROCESSOR</span>
            <div className="panel-value-stack">
              <span className="panel-value" style={{ color: cpuNum > 80 ? 'var(--red)' : 'var(--accent)' }}>
                {cpuVal}<span className="unit">%</span>
              </span>
            </div>
          </div>
          <div className="chart-wrap">
            <ChartCard chartRef={cpuRef} id="cpu" color="#00ff6e" yMax={100} />
          </div>
        </div>

        {/* RAM */}
        <div className="panel">
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
            <ChartCard chartRef={ramRef} id="ram" color="#00d9ff" yMax={100} />
          </div>
        </div>

        {/* Network — spans both rows in col 3 */}
        <div className="panel panel-network">
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
            />
          </div>
        </div>

        {/* Battery */}
        <div className="panel">
          <div className="panel-label-sm">BATTERY</div>
          <BatteryCard data={battery} />
        </div>

        {/* Disks */}
        <div className="panel">
          <div className="panel-label-sm">STORAGE</div>
          <div className="disks-list">
            {disks.map(d => <DiskCard key={d.mount} data={d} />)}
          </div>
        </div>

        {/* Claude Code usage */}
        <div className="panel panel-claude">
          <div className="panel-label-sm">CLAUDE CODE</div>
          <ClaudeCard sessions={claudeSessions} plan={plan} />
        </div>

        {/* Power consumption */}
        <div className="panel panel-power">
          <div className="panel-label-sm">POWER</div>
          <PowerCard data={power} />
        </div>

      </main>
    </div>
  )
}
