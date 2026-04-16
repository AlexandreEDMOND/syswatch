import { useEffect } from 'react'
import {
  Chart,
  LineElement, PointElement, LineController,
  CategoryScale, LinearScale,
  Filler, Tooltip, Legend,
} from 'chart.js'

Chart.register(LineElement, PointElement, LineController, CategoryScale, LinearScale, Filler, Tooltip, Legend)

const cardStyle = {
  background: '#1a1a1a',
  border: '1px solid #2a2a2a',
  borderRadius: '10px',
  padding: '1.2rem 1.5rem',
  marginBottom: '1rem',
}

export default function ChartCard({ title, sub, chartRef, color, color2, label1, label2, yMax }) {
  useEffect(() => {
    const canvas = document.getElementById(`chart-${title}`)
    if (!canvas || chartRef.current) return

    const datasets = [{
      label: label1 ?? title,
      data: [],
      borderColor: color,
      backgroundColor: color + '22',
      borderWidth: 2,
      pointRadius: 0,
      fill: true,
      tension: 0.4,
    }]

    if (color2) {
      datasets.push({
        label: label2 ?? '',
        data: [],
        borderColor: color2,
        backgroundColor: color2 + '22',
        borderWidth: 2,
        pointRadius: 0,
        fill: true,
        tension: 0.4,
      })
    }

    chartRef.current = new Chart(canvas, {
      type: 'line',
      data: { labels: [], datasets },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: !!color2,
            labels: { color: '#666', boxWidth: 12, font: { size: 11 } },
          },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.parsed.y.toFixed(1)}${color2 ? ' Ko/s' : ' %'}`,
            },
          },
        },
        scales: {
          x: { display: false },
          y: {
            min: 0,
            max: yMax ?? undefined,
            grid: { color: '#1e1e1e' },
            ticks: { color: '#444', font: { size: 10 } },
          },
        },
      },
    })

    return () => {
      chartRef.current?.destroy()
      chartRef.current = null
    }
  }, [])

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.8rem' }}>
        <span style={{ fontSize: '0.95rem', color: '#fff', fontWeight: 600 }}>{title}</span>
        <span style={{ fontSize: '0.82rem', color: '#ccc' }}>{sub}</span>
      </div>
      <div style={{ position: 'relative', height: '90px' }}>
        <canvas id={`chart-${title}`} />
      </div>
    </div>
  )
}
