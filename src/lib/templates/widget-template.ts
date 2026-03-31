import { User } from '@prisma/client';

interface WidgetTemplateData {
    user: {
        name: string | null;
        publicProfileStats: {
            showWinRate?: boolean;
            showEquityCurve?: boolean;
            showPrismScore?: boolean;
        } | null;
    };
    stats: {
        winRate: number;
        profitFactor: number;
        totalTrades: number;
        prismScore: number;
        equityCurve: { date: string; value: number }[];
    };
}

export function generateWidgetHtml(data: WidgetTemplateData): string {
    const { user, stats } = data;
    const showWinRate = user.publicProfileStats?.showWinRate ?? true;
    const showEquityCurve = user.publicProfileStats?.showEquityCurve ?? true;
    const showPrismScore = user.publicProfileStats?.showPrismScore ?? true;

    // Calculate equity curve path
    const chartWidth = 260;
    const chartHeight = 80;
    const padding = 10;
    
    const values = stats.equityCurve.map(p => p.value);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal || 1;
    
    const points = stats.equityCurve.map((point, i) => {
        const x = padding + (i / (stats.equityCurve.length - 1 || 1)) * (chartWidth - padding * 2);
        const y = chartHeight - padding - ((point.value - minVal) / range) * (chartHeight - padding * 2);
        return `${x},${y}`;
    }).join(' ');

    const isPositive = stats.equityCurve.length > 0 && 
        stats.equityCurve[stats.equityCurve.length - 1].value >= (stats.equityCurve[0]?.value || 0);
    const lineColor = isPositive ? '#4ade80' : '#f87171';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #0a0a0a 0%, #1a0a20 100%);
      color: #ffffff;
      width: 300px;
      height: 200px;
      overflow: hidden;
    }
    
    .widget {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      padding: 16px;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    
    .logo {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .logo-icon {
      width: 24px;
      height: 24px;
      background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%);
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 12px;
    }
    
    .logo-text {
      font-size: 12px;
      font-weight: 600;
      color: #a0a0a0;
    }
    
    .stats-row {
      display: flex;
      gap: 16px;
      margin-bottom: 12px;
    }
    
    .stat {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    
    .stat-label {
      font-size: 9px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .stat-value {
      font-size: 14px;
      font-weight: bold;
    }
    
    .stat-value.positive { color: #4ade80; }
    .stat-value.negative { color: #f87171; }
    .stat-value.neutral { color: #ffffff; }
    
    .chart-container {
      flex: 1;
      background: rgba(255,255,255,0.02);
      border-radius: 6px;
      border: 1px solid rgba(255,255,255,0.05);
      overflow: hidden;
    }
    
    .chart-svg {
      width: 100%;
      height: 100%;
    }
    
    .footer {
      margin-top: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .prism-score {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .score-circle {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: bold;
    }
    
    .score-label {
      font-size: 9px;
      color: #6b7280;
    }
    
    .trades-count {
      font-size: 10px;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="widget">
    <div class="header">
      <div class="logo">
        <div class="logo-icon">P</div>
        <span class="logo-text">PrismJournal</span>
      </div>
    </div>
    
    <div class="stats-row">
      ${showWinRate ? `
      <div class="stat">
        <span class="stat-label">Win Rate</span>
        <span class="stat-value neutral">${stats.winRate.toFixed(1)}%</span>
      </div>
      ` : ''}
      <div class="stat">
        <span class="stat-label">Profit Factor</span>
        <span class="stat-value ${stats.profitFactor >= 1 ? 'positive' : 'negative'}">${stats.profitFactor.toFixed(2)}</span>
      </div>
    </div>
    
    ${showEquityCurve && stats.equityCurve.length > 1 ? `
    <div class="chart-container">
      <svg class="chart-svg" viewBox="0 0 ${chartWidth} ${chartHeight}" preserveAspectRatio="none">
        <defs>
          <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="${lineColor}" stop-opacity="0.3" />
            <stop offset="100%" stop-color="${lineColor}" stop-opacity="0" />
          </linearGradient>
        </defs>
        <polygon 
          points="${padding},${chartHeight - padding} ${points} ${chartWidth - padding},${chartHeight - padding}"
          fill="url(#areaGradient)"
        />
        <polyline 
          points="${points}"
          fill="none"
          stroke="${lineColor}"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </div>
    ` : '<div class="chart-container"></div>'}
    
    <div class="footer">
      ${showPrismScore ? `
      <div class="prism-score">
        <div class="score-circle">${stats.prismScore}</div>
        <span class="score-label">Prism Score</span>
      </div>
      ` : '<div></div>'}
      <span class="trades-count">${stats.totalTrades} trades</span>
    </div>
  </div>
</body>
</html>`;
}