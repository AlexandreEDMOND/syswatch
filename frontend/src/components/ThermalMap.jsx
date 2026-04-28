const HEAT_STOPS = [
  { t: 0.00, rgb: [111, 212, 255] },
  { t: 0.35, rgb: [ 92, 255, 147] },
  { t: 0.62, rgb: [255, 212,  95] },
  { t: 0.82, rgb: [255, 157,  66] },
  { t: 1.00, rgb: [255,  95, 122] },
]

function heatRgb(t) {
  t = Math.max(0, Math.min(1, t))
  for (let i = 1; i < HEAT_STOPS.length; i++) {
    const a = HEAT_STOPS[i - 1], b = HEAT_STOPS[i]
    if (t <= b.t) {
      const f = (t - a.t) / (b.t - a.t)
      return a.rgb.map((v, j) => Math.round(v + f * (b.rgb[j] - v)))
    }
  }
  return HEAT_STOPS[HEAT_STOPS.length - 1].rgb
}

function hc(t, alpha = 1) {
  const [r, g, b] = heatRgb(t)
  return `rgba(${r},${g},${b},${alpha})`
}

function fmtMw(mw) {
  if (mw == null) return '—'
  if (mw >= 1000) return `${(mw / 1000).toFixed(1)} W`
  return `${mw} mW`
}

// Layout constants (viewBox 0 0 780 180)
const VW = 780, VH = 180
const CX = 4, CY = 4, CW = 772, CH = 172  // chip rect
const PAD = 10

const CPU_X = CX + PAD
const CPU_Y = CY + PAD
const CPU_W = 420
const CPU_H = CH - PAD * 2   // 152

const DIV_X = CX + PAD + CPU_W + 10   // 444
const RIGHT_X = DIV_X + 4

const GPU_X = RIGHT_X
const GPU_W = 153
const GPU_H = CPU_H   // full height

const SIDE_X = GPU_X + GPU_W + 8
const SIDE_W = CW - PAD - (SIDE_X - CX)
const SIDE_UNIT = (CPU_H - 8) / 2   // 72

function Block({ x, y, w, h, heat, label, value, sub }) {
  const fill   = hc(heat, 0.13)
  const stroke = hc(heat, 0.62)
  const color  = hc(heat, 0.95)
  const barW   = Math.max(0, (w - 8) * heat)
  const valSize = h >= 52 ? 13 : 10
  const subY    = h >= 52 ? 20 : 15

  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={3}
        fill={fill} stroke={stroke} strokeWidth={1} />

      <text x={x + 6} y={y + 11}
        fontSize={7} fontFamily="monospace" letterSpacing={1.5}
        fill={color} fillOpacity={0.62}>
        {label}
      </text>

      <text x={x + w / 2} y={y + h / 2 + (sub ? 2 : 5)}
        fontSize={valSize} fontFamily="monospace" fontWeight="bold"
        fill={color} textAnchor="middle">
        {value}
      </text>

      {sub && (
        <text x={x + w / 2} y={y + h / 2 + subY}
          fontSize={8} fontFamily="monospace"
          fill={color} textAnchor="middle" fillOpacity={0.52}>
          {sub}
        </text>
      )}

      {/* heat bar */}
      <rect x={x + 4} y={y + h - 5} width={w - 8} height={2.5} rx={1}
        fill="none" stroke={stroke} strokeWidth={0.5} strokeOpacity={0.35} />
      {barW > 0 && (
        <rect x={x + 4} y={y + h - 5} width={barW} height={2.5} rx={1}
          fill={stroke} />
      )}
    </g>
  )
}

