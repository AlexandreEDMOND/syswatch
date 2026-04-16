import { useEffect } from 'react'
import {
  Chart,
  LineElement, PointElement, LineController,
  CategoryScale, LinearScale,
  Filler, Tooltip, Legend,
} from 'chart.js'

Chart.register(LineElement, PointElement, LineController, CategoryScale, LinearScale, Filler, Tooltip, Legend)

export default function ChartCard({ chartRef, id, color, color2, label1, label2, yMax, initialData, tooltipSuffix }) {
  useEffect(() => {
    const canvas = document.getElementById(`chart-${id}`)
    if (!canvas || chartRef.current) return

    const datasets = [{
      label: label1 ?? id,
      data: initialData?.datasets?.[0] ?? [],
      borderColor: color,
      backgroundColor: color + '12',
      borderWidth: 1.5,
      pointRadius: 0,
      fill: true,
      tension: 0.35,
    }]

    if (color2) {
      datasets.push({
        label: label2 ?? '',
        data: initialData?.datasets?.[1] ?? [],
        borderColor: color2,
        backgroundColor: color2 + '12',
        borderWidth: 1.5,
        pointRadius: 0,
        fill: true,
        tension: 0.35,
      })
    }

    chartRef.current = new Chart(canvas, {
      type: 'line',
      data: { labels: initialData?.labels ?? [], datasets },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: !!color2,
            position: 'top',
            align: 'end',
            labels: {
              color: '#2e6640',
              boxWidth: 8,
              boxHeight: 2,
              font: { size: 9, family: "'Share Tech Mono', monospace" },
              padding: 6,
            },
          },
          tooltip: {
            backgroundColor: '#040d07',
            borderColor: '#0d2416',
            borderWidth: 1,
            titleColor: '#2e6640',
            bodyColor: '#00ff6e',
            padding: 6,
            callbacks: {
              label: ctx => ` ${ctx.parsed.y.toFixed(1)}${tooltipSuffix ?? (color2 ? ' KB/s' : '%')}`,
            },
          },
        },
        scales: {
          x: { display: false },
          y: {
            min: 0,
            max: yMax ?? undefined,
            grid: { color: '#0a1e10', lineWidth: 0.5 },
            ticks: {
              color: '#1a4a28',
              font: { size: 8, family: "'Share Tech Mono', monospace" },
              maxTicksLimit: 5,
            },
            border: { display: false },
          },
        },
      },
    })

    return () => {
      chartRef.current?.destroy()
      chartRef.current = null
    }
  }, [chartRef, color, color2, id, initialData, label1, label2, tooltipSuffix, yMax])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas id={`chart-${id}`} style={{ position: 'absolute', inset: 0 }} />
    </div>
  )
}
