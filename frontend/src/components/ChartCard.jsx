import { useEffect } from 'react'
import {
  Chart,
  LineElement, PointElement, LineController,
  CategoryScale, LinearScale,
  Filler, Tooltip, Legend,
} from 'chart.js'

Chart.register(LineElement, PointElement, LineController, CategoryScale, LinearScale, Filler, Tooltip, Legend)

function readVar(name, fallback = '') {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

function resolveColor(input) {
  if (!input) return input
  if (typeof input === 'string' && input.startsWith('--')) return readVar(input, '#888')
  return input
}

function themeColors() {
  return {
    panel:     readVar('--panel',      '#040d07'),
    border:    readVar('--border',     '#0d2416'),
    accent:    readVar('--accent',     '#00ff6e'),
    textBright: readVar('--text-bright', '#f3fff7'),
    textLabel: readVar('--text-label', '#2e6640'),
    textDim:   readVar('--text-dim',   '#1a4a28'),
    chartGrid: readVar('--chart-grid', '#0a1e10'),
  }
}

export default function ChartCard({ chartRef, id, color, color2, label1, label2, yMax, initialData, tooltipSuffix }) {
  useEffect(() => {
    const canvas = document.getElementById(`chart-${id}`)
    if (!canvas || chartRef.current) return

    let tc = themeColors()
    let primary   = resolveColor(color)
    let secondary = resolveColor(color2)

    const datasets = [{
      label: label1 ?? id,
      data: initialData?.datasets?.[0] ?? [],
      borderColor: primary,
      backgroundColor: primary + '12',
      borderWidth: 1.5,
      pointRadius: 0,
      fill: true,
      tension: 0.35,
    }]

    if (color2) {
      datasets.push({
        label: label2 ?? '',
        data: initialData?.datasets?.[1] ?? [],
        borderColor: secondary,
        backgroundColor: secondary + '12',
        borderWidth: 1.5,
        pointRadius: 0,
        fill: true,
        tension: 0.35,
      })
    }

    const chart = new Chart(canvas, {
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
              color: tc.textLabel,
              boxWidth: 8,
              boxHeight: 2,
              font: { size: 11, family: "'Share Tech Mono', monospace" },
              padding: 8,
            },
          },
          tooltip: {
            backgroundColor: tc.panel,
            borderColor: tc.border,
            borderWidth: 1,
            titleColor: tc.textDim,
            bodyColor: tc.textBright,
            padding: 10,
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
            grid: { color: tc.chartGrid, lineWidth: 1 },
            ticks: {
              color: tc.textDim,
              font: { size: 10, family: "'Share Tech Mono', monospace" },
              maxTicksLimit: 4,
            },
            border: { display: false },
          },
        },
      },
    })

    chartRef.current = chart

    function applyTheme() {
      tc = themeColors()
      primary   = resolveColor(color)
      secondary = resolveColor(color2)

      chart.data.datasets[0].borderColor = primary
      chart.data.datasets[0].backgroundColor = primary + '12'
      if (chart.data.datasets[1]) {
        chart.data.datasets[1].borderColor = secondary
        chart.data.datasets[1].backgroundColor = secondary + '12'
      }
      chart.options.plugins.legend.labels.color = tc.textLabel
      chart.options.plugins.tooltip.backgroundColor = tc.panel
      chart.options.plugins.tooltip.borderColor = tc.border
      chart.options.plugins.tooltip.titleColor = tc.textDim
      chart.options.plugins.tooltip.bodyColor = tc.textBright
      chart.options.scales.y.grid.color = tc.chartGrid
      chart.options.scales.y.ticks.color = tc.textDim
      chart.update('none')
    }

    const observer = new MutationObserver(applyTheme)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    return () => {
      observer.disconnect()
      chart.destroy()
      chartRef.current = null
    }
  }, [chartRef, color, color2, id, initialData, label1, label2, tooltipSuffix, yMax])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas id={`chart-${id}`} style={{ position: 'absolute', inset: 0 }} />
    </div>
  )
}
