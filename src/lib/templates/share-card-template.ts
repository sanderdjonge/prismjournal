// src/lib/templates/share-card-template.ts

import { TradeDirection } from '@prisma/client';

interface ShareCardTemplateData {
  trade: {
    symbol: string;
    direction: TradeDirection;
    entryPrice: number;
    exitPrice: number | null;
    stopLoss: number | null;
    takeProfit: number | null;
    pnl: number;
    rrMultiple: number | null;
    openedAt: Date;
    closedAt: Date | null;
  };
  screenshotUrl?: string;
  showPrismScore: boolean;
  prismScore?: number;
  winRate?: number;
  profitFactor?: number;
}

export type { ShareCardTemplateData };

export function generateShareCardHtml(data: ShareCardTemplateData): string {
  const { trade, screenshotUrl, showPrismScore, prismScore, winRate, profitFactor } = data;
  
  const isProfit = trade.pnl >= 0;
  const pnlColor = isProfit ? '#4ade80' : '#f87171';
  const pnlSign = isProfit ? '+' : '';
  const directionColor = trade.direction === 'LONG' ? '#4ade80' : '#f87171';
  const directionBg = trade.direction === 'LONG' ? 'rgba(74, 222, 128, 0.2)' : 'rgba(248, 113, 113, 0.2)';
  
  const formatPrice = (price: number) => {
    const decimals = price.toString().includes('.') 
      ? Math.min(price.toString().split('.')[1]?.length || 2, 5)
      : 2;
    return price.toFixed(decimals);
  };

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
      width: 600px;
      height: 350px;
      overflow: hidden;
    }
    
    .card {
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
      height: 40px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
      padding-bottom: 12px;
    }
    
    .logo {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .logo-icon {
      width: 28px;
      height: 28px;
      background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%);
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 16px;
    }
    
    .logo-text {
      font-size: 16px;
      font-weight: 600;
      color: #a0a0a0;
    }
    
    .badge {
      background: rgba(168, 85, 247, 0.2);
      color: #a855f7;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
    }
    
    .content {
      flex: 1;
      display: flex;
      gap: 16px;
      padding: 16px 0;
    }
    
    .chart-section {
      flex: 1;
      background: rgba(255,255,255,0.02);
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.05);
      overflow: hidden;
      position: relative;
    }
    
    .chart-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    
    .chart-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      color: #6b7280;
    }
    
    .chart-placeholder .symbol {
      font-size: 28px;
      font-weight: bold;
      color: #ffffff;
    }
    
    .chart-placeholder .direction-badge {
      padding: 4px 16px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
      background: ${directionBg};
      color: ${directionColor};
    }
    
    .details-section {
      width: 180px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    .symbol-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .symbol {
      font-size: 24px;
      font-weight: bold;
    }
    
    .direction-badge {
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: bold;
      background: ${directionBg};
      color: ${directionColor};
    }
    
    .stats-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .stat-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .stat-label {
      color: #6b7280;
      font-size: 12px;
    }
    
    .stat-value {
      font-size: 13px;
      font-weight: 500;
    }
    
    .pnl-value {
      font-size: 20px;
      font-weight: bold;
      color: ${pnlColor};
    }
    
    .rr-value {
      font-size: 14px;
      font-weight: 600;
    }
    
    .footer {
      height: 56px;
      border-top: 1px solid rgba(255,255,255,0.1);
      padding-top: 12px;
      display: flex;
      align-items: center;
      gap: 24px;
    }
    
    .prism-score {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .score-circle {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      font-weight: bold;
    }
    
    .score-label {
      font-size: 11px;
      color: #6b7280;
    }
    
    .footer-stat {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    
    .footer-stat-label {
      font-size: 10px;
      color: #6b7280;
      text-transform: uppercase;
    }
    
    .footer-stat-value {
      font-size: 14px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo">
        <div class="logo-icon">P</div>
        <span class="logo-text">PrismJournal</span>
      </div>
      <div class="badge">Trade Shared</div>
    </div>
    
    <div class="content">
      <div class="chart-section">
        ${screenshotUrl 
          ? `<img class="chart-image" src="${screenshotUrl}" alt="Chart" />`
          : `<div class="chart-placeholder">
              <div class="symbol">${trade.symbol}</div>
              <div class="direction-badge">${trade.direction}</div>
            </div>`
        }
      </div>
      
      <div class="details-section">
        <div class="symbol-row">
          <span class="symbol">${trade.symbol}</span>
          <span class="direction-badge">${trade.direction}</span>
        </div>
        
        <div class="stats-group">
          <div class="stat-row">
            <span class="stat-label">Entry</span>
            <span class="stat-value">${formatPrice(trade.entryPrice)}</span>
          </div>
          ${trade.exitPrice !== null ? `
          <div class="stat-row">
            <span class="stat-label">Exit</span>
            <span class="stat-value">${formatPrice(trade.exitPrice)}</span>
          </div>
          ` : ''}
          
          <div class="stat-row">
            <span class="stat-label">P&L</span>
            <span class="pnl-value">${pnlSign}$${Math.abs(trade.pnl).toFixed(2)}</span>
          </div>
          
          ${trade.rrMultiple !== null ? `
          <div class="stat-row">
            <span class="stat-label">R:R</span>
            <span class="rr-value">${trade.rrMultiple.toFixed(1)}</span>
          </div>
          ` : ''}
        </div>
      </div>
    </div>
    
    ${showPrismScore ? `
    <div class="footer">
      <div class="prism-score">
        <div class="score-circle">${prismScore ?? '--'}</div>
        <span class="score-label">Prism Score</span>
      </div>
      
      ${winRate !== undefined ? `
      <div class="footer-stat">
        <span class="footer-stat-label">Win Rate</span>
        <span class="footer-stat-value">${winRate}%</span>
      </div>
      ` : ''}
      
      ${profitFactor !== undefined ? `
      <div class="footer-stat">
        <span class="footer-stat-label">Profit Factor</span>
        <span class="footer-stat-value">${profitFactor.toFixed(1)}</span>
      </div>
      ` : ''}
    </div>
    ` : ''}
  </div>
</body>
</html>`;
}