'use client'

import { useState } from 'react'
import type { CorrelationMatrixData, CorrelationCell } from '@/hooks/useWhatIfCorrelation'

interface CorrelationHeatmapProps {
  data: CorrelationMatrixData
}

function getCellColor(value: number): string {
  if (value >= 0) {
    const intensity = Math.min(value, 1)
    const r = Math.round(255 - intensity * 195)
    const g = Math.round(255 - intensity * 45)
    const b = Math.round(255 - intensity * 195)
    return `rgb(${r}, ${g}, ${b})`
  }
  const intensity = Math.min(Math.abs(value), 1)
  const r = Math.round(255 - intensity * 45)
  const g = Math.round(255 - intensity * 195)
  const b = Math.round(255 - intensity * 195)
  return `rgb(${r}, ${g}, ${b})`
}

function getTextColor(value: number): string {
  return Math.abs(value) > 0.5 ? '#ffffff' : '#1f2937'
}

function formatVariable(name: string): string {
  return name.replace(/([A-Z])/g, ' $1').trim()
}

export function CorrelationHeatmap({ data }: CorrelationHeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null)
  const [tooltip, setTooltip] = useState<{
    x: number
    y: number
    row: string
    col: string
    value: number
    significance?: string
  } | null>(null)

  const { variables, matrix } = data
  const cellSize = Math.max(48, Math.min(72, 600 / variables.length))
  const labelWidth = 90
  const headerHeight = 90

  function handleMouseMove(
    e: React.MouseEvent,
    rowIdx: number,
    colIdx: number,
    cell: CorrelationCell
  ) {
    const rect = (e.currentTarget as HTMLElement).closest('.heatmap-container')?.getBoundingClientRect()
    if (!rect) return
    setTooltip({
      x: e.clientX - rect.left + 12,
      y: e.clientY - rect.top - 28,
      row: cell.row,
      col: cell.column,
      value: cell.value,
      significance: cell.significance,
    })
    setHoveredCell({ row: rowIdx, col: colIdx })
  }

  function handleMouseLeave() {
    setTooltip(null)
    setHoveredCell(null)
  }

  return (
    <div className="heatmap-container relative overflow-auto">
      <svg
        width={labelWidth + variables.length * cellSize + 20}
        height={headerHeight + variables.length * cellSize + 20}
        className="select-none"
      >
        <g transform={`translate(${labelWidth}, ${headerHeight})`}>
          {variables.map((varName, rowIdx) => (
            <g key={`row-${varName}`}>
              <text
                x={-8}
                y={rowIdx * cellSize + cellSize / 2}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={11}
                fill="#9ca3af"
                fontWeight={500}
              >
                {formatVariable(varName)}
              </text>
              {variables.map((_, colIdx) => {
                const cell = matrix[rowIdx]?.[colIdx]
                if (!cell) return null
                const isDiagonal = rowIdx === colIdx
                const isHoveredRow = hoveredCell?.row === rowIdx
                const isHoveredCol = hoveredCell?.col === colIdx
                const isHighlighted = isHoveredRow || isHoveredCol

                return (
                  <g
                    key={`${rowIdx}-${colIdx}`}
                    onMouseMove={e => handleMouseMove(e, rowIdx, colIdx, cell)}
                    onMouseLeave={handleMouseLeave}
                    className="cursor-crosshair"
                  >
                    <rect
                      x={colIdx * cellSize}
                      y={rowIdx * cellSize}
                      width={cellSize - 1}
                      height={cellSize - 1}
                      rx={3}
                      fill={isDiagonal ? '#4b5563' : getCellColor(cell.value)}
                      opacity={isHighlighted ? 1 : isDiagonal ? 0.6 : 0.85}
                      stroke={isHighlighted ? '#60a5fa' : 'transparent'}
                      strokeWidth={isHighlighted ? 2 : 0}
                    />
                    {!isDiagonal && Math.abs(cell.value) >= 0.15 && (
                      <text
                        x={colIdx * cellSize + (cellSize - 1) / 2}
                        y={rowIdx * cellSize + (cellSize - 1) / 2}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize={10}
                        fontWeight={600}
                        fill={getTextColor(cell.value)}
                      >
                        {cell.value.toFixed(2)}
                      </text>
                    )}
                  </g>
                )
              })}
            </g>
          ))}
          {variables.map((varName, colIdx) => (
            <text
              key={`col-${varName}`}
              x={colIdx * cellSize + cellSize / 2}
              y={-8}
              textAnchor="middle"
              fontSize={11}
              fill="#9ca3af"
              fontWeight={500}
              transform={`rotate(-45, ${colIdx * cellSize + cellSize / 2}, -8)`}
            >
              {formatVariable(varName)}
            </text>
          ))}
        </g>
        <defs>
          <linearGradient id="legend-gradient" x1="0%" x2="100%">
            <stop offset="0%" stopColor="#f87171" />
            <stop offset="50%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#4ade80" />
          </linearGradient>
        </defs>
        <rect
          x={labelWidth}
          y={variables.length * cellSize + headerHeight + 4}
          width={200}
          height={12}
          rx={6}
          fill="url(#legend-gradient)"
        />
        <text x={labelWidth} y={variables.length * cellSize + headerHeight + 32} fontSize={10} fill="#9ca3af">-1.0</text>
        <text x={labelWidth + 190} y={variables.length * cellSize + headerHeight + 32} fontSize={10} fill="#9ca3af">+1.0</text>
        <text x={labelWidth + 95} y={variables.length * cellSize + headerHeight + 32} fontSize={10} fill="#9ca3af" textAnchor="middle">0.0</text>
      </svg>
      {tooltip && (
        <div
          className="pointer-events-none absolute z-50 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-xs text-gray-100 shadow-xl"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="font-semibold">{formatVariable(tooltip.row)} ↔ {formatVariable(tooltip.col)}</div>
          <div>
            Correlation: <span className={tooltip.value >= 0 ? 'text-green-400' : 'text-red-400'}>
              {tooltip.value.toFixed(3)}
            </span>
          </div>
          {tooltip.significance && (
            <div className="text-gray-400">Significance: {tooltip.significance}</div>
          )}
        </div>
      )}
    </div>
  )
}
