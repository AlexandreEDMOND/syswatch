export default function ProcessesCard({ procs }) {
  if (!procs || procs.length === 0) {
    return <div className="proc-empty">—</div>
  }

  const maxCpu = Math.max(...procs.map(p => p.cpu), 1)

  return (
    <div className="proc-list">
      {procs.map(p => (
        <div key={p.pid} className="proc-row">
          <span className="proc-name" title={p.name}>{p.name}</span>
          <div className="proc-bar-wrap">
            <div
              className="proc-bar"
              style={{ width: `${(p.cpu / maxCpu) * 100}%` }}
            />
          </div>
          <span className="proc-cpu">{p.cpu.toFixed(1)}<span className="unit">%</span></span>
          <span className="proc-mem">{p.mem_mb >= 1000 ? `${(p.mem_mb / 1024).toFixed(1)}G` : `${p.mem_mb}M`}</span>
        </div>
      ))}
    </div>
  )
}
