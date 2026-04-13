'use client'

import { useMemo, Fragment } from 'react'
import { CorrelationMatrix as CorrelationMatrixType } from '@/lib/services/what-if/correlation-matrix'

interface CorrelationMatrixProps {
  matrix: CorrelationMatrixType
  onCellClick?: (row: string, column: string, value: number) => void
}

const getCorrelationColor = (value: number): string => {
  const absValue = Math.abs(value)
  if (value > 0) {
    // Positive correlation - green shades
    if (absValue >= 0.7) return 'bg-green-500'
    if (absValue >= 0.4) return 'bg-green-600/70'
    if (absValue >= 0.2) return 'bg-green-700/50'
    return 'bg-green-800/30'
  } else if (value < 0) {
    // Negative correlation - red shades
    if (absValue >= 0.7) return 'bg-red-500'
    if (absValue >= 0.4) return 'bg-red-600/70'
    if (absValue >= 0.2) return 'bg-red-700/50'
    return 'bg-red-800/30'
  }
  return 'bg-gray-800' // No correlation
}

export function CorrelationMatrixView({ matrix, onCellClick }: CorrelationMatrixProps) {
  const { variables, matrix: data } = matrix
  
  // Calculate the grid template
  const gridStyle = useMemo(() => ({
    display: 'grid',
    gridTemplateColumns: `120px repeat(${variables.length}, 1fr)`,
    gap: '1px',
  }), [variables.length])
  
  return (
    <div className="rounded-xl bg-surface-card border border-border-color overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-white">
            Filter Correlation Matrix
          </h3>
          <span className="text-[9px] text-gray-500">
            {matrix.tradeCount} trades • {matrix.generatedAt.toLocaleDateString()}
          </span>
        </div>
      </div>
      
      {/* Legend */}
      <div className="px-4 py-2 border-b border-white/5 flex items-center gap-4">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-green-500" />
          <span className="text-[8px] text-gray-400">Strong Positive</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-red-500" />
          <span className="text-[8px] text-gray-400">Strong Negative</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-gray-700" />
          <span className="text-[8px] text-gray-400">No Correlation</span>
        </div>
      </div>
      
      {/* Matrix */}
      <div className="p-2 overflow-x-auto">
        <div style={gridStyle}>
          {/* Empty top-left cell */}
          <div className="p-2" />
          
          {/* Column headers */}
          {variables.map((varName) => (
            <div
              key={`col-${varName}`}
              className="p-1 text-center"
            >
              <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap transform -rotate-45 origin-center block">
                {varName.length > 8 ? varName.slice(0, 8) + '...' : varName}
              </span>
            </div>
          ))}
          
          {/* Rows */}
          {variables.map((rowVar, rowIndex) => (
            <Fragment key={`row-group-${rowIndex}`}>
              {/* Row header */}
              <div
                key={`row-${rowVar}`}
                className="p-2 flex items-center"
              >
                <span className="text-[9px] font-bold text-gray-300 uppercase tracking-widest truncate">
                  {rowVar}
                </span>
              </div>
              
              {/* Cells */}
              {variables.map((colVar, colIndex) => {
                const cell = data[rowIndex][colIndex]
                return (
                  <button
                    key={`${rowVar}-${colVar}`}
                    type="button"
                    onClick={() => onCellClick?.(rowVar, colVar, cell.value)}
                    className={`h-8 rounded ${getCorrelationColor(cell.value)} transition-all hover:ring-2 hover:ring-white/30 flex items-center justify-center`}
                    title={`${rowVar} × ${colVar}: ${cell.value.toFixed(2)}`}
                  >
                    <span className="text-[8px] font-bold text-white">
                      {cell.value.toFixed(1)}
                    </span>
                  </button>
                )
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}

// Simplified mini version for inline display
interface MiniCorrelationProps {
  matrix: CorrelationMatrixType
  highlightFilter?: string
}

export function MiniCorrelationView({ matrix, highlightFilter }: MiniCorrelationProps) {
  const winIndex = matrix.variables.indexOf('win')
  const pnlIndex = matrix.variables.indexOf('pnl')
  
  // Get correlations with win rate
  const correlations = matrix.variables
    .filter((v) => v !== 'win' && v !== 'pnl' && v !== 'rMultiple')
    .map((filter) => {
      const idx = matrix.variables.indexOf(filter)
      const winCorr = matrix.matrix[idx][winIndex].value
      const pnlCorr = matrix.matrix[idx][pnlIndex].value
      return {
        filter,
        avgCorr: (winCorr + pnlCorr) / 2,
        winCorr,
        pnlCorr,
      }
    })
    .sort((a, b) => Math.abs(b.avgCorr) - Math.abs(a.avgCorr))
    .slice(0, 5) // Top 5
  
  return (
    <div className="space-y-1">
      <h4 className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-2">
        Top Filter Correlations
      </h4>
      {correlations.map(({ filter, avgCorr }) => (
        <div
          key={filter}
          className={`flex items-center justify-between p-2 rounded-lg ${
            filter === highlightFilter ? 'bg-primary/20 ring-1 ring-primary/40' : 'bg-white/5'
          }`}
        >
          <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest truncate">
            {filter}
          </span>
          <div className="flex items-center gap-1">
            <div
              className={`w-2 h-2 rounded-full ${
                avgCorr > 0 ? 'bg-green-500' : avgCorr < 0 ? 'bg-red-500' : 'bg-gray-600'
              }`}
            />
            <span className="text-[10px] font-bold text-gray-400">
              {avgCorr > 0 ? '+' : ''}{avgCorr.toFixed(2)}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

// Filter effectiveness summary
interface FilterEffectivenessProps {
  matrix: CorrelationMatrixType
}

export function FilterEffectivenessSummary({ matrix }: FilterEffectivenessProps) {
  const winIndex = matrix.variables.indexOf('win')
  
  const summaries = matrix.variables
    .filter((v) => v !== 'win' && v !== 'pnl' && v !== 'rMultiple')
    .map((filter) => {
      const idx = matrix.variables.indexOf(filter)
      const correlation = matrix.matrix[idx][winIndex].value
      
      let effectiveness = 'neutral'
      if (correlation > 0.2) effectiveness = 'positive'
      else if (correlation < -0.2) effectiveness = 'negative'
      
      return {
        filter,
        correlation,
        effectiveness,
      }
    })
    .sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation))
  
  return (
    <div className="grid grid-cols-2 gap-2">
      {summaries.map(({ filter, correlation, effectiveness }) => (
        <div
          key={filter}
          className={`p-2 rounded-lg border ${
            effectiveness === 'positive'
              ? 'bg-green-500/10 border-green-500/30'
              : effectiveness === 'negative'
              ? 'bg-red-500/10 border-red-500/30'
              : 'bg-gray-800/50 border-gray-700'
          }`}
        >
          <div className="text-[9px] font-black uppercase tracking-widest text-gray-400 truncate">
            {filter}
          </div>
          <div className={`text-lg font-bold ${
            effectiveness === 'positive'
              ? 'text-green-400'
              : effectiveness === 'negative'
              ? 'text-red-400'
              : 'text-gray-500'
          }`}>
            {correlation > 0 ? '+' : ''}{correlation.toFixed(2)}
          </div>
        </div>
      ))}
    </div>
  )
}