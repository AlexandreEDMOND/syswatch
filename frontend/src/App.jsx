import { useEffect, useRef, useState } from 'react'
import ChartCard from './components/ChartCard'
import DiskCard from './components/DiskCard'
import BatteryCard from './components/BatteryCard'
import Section from './components/Section'

const INTERVAL = 3000
const MAX_POINTS = 60

export default function App() {
  const [disks, setDisks]     = useState([])
  const [battery, setBattery] = useState(null)
  const [cpuSub, setCpuSub]   = useState('—')
  const [ramSub, setRamSub]   = useState('—')
  const [netSub, setNetSub]   = useState('—')

  const cpuRef = useRef(null)
  const ramRef = useRef(null)
  const netRef = useRef(null)

  function fmt(bytes) {
    const gb = bytes / 1e9
    if (gb >= 1) return `${gb.toFixed(1)} Go`
    const mb = bytes / 1e6
    if (mb >= 1) return `${mb.toFixed(1)} Mo`
    return `${(bytes / 1e3).toFixed(0)} Ko`
  }

  function fmtSpeed(bps) {
    if (bps >= 1e6) return `${(bps / 1e6).toFixed(1)} Mo/s`
    if (bps >= 1e3) return `${(bps / 1e3).toFixed(0)} Ko/s`
    return `${bps.toFixed(0)} o/s`
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
    async function refresh() {
      const now = new Date().toLocaleTimeString('fr-FR')
      try {
        const [cpu, ram, net, batt, disksData] = await Promise.all([
          fetch('/api/cpu').then(r => r.json()),
          fetch('/api/ram').then(r => r.json()),
          fetch('/api/network').then(r => r.json()),
          fetch('/api/battery').then(r => r.json()),
          fetch('/api/disks').then(r => r.json()),
        ])

        // CPU
        const cpuColor = cpu.percent > 80 ? '#f75f5f' : '#4f8ef7'
        if (cpuRef.current) {
          cpuRef.current.data.datasets[0].borderColor = cpuColor
          cpuRef.current.data.datasets[0].backgroundColor = cpuColor + '22'
        }
        pushPoint(cpuRef, cpu.percent, now)
        setCpuSub(`${cpu.percent.toFixed(1)}%`)

        // RAM
        const ramColor = ram.percent > 80 ? '#f75f5f' : '#a78bfa'
        if (ramRef.current) {
          ramRef.current.data.datasets[0].borderColor = ramColor
          ramRef.current.data.datasets[0].backgroundColor = ramColor + '22'
        }
        pushPoint(ramRef, ram.percent, now)
        setRamSub(`${fmt(ram.used)} / ${fmt(ram.total)}`)

        // Réseau — dataset 0 = reçu, dataset 1 = envoyé
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
        setNetSub(`↓ ${fmtSpeed(net.bytes_recv_per_sec)}  ↑ ${fmtSpeed(net.bytes_sent_per_sec)}`)

        setBattery(batt)
        setDisks(disksData)
      } catch (e) {
        console.error(e)
      }
    }

    refresh()
    const id = setInterval(refresh, INTERVAL)
    return () => clearInterval(id)
  }, [])

  return (
    <>
      <h1 style={{ fontSize: '1.4rem', marginBottom: '1.5rem', color: '#fff', letterSpacing: '0.05em' }}>
        syswatch
      </h1>

      <Section label="CPU">
        <ChartCard
          title="Processeur"
          sub={cpuSub}
          chartRef={cpuRef}
          color="#4f8ef7"
          yMax={100}
        />
      </Section>

      <Section label="RAM">
        <ChartCard
          title="Mémoire vive"
          sub={ramSub}
          chartRef={ramRef}
          color="#a78bfa"
          yMax={100}
        />
      </Section>

      <Section label="Réseau">
        <ChartCard
          title="Débit réseau"
          sub={netSub}
          chartRef={netRef}
          color="#34d399"
          color2="#f97316"
          label1="↓ Reçu"
          label2="↑ Envoyé"
        />
      </Section>

      <Section label="Batterie">
        <BatteryCard data={battery} />
      </Section>

      <Section label="Disques">
        {disks.map(d => <DiskCard key={d.mount} data={d} />)}
      </Section>

      <p style={{ fontSize: '0.75rem', color: '#444', marginTop: '2rem' }}>
        Rafraichissement toutes les {INTERVAL / 1000} secondes
      </p>
    </>
  )
}
