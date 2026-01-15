'use client'

interface SystemStatsData {
  hostname: string
  platform: string
  arch: string
  cpu: {
    model: string
    cores: number
    percent: string
  }
  memory: {
    total: string
    used: string
    percent: string
  }
  disk: {
    total: string
    used: string
    percent: string
  }
}

interface SystemStatsProps {
  stats: SystemStatsData
}

export default function SystemStats({ stats }: SystemStatsProps) {
  const parsePercentage = (percentStr: string) => {
    return parseFloat(percentStr?.replace('%', '') || '0')
  }

  const getColor = (percentage: number) => {
    if (percentage > 80) return '#ff0040'
    if (percentage > 50) return '#ffaa00'
    return '#00ff41'
  }

  return (
    <div className="cyber-card mb-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold gradient-text mb-2">&gt; DOCKER HOST SYSTEM</h2>
        <p className="text-sm text-gray-400 font-mono">
          {stats.hostname} | {stats.platform} {stats.arch}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* CPU */}
        <div className="bg-[#1a1a1a] rounded-lg p-4 border border-[#2a2a2a]">
          <div className="mb-3">
            <h3 className="text-sm text-gray-400 mb-1">CPU</h3>
            <p className="text-xs text-gray-500 font-mono truncate">{stats.cpu.model}</p>
            <p className="text-xs text-gray-500">{stats.cpu.cores} cores</p>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-2">
              <span className="text-gray-400">Usage</span>
              <span
                className="font-bold"
                style={{ color: getColor(parsePercentage(stats.cpu.percent)) }}
              >
                {stats.cpu.percent}
              </span>
            </div>
            <div className="h-3 bg-[#0a0a0a] rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${Math.min(parsePercentage(stats.cpu.percent), 100)}%`,
                  backgroundColor: getColor(parsePercentage(stats.cpu.percent)),
                  boxShadow: `0 0 15px ${getColor(parsePercentage(stats.cpu.percent))}`
                }}
              />
            </div>
          </div>
        </div>

        {/* Memory */}
        <div className="bg-[#1a1a1a] rounded-lg p-4 border border-[#2a2a2a]">
          <div className="mb-3">
            <h3 className="text-sm text-gray-400 mb-1">Memory</h3>
            <p className="text-xs text-gray-500 font-mono">
              {stats.memory.used} / {stats.memory.total}
            </p>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-2">
              <span className="text-gray-400">Usage</span>
              <span
                className="font-bold"
                style={{ color: getColor(parsePercentage(stats.memory.percent)) }}
              >
                {stats.memory.percent}
              </span>
            </div>
            <div className="h-3 bg-[#0a0a0a] rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${Math.min(parsePercentage(stats.memory.percent), 100)}%`,
                  backgroundColor: getColor(parsePercentage(stats.memory.percent)),
                  boxShadow: `0 0 15px ${getColor(parsePercentage(stats.memory.percent))}`
                }}
              />
            </div>
          </div>
        </div>

        {/* Disk */}
        <div className="bg-[#1a1a1a] rounded-lg p-4 border border-[#2a2a2a]">
          <div className="mb-3">
            <h3 className="text-sm text-gray-400 mb-1">Disk</h3>
            <p className="text-xs text-gray-500 font-mono">
              {stats.disk.used} / {stats.disk.total}
            </p>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-2">
              <span className="text-gray-400">Usage</span>
              <span
                className="font-bold"
                style={{ color: getColor(parsePercentage(stats.disk.percent)) }}
              >
                {stats.disk.percent}
              </span>
            </div>
            <div className="h-3 bg-[#0a0a0a] rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${Math.min(parsePercentage(stats.disk.percent), 100)}%`,
                  backgroundColor: getColor(parsePercentage(stats.disk.percent)),
                  boxShadow: `0 0 15px ${getColor(parsePercentage(stats.disk.percent))}`
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
