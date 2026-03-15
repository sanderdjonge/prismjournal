import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY;

// Initialize Resend client lazily
function getResendClient(): Resend | null {
  if (!RESEND_API_KEY) {
    return null;
  }
  return new Resend(RESEND_API_KEY);
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface WeeklyDigestData {
  email: string;
  userName?: string;
  weekStart: Date;
  weekEnd: Date;
  netPnl: number;
  returnOnEquity: number;
  totalTrades: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  winRateChange: number | null;
  profitFactor: number;
  avgRR: number;
  dailyPnl: { day: string; pnl: number }[];
  topInstruments: {
    symbol: string;
    trades: number;
    winRate: number;
    pnl: number;
  }[];
  maxDrawdown: number;
  largestWin: number;
  largestLoss: number;
  avgWin: number;
  avgLoss: number;
  accountBalance: number;
  dashboardUrl: string;
}

/**
 * Send a weekly performance digest email
 */
export async function sendWeeklyDigestEmail(data: WeeklyDigestData): Promise<EmailResult> {
  const resend = getResendClient();
  if (!resend) {
    return { success: false, error: 'Resend API key not configured' };
  }

  const {
    email,
    // userName is available in data but not currently used in email template
    weekStart,
    weekEnd,
    netPnl,
    returnOnEquity,
    totalTrades,
    winCount,
    lossCount,
    winRate,
    winRateChange,
    profitFactor,
    avgRR,
    dailyPnl,
    topInstruments,
    maxDrawdown,
    largestWin,
    largestLoss,
    avgWin,
    avgLoss,
    accountBalance,
    dashboardUrl,
  } = data;

  // Format dates
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const weekStartStr = formatDate(weekStart);
  const weekEndStr = formatDate(weekEnd);

  // Format currency
  const formatCurrency = (value: number) => {
    const prefix = value >= 0 ? '+' : '';
    return `${prefix}$${Math.abs(value).toFixed(2)}`;
  };

  // Format percentage
  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  // Determine P&L color class
  const pnlColor = netPnl >= 0 ? '#4ade80' : '#f87171';
  const pnlPrefix = netPnl >= 0 ? '+' : '';

  // Calculate max bar width for daily P&L chart
  const maxDailyPnl = Math.max(...dailyPnl.map(d => Math.abs(d.pnl)), 1);
  const maxBarWidth = 160;

  // Generate daily P&L bars HTML
  const dailyPnlHtml = dailyPnl.map(({ day, pnl }) => {
    const barWidth = Math.max(8, (Math.abs(pnl) / maxDailyPnl) * maxBarWidth);
    const barColor = pnl >= 0 ? '#4ade80' : '#f87171';
    const pnlColor = pnl >= 0 ? '#4ade80' : '#f87171';
    return `
      <tr>
        <td width="36" style="font-size:12px;color:#94a3b8;padding:3px 0;">${day}</td>
        <td style="padding:3px 8px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="background-color:${barColor};height:14px;width:${barWidth}px;border-radius:3px;"></td>
          </tr></table>
        </td>
        <td width="70" style="font-size:12px;color:${pnlColor};text-align:right;padding:3px 0;">${formatCurrency(pnl)}</td>
      </tr>`;
  }).join('');

  // Generate top instruments HTML
  const instrumentsHtml = topInstruments.slice(0, 5).map((inst, idx) => {
    const instPnlColor = inst.pnl >= 0 ? '#4ade80' : '#f87171';
    const padding = idx === 0 ? '10px 0 0' : '8px 0 0';
    return `
      <tr>
        <td style="font-size:13px;color:#e2e8f0;font-weight:600;padding:${padding};">${inst.symbol}</td>
        <td style="font-size:13px;color:#94a3b8;padding:${padding};text-align:center;">${inst.trades}</td>
        <td style="font-size:13px;color:#94a3b8;padding:${padding};text-align:center;">${formatPercent(inst.winRate)}</td>
        <td style="font-size:13px;color:${instPnlColor};font-weight:600;padding:${padding};text-align:right;">${formatCurrency(inst.pnl)}</td>
      </tr>`;
  }).join('');

  // Win rate change indicator
  const winRateChangeHtml = winRateChange !== null
    ? `<p style="margin:2px 0 0;font-size:12px;color:${winRateChange >= 0 ? '#4ade80' : '#f87171'};">${winRateChange >= 0 ? '▲' : '▼'} ${Math.abs(winRateChange).toFixed(1)}% vs last week</p>`
    : '<p style="margin:2px 0 0;font-size:12px;color:#64748b;">First week tracked</p>';

  // Drawdown bar width (assuming 10% threshold)
  const drawdownBarWidth = Math.min(100, (maxDrawdown / 10) * 100);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>PrismJournal — Weekly Digest</title>
</head>
<body style="margin:0;padding:0;background-color:#0f0f23;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f0f23;">
<tr><td align="center" style="padding:24px 16px;">

<!-- Container -->
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

<!-- Header -->
<tr><td style="padding:32px 32px 16px;text-align:center;">
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
    <tr>
      <td style="width:36px;height:36px;background:linear-gradient(135deg,#818cf8,#6366f1);border-radius:8px;text-align:center;vertical-align:middle;font-size:18px;">💎</td>
      <td style="padding-left:12px;font-size:22px;font-weight:700;color:#e2e8f0;letter-spacing:-0.5px;">PrismJournal</td>
    </tr>
  </table>
  <p style="margin:8px 0 0;font-size:13px;color:#64748b;">Weekly Performance Digest</p>
</td></tr>

<!-- Period Banner -->
<tr><td style="padding:0 32px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#1e1b4b,#312e81);border-radius:12px;">
    <tr><td style="padding:20px 24px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#a5b4fc;text-transform:uppercase;letter-spacing:1px;">Week of</p>
      <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#e0e7ff;">${weekStartStr} – ${weekEndStr}</p>
    </td></tr>
  </table>
</td></tr>

<!-- P&L Hero -->
<tr><td style="padding:16px 32px 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1a1a2e;border:1px solid #2d2d44;border-radius:12px;">
    <tr><td style="padding:24px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Net P&L This Week</p>
      <p style="margin:8px 0 0;font-size:36px;font-weight:800;color:${pnlColor};letter-spacing:-1px;">${pnlPrefix}$${Math.abs(netPnl).toFixed(2)}</p>
      <p style="margin:4px 0 0;font-size:13px;color:${pnlColor};">${returnOnEquity >= 0 ? '▲' : '▼'} ${Math.abs(returnOnEquity).toFixed(2)}% return on equity</p>
    </td></tr>
  </table>
</td></tr>

<!-- Stats Grid (2x2) -->
<tr><td style="padding:12px 32px 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td width="49%" style="padding-right:6px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1a1a2e;border:1px solid #2d2d44;border-radius:10px;">
          <tr><td style="padding:16px 20px;">
            <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Trades</p>
            <p style="margin:4px 0 0;font-size:24px;font-weight:700;color:#e2e8f0;">${totalTrades}</p>
            <p style="margin:2px 0 0;font-size:12px;color:#64748b;">${winCount} wins · ${lossCount} losses</p>
          </td></tr>
        </table>
      </td>
      <td width="49%" style="padding-left:6px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1a1a2e;border:1px solid #2d2d44;border-radius:10px;">
          <tr><td style="padding:16px 20px;">
            <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Win Rate</p>
            <p style="margin:4px 0 0;font-size:24px;font-weight:700;color:#e2e8f0;">${formatPercent(winRate)}</p>
            ${winRateChangeHtml}
          </td></tr>
        </table>
      </td>
    </tr>
    <tr><td colspan="2" style="height:12px;"></td></tr>
    <tr>
      <td width="49%" style="padding-right:6px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1a1a2e;border:1px solid #2d2d44;border-radius:10px;">
          <tr><td style="padding:16px 20px;">
            <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Profit Factor</p>
            <p style="margin:4px 0 0;font-size:24px;font-weight:700;color:#e2e8f0;">${profitFactor.toFixed(2)}</p>
            <p style="margin:2px 0 0;font-size:12px;color:#64748b;">Target: > 1.5</p>
          </td></tr>
        </table>
      </td>
      <td width="49%" style="padding-left:6px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1a1a2e;border:1px solid #2d2d44;border-radius:10px;">
          <tr><td style="padding:16px 20px;">
            <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Avg R:R</p>
            <p style="margin:4px 0 0;font-size:24px;font-weight:700;color:#e2e8f0;">${avgRR.toFixed(2)}</p>
            <p style="margin:2px 0 0;font-size:12px;color:#64748b;">Risk-to-reward ratio</p>
          </td></tr>
        </table>
      </td>
    </tr>
  </table>
</td></tr>

<!-- Daily P&L -->
<tr><td style="padding:16px 32px 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1a1a2e;border:1px solid #2d2d44;border-radius:12px;">
    <tr><td style="padding:20px 24px 8px;">
      <p style="margin:0;font-size:13px;font-weight:600;color:#e2e8f0;">Daily P&L</p>
    </td></tr>
    <tr><td style="padding:0 24px 20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dailyPnlHtml}
      </table>
    </td></tr>
  </table>
</td></tr>

<!-- Top Instruments -->
<tr><td style="padding:16px 32px 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1a1a2e;border:1px solid #2d2d44;border-radius:12px;">
    <tr><td style="padding:20px 24px 8px;">
      <p style="margin:0;font-size:13px;font-weight:600;color:#e2e8f0;">Top Instruments</p>
    </td></tr>
    <tr><td style="padding:0 24px 20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-size:11px;color:#64748b;text-transform:uppercase;padding:0 0 8px;border-bottom:1px solid #2d2d44;">Symbol</td>
          <td style="font-size:11px;color:#64748b;text-transform:uppercase;padding:0 0 8px;border-bottom:1px solid #2d2d44;text-align:center;">Trades</td>
          <td style="font-size:11px;color:#64748b;text-transform:uppercase;padding:0 0 8px;border-bottom:1px solid #2d2d44;text-align:center;">Win%</td>
          <td style="font-size:11px;color:#64748b;text-transform:uppercase;padding:0 0 8px;border-bottom:1px solid #2d2d44;text-align:right;">P&L</td>
        </tr>
        ${instrumentsHtml}
      </table>
    </td></tr>
  </table>
</td></tr>

<!-- Risk Summary -->
<tr><td style="padding:16px 32px 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1a1a2e;border:1px solid #2d2d44;border-radius:12px;">
    <tr><td style="padding:20px 24px 8px;">
      <p style="margin:0;font-size:13px;font-weight:600;color:#e2e8f0;">Risk Overview</p>
    </td></tr>
    <tr><td style="padding:0 24px 20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:6px 0;font-size:13px;color:#94a3b8;">Max Drawdown</td>
          <td style="padding:6px 0;font-size:13px;color:#e2e8f0;text-align:right;font-weight:600;">${formatPercent(maxDrawdown)}</td>
        </tr>
        <tr>
          <td colspan="2" style="padding:0 0 6px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background-color:#2d2d44;height:6px;border-radius:3px;">
                  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                    <td style="background:linear-gradient(90deg,#4ade80,#facc15);height:6px;width:${drawdownBarWidth}%;border-radius:3px;"></td>
                  </tr></table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-size:13px;color:#94a3b8;">Largest Win</td>
          <td style="padding:6px 0;font-size:13px;color:#4ade80;text-align:right;font-weight:600;">${formatCurrency(largestWin)}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-size:13px;color:#94a3b8;">Largest Loss</td>
          <td style="padding:6px 0;font-size:13px;color:#f87171;text-align:right;font-weight:600;">${formatCurrency(largestLoss)}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-size:13px;color:#94a3b8;">Avg Win / Avg Loss</td>
          <td style="padding:6px 0;font-size:13px;color:#e2e8f0;text-align:right;font-weight:600;">$${avgWin.toFixed(2)} / $${avgLoss.toFixed(2)}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-size:13px;color:#94a3b8;">Account Balance</td>
          <td style="padding:6px 0;font-size:13px;color:#e2e8f0;text-align:right;font-weight:600;">$${accountBalance.toFixed(2)}</td>
        </tr>
      </table>
    </td></tr>
  </table>
</td></tr>

<!-- CTA Button -->
<tr><td style="padding:24px 32px 0;text-align:center;">
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
    <tr>
      <td style="background:linear-gradient(135deg,#6366f1,#818cf8);border-radius:8px;">
        <a href="${dashboardUrl}" target="_blank" style="display:inline-block;padding:12px 32px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">View Full Dashboard →</a>
      </td>
    </tr>
  </table>
</td></tr>

<!-- Footer -->
<tr><td style="padding:32px 32px 16px;text-align:center;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #2d2d44;">
    <tr><td style="padding:20px 0 0;text-align:center;">
      <p style="margin:0;font-size:12px;color:#64748b;">You're receiving this because you enabled weekly digest in your <a href="${dashboardUrl.replace('/dashboard', '/settings')}" style="color:#818cf8;text-decoration:none;">notification settings</a>.</p>
      <p style="margin:8px 0 0;font-size:11px;color:#475569;">PrismJournal — Trade smarter, not harder.</p>
    </td></tr>
  </table>
</td></tr>

</table>
<!-- /Container -->

</td></tr>
</table>
</body>
</html>`;

  try {
    const { data: result, error } = await resend.emails.send({
      from: 'PrismJournal <noreply@we-share.nl>',
      to: email,
      subject: `Weekly Digest: ${weekStartStr} – ${weekEndStr}`,
      html,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, messageId: result?.id };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

/**
 * Send a test email to verify Resend configuration
 */
export async function sendTestEmail(toEmail: string): Promise<EmailResult> {
  const resend = getResendClient();
  if (!resend) {
    return { success: false, error: 'Resend API key not configured' };
  }

  try {
    const { data: result, error } = await resend.emails.send({
      from: 'PrismJournal <noreply@we-share.nl>',
      to: toEmail,
      subject: 'PrismJournal - Email Configuration Test',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #6366f1;">✅ Email Configuration Successful</h1>
          <p>Your PrismJournal email notifications are working correctly!</p>
          <p style="color: #64748b; font-size: 14px;">This is a test email sent from PrismJournal.</p>
        </div>
      `,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, messageId: result?.id };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

/**
 * Send an MDD (Max Drawdown) alert email
 */
export async function sendMddAlertEmail(
  email: string,
  currentDrawdown: number,
  threshold: number
): Promise<EmailResult> {
  const resend = getResendClient();
  if (!resend) {
    return { success: false, error: 'Resend API key not configured' };
  }

  try {
    const { data: result, error } = await resend.emails.send({
      from: 'PrismJournal <noreply@we-share.nl>',
      to: email,
      subject: `⚠️ Max Drawdown Alert: ${currentDrawdown.toFixed(1)}%`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #0f0f23; color: #e2e8f0;">
          <h1 style="color: #f87171;">⚠️ Max Drawdown Alert</h1>
          <p>Your account has reached the maximum drawdown threshold.</p>
          <div style="background-color: #1a1a2e; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p style="margin: 0; color: #94a3b8;">Current Drawdown</p>
            <p style="margin: 8px 0 0; font-size: 32px; font-weight: bold; color: #f87171;">${currentDrawdown.toFixed(2)}%</p>
            <p style="margin: 8px 0 0; color: #64748b;">Threshold: ${threshold.toFixed(1)}%</p>
          </div>
          <p style="color: #94a3b8;">Consider reviewing your open positions and risk management strategy.</p>
        </div>
      `,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, messageId: result?.id };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}