export default function ThermalMap({ power, batteryDetails }) {
  const clusters = power?.cpu_clusters ?? []
  const gpuMw    = power?.gpu_mw ?? 0
  const aneMw    = power?.ane_mw ?? 0
  const battTemp = batteryDetails?.temperature_c

  const nClusters  = Math.max(1, clusters.length)
  const clusterGap = 8
  const clusterH   = (CPU_H - clusterGap * (nClusters - 1)) / nClusters

  const gpuHeat  = Math.min(1, gpuMw / 8000)
  const aneHeat  = Math.min(1, aneMw / 2000)
  const battHeat = battTemp != null
    ? Math.min(1, Math.max(0, (battTemp - 20) / 40))
    : 0

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} className="thermal-map-svg">
      <defs>
        <linearGradient id="tm-legend" x1="0" x2="1">
          <stop offset="0%"   stopColor="rgba(111,212,255,.75)" />
          <stop offset="35%"  stopColor="rgba(92,255,147,.75)" />
          <stop offset="62%"  stopColor="rgba(255,212,95,.75)" />
          <stop offset="82%"  stopColor="rgba(255,157,66,.75)" />
          <stop offset="100%" stopColor="rgba(255,95,122,.75)" />
        </linearGradient>
      </defs>

      {/* chip outline */}
      <rect x={CX} y={CY} width={CW} height={CH} rx={5}
        fill="rgba(0,0,0,.22)" stroke="rgba(92,255,147,.1)" strokeWidth={1} />

      {/* corner dots */}
      {[[CX+3,CY+3],[CX+CW-3,CY+3],[CX+3,CY+CH-3],[CX+CW-3,CY+CH-3]].map(([cx,cy],i) => (
        <circle key={i} cx={cx} cy={cy} r={1.5} fill="rgba(92,255,147,.4)" />
      ))}

      {/* divider between CPU and right section */}
      <line x1={DIV_X} y1={CY+4} x2={DIV_X} y2={CY+CH-4}
        stroke="rgba(92,255,147,.07)" strokeWidth={1} />

      {/* divider between GPU and side column */}
      <line x1={SIDE_X-4} y1={CY+4} x2={SIDE_X-4} y2={CY+CH-4}
        stroke="rgba(92,255,147,.07)" strokeWidth={1} />

      {/* CPU clusters */}
      {clusters.length === 0
        ? <Block x={CPU_X} y={CPU_Y} w={CPU_W} h={CPU_H}
            heat={0} label="CPU" value="—" />
        : clusters.map((c, i) => {
            const y    = CPU_Y + i * (Math.round(clusterH) + clusterGap)
            const heat = Math.min(1, (c.active_residency_pct ?? 0) / 100)
            const freq = c.frequency_mhz
              ? `${(c.frequency_mhz / 1000).toFixed(2)} GHz`
              : null
            return (
              <Block key={c.key}
                x={CPU_X} y={y} w={CPU_W} h={Math.round(clusterH)}
                heat={heat}
                label={`${c.key}-CLUSTER`}
                value={`${Math.round(c.active_residency_pct ?? 0)}%`}
                sub={freq}
              />
            )
          })
      }

      {/* GPU */}
      <Block x={GPU_X} y={CPU_Y} w={GPU_W} h={GPU_H}
        heat={gpuHeat} label="GPU" value={fmtMw(gpuMw)} />

      {/* ANE */}
      <Block x={SIDE_X} y={CPU_Y} w={SIDE_W} h={SIDE_UNIT}
        heat={aneHeat} label="ANE" value={fmtMw(aneMw)} />

      {/* Battery */}
      <Block x={SIDE_X} y={CPU_Y + SIDE_UNIT + 8} w={SIDE_W} h={SIDE_UNIT}
        heat={battHeat}
        label="BATTERY"
        value={battTemp != null ? `${battTemp.toFixed(1)}°C` : '—'}
      />

      {/* legend */}
      <rect x={CX+4} y={CY+CH+4} width={160} height={4} rx={2}
        fill="url(#tm-legend)" opacity={0.6} />
      <text x={CX+4}   y={CY+CH+16} fontSize={6.5} fontFamily="monospace"
        fill="rgba(111,212,255,.55)">cold</text>
      <text x={CX+168} y={CY+CH+16} fontSize={6.5} fontFamily="monospace"
        fill="rgba(255,95,122,.55)" textAnchor="end">hot</text>
    </svg>
  )
}
