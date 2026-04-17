//+------------------------------------------------------------------+
//|                                              PrismTrade.mq5      |
//|                              PrismJournal Visual Trading EA      |
//|                                    v5.3.0-beta                   |
//+------------------------------------------------------------------+
#property copyright "2026, PrismJournal"
#property link      "https://github.com/prismjournal"
#property version   "5.30"
#property description "v5.3-beta: Visual trading toolbar, risk management, PrismJournal sync."
#property strict

#include <Trade\Trade.mqh>

input string   SyncUrl        = "https://your-prismjournal-domain.com/api/sync";
input string   BridgeKey      = "";
input string   Strategy       = "Default";
input double   RiskPercent    = 1.0;
input double   MaxRiskPercent = 5.0;
input int      TimerPeriod    = 60;
input int      HistoryDays    = 90;
input int      Slippage       = 10;

#define  HEADER_CONTENT_TYPE "Content-Type: application/json\r\n"
#define  HEADER_BRIDGE_KEY   "X-Bridge-Key: "
#define  PRISM_PREFIX       "Prsm_"
#define  ERROR_TIP_SECS     5

#define  TOOLBAR_W  160
#define  TOOLBAR_BTN_H  32
#define  TOOLBAR_GAP   4
#define  CONFIRM_W  240

enum PLANNER_STATE
{
   STATE_IDLE = 0,
   STATE_PLACING_ENTRY = 1,
   STATE_PLACING_SL = 2,
   STATE_PLACING_TP = 3,
   STATE_CONFIRMING = 4
};

CTrade         g_Trade;
PLANNER_STATE  g_PlannerState  = STATE_IDLE;
string         g_Direction     = "";
double         g_EntryPrice    = 0;
double         g_SLPrice       = 0;
double         g_TPPrice       = 0;
double         g_CalcLots      = 0;
double         g_CalcRiskMoney = 0;
double         g_CalcRewardMoney = 0;
double         g_CalcRR        = 0;
bool           g_HighRisk      = false;
bool           g_NeedConfirm   = false;
datetime       g_ErrorTipTime   = 0;
bool           g_SyncDone       = false;

int            g_PanelX = 10;
int            g_PanelY = 35;
int            g_DragOffsetX = 0;
int            g_DragOffsetY = 0;
bool           g_DraggingPanel = false;

#define MAX_TRACKED_POSITIONS 200
ulong  g_TrackTickets[MAX_TRACKED_POSITIONS];
double g_TrackMAE[MAX_TRACKED_POSITIONS];
double g_TrackMFE[MAX_TRACKED_POSITIONS];
double g_TrackEntry[MAX_TRACKED_POSITIONS];
long   g_TrackType[MAX_TRACKED_POSITIONS];
int    g_TrackCount = 0;

//+------------------------------------------------------------------+
//| MAE/MFE                                                           |
//+------------------------------------------------------------------+
int FindTrackedIdx(ulong ticket)
{
   for(int i = 0; i < g_TrackCount; i++)
      if(g_TrackTickets[i] == ticket) return i;
   return -1;
}

void InitTrackEntry(ulong ticket, double entryPr, long posType)
{
   if(g_TrackCount >= MAX_TRACKED_POSITIONS) return;
   if(FindTrackedIdx(ticket) != -1) return;
   g_TrackTickets[g_TrackCount] = ticket;
   g_TrackMAE[g_TrackCount]     = 0.0;
   g_TrackMFE[g_TrackCount]     = 0.0;
   g_TrackEntry[g_TrackCount]   = entryPr;
   g_TrackType[g_TrackCount]    = posType;
   g_TrackCount++;
}

void RemoveTrackedIdx(int idx)
{
   if(idx < 0 || idx >= g_TrackCount) return;
   g_TrackCount--;
   if(idx < g_TrackCount)
   {
      g_TrackTickets[idx] = g_TrackTickets[g_TrackCount];
      g_TrackMAE[idx]     = g_TrackMAE[g_TrackCount];
      g_TrackMFE[idx]     = g_TrackMFE[g_TrackCount];
      g_TrackEntry[idx]   = g_TrackEntry[g_TrackCount];
      g_TrackType[idx]    = g_TrackType[g_TrackCount];
   }
}

void UpdateExcursions(ulong ticket, double curLow, double curHigh)
{
   int idx = FindTrackedIdx(ticket);
   if(idx == -1) return;
   double entry = g_TrackEntry[idx];
   long posType = g_TrackType[idx];
   if(posType == POSITION_TYPE_BUY)
   {
      double adverse = entry - curLow;
      double favorable = curHigh - entry;
      if(adverse > g_TrackMAE[idx]) g_TrackMAE[idx] = adverse;
      if(favorable > g_TrackMFE[idx]) g_TrackMFE[idx] = favorable;
   }
   else
   {
      double adverse = curHigh - entry;
      double favorable = entry - curLow;
      if(adverse > g_TrackMAE[idx]) g_TrackMAE[idx] = adverse;
      if(favorable > g_TrackMFE[idx]) g_TrackMFE[idx] = favorable;
   }
}

//+------------------------------------------------------------------+
//| Utility                                                           |
//+------------------------------------------------------------------+
datetime ToGmt(datetime brokerTime)
{
   return brokerTime - (TimeCurrent() - TimeGMT());
}

string OptField(string name, double val, int digits)
{
   if(val == 0) return "";
   return ",\"" + name + "\":" + DoubleToString(val, digits);
}

string CloseReasonStr(long reason)
{
   switch((int)reason)
   {
      case DEAL_REASON_TP:     return "TP";
      case DEAL_REASON_SL:     return "SL";
      case DEAL_REASON_SO:     return "STOP_OUT";
      case DEAL_REASON_EXPERT: return "EA";
      default:                  return "MANUAL";
   }
}

//+------------------------------------------------------------------+
//| Toolbar — OBJ_BUTTON (no CAppDialog)                            |
//+------------------------------------------------------------------+
void CreateToolbar()
{
   int px = g_PanelX;
   int py = g_PanelY;
   int w = TOOLBAR_W;
   int bh = TOOLBAR_BTN_H;
   int gap = TOOLBAR_GAP;

   // Background
   MakeBtn(PRISM_PREFIX + "BG", px - 4, py - 4, w + 8, 5 * (bh + gap) + 12,
           C'20,20,35', C'50,45,80', "");

   // Title bar
   MakeBtn(PRISM_PREFIX + "Title", px, py, w, bh,
           C'80,60,180', C'120,100,240', "PRISM v5.3");

   // BUY
   MakeBtn(PRISM_PREFIX + "Buy", px, py + (bh + gap), w, bh,
           C'16,120,80', C'38,166,154', "BUY / LONG");

   // SELL
   MakeBtn(PRISM_PREFIX + "Sell", px, py + 2 * (bh + gap), w, bh,
           C'150,30,30', C'239,83,80', "SELL / SHORT");

   // Status (shows settings on click or step info)
   MakeBtn(PRISM_PREFIX + "Status", px, py + 3 * (bh + gap), w, 22,
           C'25,25,40', C'40,40,60', "Click BUY or SELL");

   // Cancel/Reset
   MakeBtn(PRISM_PREFIX + "Reset", px, py + 3 * (bh + gap) + 26, w, bh - 4,
           C'60,40,40', C'100,60,60', "Reset / Cancel");

   ChartRedraw(0);
}

void MakeBtn(string name, int x, int y, int w, int h, color bg, color border, string text)
{
   ObjectDelete(0, name);
   ObjectCreate(0, name, OBJ_BUTTON, 0, 0, 0);
   ObjectSetInteger(0, name, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(0, name, OBJPROP_YDISTANCE, y);
   ObjectSetInteger(0, name, OBJPROP_XSIZE, w);
   ObjectSetInteger(0, name, OBJPROP_YSIZE, h);
   ObjectSetInteger(0, name, OBJPROP_BGCOLOR, bg);
   ObjectSetInteger(0, name, OBJPROP_BORDER_COLOR, border);
   ObjectSetInteger(0, name, OBJPROP_COLOR, C'220,220,240');
   ObjectSetInteger(0, name, OBJPROP_FONTSIZE, 10);
   ObjectSetString(0, name, OBJPROP_TEXT, text);
   ObjectSetString(0, name, OBJPROP_FONT, "Arial");
   ObjectSetInteger(0, name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(0, name, OBJPROP_BACK, false);
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, name, OBJPROP_STATE, false);
}

void MakeLabel(string name, int x, int y, color clr, int fontSize, string text)
{
   ObjectDelete(0, name);
   ObjectCreate(0, name, OBJ_LABEL, 0, 0, 0);
   ObjectSetInteger(0, name, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(0, name, OBJPROP_YDISTANCE, y);
   ObjectSetString(0, name, OBJPROP_TEXT, text);
   ObjectSetInteger(0, name, OBJPROP_COLOR, clr);
   ObjectSetInteger(0, name, OBJPROP_FONTSIZE, fontSize);
   ObjectSetString(0, name, OBJPROP_FONT, "Consolas");
   ObjectSetInteger(0, name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(0, name, OBJPROP_BACK, false);
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
}

void DestroyToolbar()
{
   string names[] = {"BG","Title","Buy","Sell","Status","Reset"};
   for(int i = 0; i < ArraySize(names); i++)
      ObjectDelete(0, PRISM_PREFIX + names[i]);
   HideConfirmPanel();
}

void UpdateStatus()
{
   string s = "";
   switch(g_PlannerState)
   {
      case STATE_PLACING_ENTRY: s = ">> Click chart: ENTRY"; break;
      case STATE_PLACING_SL:    s = ">> Click chart: SL"; break;
      case STATE_PLACING_TP:    s = ">> Click chart: TP"; break;
      case STATE_CONFIRMING:    s = ">> Drag SL/TP or EXEC"; break;
      default:                  s = "Click BUY or SELL"; break;
   }
   ObjectSetString(0, PRISM_PREFIX + "Status", OBJPROP_TEXT, s);
}

bool IsOverToolbar(int x, int y)
{
   int px = g_PanelX;
   int py = g_PanelY;
   int bh = TOOLBAR_BTN_H;
   int gap = TOOLBAR_GAP;
   return (x >= px - 4 && x <= px + TOOLBAR_W + 4 &&
           y >= py - 4 && y <= py + 4 * (bh + gap) + 30);
}

int ToolbarRight() { return g_PanelX + TOOLBAR_W + 10; }
int ConfirmLeft()  { return (int)ChartGetInteger(0, CHART_WIDTH_IN_PIXELS) - CONFIRM_W - 20; }

//+------------------------------------------------------------------+
//| Confirm Panel                                                     |
//+------------------------------------------------------------------+
void ShowConfirmPanel()
{
   HideConfirmPanel();

   int px = ConfirmLeft();
   int py = 35;
   int w = CONFIRM_W;
   int rowH = 22;
   int leftM = 14;
   int y = py + 10;

   MakeBtn(PRISM_PREFIX + "CfmBG", px, py, w, 280, C'18,18,36', C'124,106,255', "");
   ObjectSetInteger(0, PRISM_PREFIX + "CfmBG", OBJPROP_COLOR, C'18,18,36');
   ObjectSetInteger(0, PRISM_PREFIX + "CfmBG", OBJPROP_FONTSIZE, 1);

   MakeLabel(PRISM_PREFIX + "CfmDir", px + leftM, y, C'124,106,255', 11, g_Direction + " TRADE"); y += rowH;
   MakeLabel(PRISM_PREFIX + "CfmRisk", px + leftM, y, C'156,163,175', 9, "Risk: " + DoubleToString(RiskPercent, 1) + "%"); y += rowH;
   MakeLabel(PRISM_PREFIX + "CfmLots", px + leftM, y, C'255,255,255', 9, "Lots: " + DoubleToString(g_CalcLots, 2)); y += rowH;
   MakeLabel(PRISM_PREFIX + "CfmRR", px + leftM, y, C'38,166,154', 9, "R:R  1:" + DoubleToString(g_CalcRR, 1)); y += rowH;
   MakeLabel(PRISM_PREFIX + "CfmRisk$", px + leftM, y, C'239,83,80', 9, "Risk  -$" + DoubleToString(g_CalcRiskMoney, 2)); y += rowH;
   MakeLabel(PRISM_PREFIX + "CfmGain$", px + leftM, y, C'38,166,154', 9, "Gain  +$" + DoubleToString(g_CalcRewardMoney, 2)); y += rowH;

   if(g_HighRisk)
   {
      MakeLabel(PRISM_PREFIX + "CfmWarn", px + leftM, y, C'234,179,8', 9,
                g_NeedConfirm ? "HIGH RISK - Click EXEC again" : "Risk exceeds " + DoubleToString(MaxRiskPercent, 0) + "%");
      y += rowH;
   }

   y += 6;
   int halfW = w / 2 - 10;
   MakeBtn(PRISM_PREFIX + "CfmExec", px + 8, y, halfW, 34,
            g_CalcLots <= 0 ? C'40,40,50' : C'124,106,255',
            g_CalcLots <= 0 ? C'60,60,70' : C'124,106,255',
            g_NeedConfirm ? "CONFIRM" : "EXECUTE");
   MakeBtn(PRISM_PREFIX + "CfmCancel", px + halfW + 16, y, halfW, 34,
            C'100,40,40', C'160,60,60', "CANCEL");

   ChartRedraw(0);
}

void HideConfirmPanel()
{
   string names[] = {"CfmBG","CfmDir","CfmRisk","CfmLots","CfmRR","CfmRisk$","CfmGain$","CfmWarn","CfmExec","CfmCancel"};
   for(int i = 0; i < ArraySize(names); i++)
      ObjectDelete(0, PRISM_PREFIX + names[i]);
}

//+------------------------------------------------------------------+
//| Trade Lines (draggable HLINEs)                                   |
//+------------------------------------------------------------------+
void CreateEntryLine(double price)
{
   string name = PRISM_PREFIX + "Entry";
   ObjectDelete(0, name);
   ObjectCreate(0, name, OBJ_HLINE, 0, 0, price);
   ObjectSetInteger(0, name, OBJPROP_COLOR, C'124,106,255');
   ObjectSetInteger(0, name, OBJPROP_STYLE, STYLE_SOLID);
   ObjectSetInteger(0, name, OBJPROP_WIDTH, 2);
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE, true);
   ObjectSetInteger(0, name, OBJPROP_SELECTED, false);
   ObjectSetInteger(0, name, OBJPROP_BACK, false);
   ObjectSetString(0, name, OBJPROP_TEXT, "ENTRY " + DoubleToString(price, _Digits));
}

void CreateSLLine(double price)
{
   string name = PRISM_PREFIX + "SL";
   ObjectDelete(0, name);
   ObjectCreate(0, name, OBJ_HLINE, 0, 0, price);
   ObjectSetInteger(0, name, OBJPROP_COLOR, C'239,83,80');
   ObjectSetInteger(0, name, OBJPROP_STYLE, STYLE_DASH);
   ObjectSetInteger(0, name, OBJPROP_WIDTH, 2);
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE, true);
   ObjectSetInteger(0, name, OBJPROP_SELECTED, false);
   ObjectSetInteger(0, name, OBJPROP_BACK, false);
   ObjectSetString(0, name, OBJPROP_TEXT, "SL " + DoubleToString(price, _Digits));
}

void CreateTPLine(double price)
{
   string name = PRISM_PREFIX + "TP";
   ObjectDelete(0, name);
   ObjectCreate(0, name, OBJ_HLINE, 0, 0, price);
   ObjectSetInteger(0, name, OBJPROP_COLOR, C'38,166,154');
   ObjectSetInteger(0, name, OBJPROP_STYLE, STYLE_DASH);
   ObjectSetInteger(0, name, OBJPROP_WIDTH, 2);
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE, true);
   ObjectSetInteger(0, name, OBJPROP_SELECTED, false);
   ObjectSetInteger(0, name, OBJPROP_BACK, false);
   ObjectSetString(0, name, OBJPROP_TEXT, "TP " + DoubleToString(price, _Digits));
}

void DeleteTradeLines()
{
   ObjectDelete(0, PRISM_PREFIX + "Entry");
   ObjectDelete(0, PRISM_PREFIX + "SL");
   ObjectDelete(0, PRISM_PREFIX + "TP");
}

//+------------------------------------------------------------------+
//| Error / Status                                                     |
//+------------------------------------------------------------------+
void ShowError(string msg)
{
   g_ErrorTipTime = TimeCurrent();
   ObjectSetString(0, PRISM_PREFIX + "Status", OBJPROP_TEXT, msg);
   ObjectSetInteger(0, PRISM_PREFIX + "Status", OBJPROP_COLOR, C'239,83,80');
}

void ClearError()
{
   if(g_ErrorTipTime == 0) return;
   if(TimeCurrent() - g_ErrorTipTime > ERROR_TIP_SECS)
   {
      g_ErrorTipTime = 0;
      ObjectSetInteger(0, PRISM_PREFIX + "Status", OBJPROP_COLOR, C'220,220,240');
      UpdateStatus();
   }
}

//+------------------------------------------------------------------+
//| Normalize price to symbol tick size                               |
//+------------------------------------------------------------------+
double NormPrice(double price)
{
   double tickSize = SymbolInfoDouble(Symbol(), SYMBOL_TRADE_TICK_SIZE);
   if(tickSize > 0)
      return NormalizeDouble(MathRound(price / tickSize) * tickSize, _Digits);
   return NormalizeDouble(price, _Digits);
}

//+------------------------------------------------------------------+
//| Risk Calculation                                                  |
//+------------------------------------------------------------------+
bool CalculateRiskReward()
{
   if(g_EntryPrice == 0 || g_SLPrice == 0 || g_TPPrice == 0) return false;

   double tickSize  = SymbolInfoDouble(Symbol(), SYMBOL_TRADE_TICK_SIZE);
   double tickValue = SymbolInfoDouble(Symbol(), SYMBOL_TRADE_TICK_VALUE_PROFIT);
   double balance   = AccountInfoDouble(ACCOUNT_BALANCE);
   double minLot     = SymbolInfoDouble(Symbol(), SYMBOL_VOLUME_MIN);
   double maxLot     = SymbolInfoDouble(Symbol(), SYMBOL_VOLUME_MAX);
   double lotStep    = SymbolInfoDouble(Symbol(), SYMBOL_VOLUME_STEP);

   double slDistance = MathAbs(g_EntryPrice - g_SLPrice);
   if(slDistance < tickSize * 2)
   {
      g_CalcLots = 0; g_CalcRiskMoney = 0; g_CalcRewardMoney = 0;
      g_CalcRR = 0; g_HighRisk = false; g_NeedConfirm = false;
      return false;
   }

   double riskMoney = balance * RiskPercent / 100.0;
   double ticksInSL = slDistance / tickSize;
   double lotSize   = riskMoney / (ticksInSL * tickValue);

   if(lotStep > 0) lotSize = MathFloor(lotSize / lotStep) * lotStep;
   if(lotSize < minLot) lotSize = minLot;
   if(lotSize > maxLot) lotSize = maxLot;

   g_CalcLots = lotSize;
   g_CalcRiskMoney = lotSize * ticksInSL * tickValue;

   double tpDistance = MathAbs(g_TPPrice - g_EntryPrice);
   g_CalcRewardMoney = lotSize * (tpDistance / tickSize) * tickValue;
   g_CalcRR = (slDistance > 0) ? tpDistance / slDistance : 0;

   double riskPct = (balance > 0) ? (g_CalcRiskMoney / balance * 100.0) : 0;
   g_HighRisk = (riskPct > 2.0);
   g_NeedConfirm = (riskPct > MaxRiskPercent);

   return (lotSize >= minLot);
}

//+------------------------------------------------------------------+
//| Trade Execution                                                   |
//+------------------------------------------------------------------+
bool ExecutePlannedTrade()
{
   if(g_CalcLots <= 0) return false;

   // Normalize all prices
   double sl = NormPrice(g_SLPrice);
   double tp = NormPrice(g_TPPrice);
   double price;
   ENUM_ORDER_TYPE orderType;

   if(g_Direction == "LONG")
   {
      orderType = ORDER_TYPE_BUY;
      price = SymbolInfoDouble(Symbol(), SYMBOL_ASK);
   }
   else
   {
      orderType = ORDER_TYPE_SELL;
      price = SymbolInfoDouble(Symbol(), SYMBOL_BID);
   }

   // Validate stop levels
   long stopLevel = SymbolInfoInteger(Symbol(), SYMBOL_TRADE_STOPS_LEVEL);
   double minDist = stopLevel * SymbolInfoDouble(Symbol(), SYMBOL_POINT);

   if(g_Direction == "LONG")
   {
      if(sl > 0 && price - sl < minDist)
      { ShowError("SL too close (stops level)"); return false; }
      if(tp > 0 && tp - price < minDist)
      { ShowError("TP too close (stops level)"); return false; }
   }
   else
   {
      if(sl > 0 && sl - price < minDist)
      { ShowError("SL too close (stops level)"); return false; }
      if(tp > 0 && price - tp < minDist)
      { ShowError("TP too close (stops level)"); return false; }
   }

   g_Trade.SetDeviationInPoints(Slippage);

   if(!g_Trade.PositionOpen(Symbol(), orderType, g_CalcLots, price, sl, tp, "PrismTrade"))
   {
      int err = (int)g_Trade.ResultRetcode();
      string desc = g_Trade.ResultRetcodeDescription();
      ShowError("FAIL #" + (string)err + ": " + desc);
      return false;
   }

   PrintFormat("PrismTrade: %s %s %.2f lots SL=%.5f TP=%.5f", g_Direction, Symbol(), g_CalcLots, sl, tp);
   return true;
}

//+------------------------------------------------------------------+
//| Position Lines                                                    |
//+------------------------------------------------------------------+
void ShowPositionLines()
{
   int total = PositionsTotal();
   for(int i = 0; i < total; i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0 || !PositionSelectByTicket(ticket)) continue;
      if(PositionGetString(POSITION_SYMBOL) != Symbol()) continue;

      double sl = PositionGetDouble(POSITION_SL);
      double tp = PositionGetDouble(POSITION_TP);

      if(sl > 0)
      {
         string n = PRISM_PREFIX + "PosSL" + (string)ticket;
         ObjectDelete(0, n);
         ObjectCreate(0, n, OBJ_HLINE, 0, 0, sl);
         ObjectSetInteger(0, n, OBJPROP_COLOR, C'239,83,80');
         ObjectSetInteger(0, n, OBJPROP_STYLE, STYLE_DOT);
         ObjectSetInteger(0, n, OBJPROP_WIDTH, 1);
         ObjectSetInteger(0, n, OBJPROP_SELECTABLE, true);
         ObjectSetString(0, n, OBJPROP_TEXT, "Pos SL");
      }
      if(tp > 0)
      {
         string n = PRISM_PREFIX + "PosTP" + (string)ticket;
         ObjectDelete(0, n);
         ObjectCreate(0, n, OBJ_HLINE, 0, 0, tp);
         ObjectSetInteger(0, n, OBJPROP_COLOR, C'38,166,154');
         ObjectSetInteger(0, n, OBJPROP_STYLE, STYLE_DOT);
         ObjectSetInteger(0, n, OBJPROP_WIDTH, 1);
         ObjectSetInteger(0, n, OBJPROP_SELECTABLE, true);
         ObjectSetString(0, n, OBJPROP_TEXT, "Pos TP");
      }
   }
}

void HidePositionLines()
{
   int total = PositionsTotal();
   for(int i = 0; i < total; i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      ObjectDelete(0, PRISM_PREFIX + "PosSL" + (string)ticket);
      ObjectDelete(0, PRISM_PREFIX + "PosTP" + (string)ticket);
   }
}

bool ModifyPositionSLTP(ulong ticket, double newSL, double newTP)
{
   if(!PositionSelectByTicket(ticket)) return false;
   double currentSL = PositionGetDouble(POSITION_SL);
   double currentTP = PositionGetDouble(POSITION_TP);
   if(newSL == 0 && currentSL != 0) newSL = currentSL;
   if(newTP == 0 && currentTP != 0) newTP = currentTP;
   newSL = NormPrice(newSL);
   newTP = NormPrice(newTP);
   if(!g_Trade.PositionModify(ticket, newSL, newTP))
   { ShowError("Modify failed"); return false; }
   SendPositionUpdate(ticket);
   return true;
}

void SendPositionUpdate(ulong ticket)
{
   if(BridgeKey == "" || !PositionSelectByTicket(ticket)) return;
   string acctId = (string)AccountInfoInteger(ACCOUNT_LOGIN);
   string symbol = PositionGetString(POSITION_SYMBOL);
   double volume = PositionGetDouble(POSITION_VOLUME);
   double openPr = PositionGetDouble(POSITION_PRICE_OPEN);
   double profit = PositionGetDouble(POSITION_PROFIT);
   double swap   = PositionGetDouble(POSITION_SWAP);
   double sl     = PositionGetDouble(POSITION_SL);
   double tp     = PositionGetDouble(POSITION_TP);
   datetime time = (datetime)PositionGetInteger(POSITION_TIME);
   long posType  = PositionGetInteger(POSITION_TYPE);
   string ts     = (posType == POSITION_TYPE_BUY) ? "BUY" : "SELL";

   string json = "{\"type\":\"TRADE_UPDATE\",\"platformAccountId\":\"" + acctId + "\","
                 "\"platform\":\"METATRADER5\",\"trade\":{"
                 "\"ticket\":\"POS-" + (string)ticket + "\",\"symbol\":\"" + symbol + "\","
                 "\"type\":\"" + ts + "\",\"volume\":" + DoubleToString(volume, 2) + ","
                 "\"entryPrice\":" + DoubleToString(openPr, 5) + ","
                 "\"pnl\":" + DoubleToString(profit, 2) + ",\"swap\":" + DoubleToString(swap, 2) + ","
                 "\"entryTime\":\"" + TimeToString(ToGmt(time), TIME_DATE|TIME_MINUTES|TIME_SECONDS) + "\","
                 "\"strategy\":\"" + Strategy + "\""
                 + OptField("stopLoss", sl, 5) + OptField("takeProfit", tp, 5) + "}}";
   SendJson(json);
}

//+------------------------------------------------------------------+
//| State Helpers                                                     |
//+------------------------------------------------------------------+
void ResetPlanner()
{
   g_PlannerState = STATE_IDLE;
   g_Direction = ""; g_EntryPrice = 0; g_SLPrice = 0; g_TPPrice = 0;
   g_CalcLots = 0; g_CalcRiskMoney = 0; g_CalcRewardMoney = 0;
   g_CalcRR = 0; g_HighRisk = false; g_NeedConfirm = false;
   DeleteTradeLines();
   HideConfirmPanel();
   ShowPositionLines();
   UpdateStatus();
   ObjectSetInteger(0, PRISM_PREFIX + "Status", OBJPROP_COLOR, C'220,220,240');
}

//+------------------------------------------------------------------+
//| Move Toolbar (drag)                                              |
//+------------------------------------------------------------------+
void MoveToolbar(int dx, int dy)
{
   g_PanelX += dx;
   g_PanelY += dy;
   string names[] = {"BG","Title","Buy","Sell","Status","Reset"};
   for(int i = 0; i < ArraySize(names); i++)
   {
      string n = PRISM_PREFIX + names[i];
      if(ObjectFind(0, n) >= 0)
      {
         ObjectSetInteger(0, n, OBJPROP_XDISTANCE, (int)ObjectGetInteger(0, n, OBJPROP_XDISTANCE) + dx);
         ObjectSetInteger(0, n, OBJPROP_YDISTANCE, (int)ObjectGetInteger(0, n, OBJPROP_YDISTANCE) + dy);
      }
   }
   ChartRedraw(0);
}

//+------------------------------------------------------------------+
//| Chart Event Handler                                               |
//+------------------------------------------------------------------+
void OnChartEvent(const int id, const long& lparam, const double& dparam, const string& sparam)
{
   ClearError();

   //--- Button clicks (OBJ_BUTTON fires CHARTEVENT_OBJECT_CLICK)
   if(id == CHARTEVENT_OBJECT_CLICK)
   {
      // Always reset button pressed state
      if(StringFind(sparam, PRISM_PREFIX) == 0)
         ObjectSetInteger(0, sparam, OBJPROP_STATE, false);

      // BUY
      if(sparam == PRISM_PREFIX + "Buy")
      {
         g_Direction = "LONG";
         g_PlannerState = STATE_PLACING_ENTRY;
         HidePositionLines();
         UpdateStatus();
         ChartRedraw(0);
         return;
      }

      // SELL
      if(sparam == PRISM_PREFIX + "Sell")
      {
         g_Direction = "SHORT";
         g_PlannerState = STATE_PLACING_ENTRY;
         HidePositionLines();
         UpdateStatus();
         ChartRedraw(0);
         return;
      }

      // Title bar — start drag
      if(sparam == PRISM_PREFIX + "Title")
      {
         g_DraggingPanel = true;
         g_DragOffsetX = (int)lparam - g_PanelX;
         g_DragOffsetY = (int)dparam - g_PanelY;
         if(g_DragOffsetX < 0) g_DragOffsetX = 0;
         if(g_DragOffsetY < 0) g_DragOffsetY = 0;
         return;
      }

      // Reset / Cancel
      if(sparam == PRISM_PREFIX + "Reset")
      {
         ResetPlanner();
         ChartRedraw(0);
         return;
      }

      // EXECUTE
      if(sparam == PRISM_PREFIX + "CfmExec")
      {
         if(g_CalcLots <= 0) return;
         if(g_NeedConfirm)
         {
            g_NeedConfirm = false;
            ShowConfirmPanel();
            return;
         }
         if(ExecutePlannedTrade()) ResetPlanner();
         else { g_NeedConfirm = false; ShowConfirmPanel(); }
         ChartRedraw(0);
         return;
      }

      // CANCEL in confirm panel
      if(sparam == PRISM_PREFIX + "CfmCancel")
      {
         ResetPlanner();
         ChartRedraw(0);
         return;
      }
   }

   //--- Panel drag via mouse move
   if(id == CHARTEVENT_MOUSE_MOVE)
   {
      if(g_DraggingPanel)
      {
         int mx = (int)lparam;
         int my = (int)dparam;
         bool leftBtn = ((long)StringToInteger(sparam) & 1) == 1;

         if(leftBtn)
         {
            int newX = mx - g_DragOffsetX;
            int newY = my - g_DragOffsetY;
            int dx = newX - g_PanelX;
            int dy = newY - g_PanelY;
            if(dx != 0 || dy != 0) MoveToolbar(dx, dy);
         }
         else
            g_DraggingPanel = false;
         return;
      }
      // Don't return here — let other MOUSE_MOVE events through for line dragging
   }

   //--- Chart click for trade planning
   if(id == CHARTEVENT_CLICK)
   {
      int mx = (int)lparam;
      int my = (int)dparam;

      // Ignore clicks over toolbar or confirm panel
      if(IsOverToolbar(mx, my)) return;

      if(g_PlannerState != STATE_PLACING_ENTRY && g_PlannerState != STATE_PLACING_SL && g_PlannerState != STATE_PLACING_TP)
         return;

      int subWin = 0;
      datetime clickTime;
      double clickPrice;

      if(!ChartXYToTimePrice(0, mx, my, subWin, clickTime, clickPrice)) return;

      // Normalize the click price
      clickPrice = NormPrice(clickPrice);

      if(g_PlannerState == STATE_PLACING_ENTRY)
      {
         g_EntryPrice = clickPrice;
         CreateEntryLine(g_EntryPrice);
         g_PlannerState = STATE_PLACING_SL;
         UpdateStatus();
         ChartRedraw(0);
         return;
      }

      if(g_PlannerState == STATE_PLACING_SL)
      {
         double tickSize = SymbolInfoDouble(Symbol(), SYMBOL_TRADE_TICK_SIZE);
         if(MathAbs(clickPrice - g_EntryPrice) < tickSize * 2)
         { ShowError("SL too close to entry"); return; }
         if(g_Direction == "LONG" && clickPrice >= g_EntryPrice)
         { ShowError("SL must be BELOW entry"); return; }
         if(g_Direction == "SHORT" && clickPrice <= g_EntryPrice)
         { ShowError("SL must be ABOVE entry"); return; }

         g_SLPrice = clickPrice;
         CreateSLLine(g_SLPrice);
         g_PlannerState = STATE_PLACING_TP;
         UpdateStatus();
         ChartRedraw(0);
         return;
      }

      if(g_PlannerState == STATE_PLACING_TP)
      {
         if(g_Direction == "LONG" && clickPrice <= g_EntryPrice)
         { ShowError("TP must be ABOVE entry"); return; }
         if(g_Direction == "SHORT" && clickPrice >= g_EntryPrice)
         { ShowError("TP must be BELOW entry"); return; }

         g_TPPrice = clickPrice;
         CreateTPLine(g_TPPrice);
         CalculateRiskReward();
         g_PlannerState = STATE_CONFIRMING;
         ShowConfirmPanel();
         UpdateStatus();
         ChartRedraw(0);
         return;
      }
   }

   //--- Line drag handling (SL/TP/Entry in confirming state, position lines in idle)
   if(id == CHARTEVENT_OBJECT_DRAG)
   {
      // Dragging trade planner lines while confirming
      if(g_PlannerState == STATE_CONFIRMING)
      {
         bool changed = false;

         if(sparam == PRISM_PREFIX + "Entry")
         {
            double np = ObjectGetDouble(0, sparam, OBJPROP_PRICE);
            if((g_Direction == "LONG" && (np >= g_SLPrice || np >= g_TPPrice)) ||
               (g_Direction == "SHORT" && (np <= g_SLPrice || np <= g_TPPrice)))
            {
               ObjectSetDouble(0, sparam, OBJPROP_PRICE, g_EntryPrice);
               ShowError("Entry can't cross SL/TP");
            }
            else g_EntryPrice = np;
            changed = true;
         }

         if(sparam == PRISM_PREFIX + "SL")
         {
            double np = ObjectGetDouble(0, sparam, OBJPROP_PRICE);
            bool bad = (g_Direction == "LONG" && np >= g_EntryPrice) || (g_Direction == "SHORT" && np <= g_EntryPrice);
            if(bad) { ObjectSetDouble(0, sparam, OBJPROP_PRICE, g_SLPrice); ShowError("SL wrong side"); }
            else g_SLPrice = np;
            changed = true;
         }

         if(sparam == PRISM_PREFIX + "TP")
         {
            double np = ObjectGetDouble(0, sparam, OBJPROP_PRICE);
            bool bad = (g_Direction == "LONG" && np <= g_EntryPrice) || (g_Direction == "SHORT" && np >= g_EntryPrice);
            if(bad) { ObjectSetDouble(0, sparam, OBJPROP_PRICE, g_TPPrice); ShowError("TP wrong side"); }
            else g_TPPrice = np;
            changed = true;
         }

         if(changed) { CalculateRiskReward(); ShowConfirmPanel(); ChartRedraw(0); }
      }

      // Dragging existing position SL/TP
      if(g_PlannerState == STATE_IDLE)
      {
         if(StringFind(sparam, PRISM_PREFIX + "PosSL") == 0 || StringFind(sparam, PRISM_PREFIX + "PosTP") == 0)
         {
            string ticketStr;
            if(StringFind(sparam, PRISM_PREFIX + "PosSL") == 0)
               ticketStr = StringSubstr(sparam, StringLen(PRISM_PREFIX + "PosSL"));
            else
               ticketStr = StringSubstr(sparam, StringLen(PRISM_PREFIX + "PosTP"));

            ulong ticket = (ulong)StringToInteger(ticketStr);
            double np = ObjectGetDouble(0, sparam, OBJPROP_PRICE);
            if(ticket > 0 && PositionSelectByTicket(ticket))
            {
               double sl = PositionGetDouble(POSITION_SL);
               double tp = PositionGetDouble(POSITION_TP);
               if(StringFind(sparam, "PosSL") >= 0) sl = np;
               if(StringFind(sparam, "PosTP") >= 0) tp = np;
               ModifyPositionSLTP(ticket, sl, tp);
            }
         }
      }
   }

   if(id == CHARTEVENT_CHART_CHANGE)
   {
      if(g_PlannerState == STATE_CONFIRMING) ShowConfirmPanel();
   }
}

//+------------------------------------------------------------------+
//| Sync Functions                                                    |
//+------------------------------------------------------------------+
void SendJson(const string &json)
{
   string headers = HEADER_CONTENT_TYPE + HEADER_BRIDGE_KEY + BridgeKey + "\r\n";
   uchar data[];
   int len = StringToCharArray(json, data, 0, WHOLE_ARRAY, CP_UTF8);
   if(len > 0) ArrayResize(data, len - 1);
   uchar result[];
   string res_headers;
   int res = WebRequest("POST", SyncUrl, headers, 5000, data, result, res_headers);
   if(res == -1) PrintFormat("PrismTrade WebRequest error %d", GetLastError());
}

void SendEquitySnapshot()
{
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity  = AccountInfoDouble(ACCOUNT_EQUITY);
   string acctId  = (string)AccountInfoInteger(ACCOUNT_LOGIN);
   string json = "{\"type\":\"EQUITY_SNAPSHOT\",\"platformAccountId\":\"" + acctId + "\","
                 "\"platform\":\"METATRADER5\",\"snapshot\":{\"balance\":" + DoubleToString(balance, 2) + ","
                 "\"equity\":" + DoubleToString(equity, 2) + ","
                 "\"timestamp\":\"" + TimeToString(ToGmt(TimeCurrent()), TIME_DATE|TIME_MINUTES|TIME_SECONDS) + "\"}}";
   SendJson(json);
}

void SyncOpenPositions()
{
   string acctId = (string)AccountInfoInteger(ACCOUNT_LOGIN);
   int total = PositionsTotal();
   for(int i = 0; i < total; i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0 || !PositionSelectByTicket(ticket)) continue;
      string symbol = PositionGetString(POSITION_SYMBOL);
      double volume = PositionGetDouble(POSITION_VOLUME);
      double openPr = PositionGetDouble(POSITION_PRICE_OPEN);
      double profit = PositionGetDouble(POSITION_PROFIT);
      double swap   = PositionGetDouble(POSITION_SWAP);
      double sl     = PositionGetDouble(POSITION_SL);
      double tp     = PositionGetDouble(POSITION_TP);
      datetime time = (datetime)PositionGetInteger(POSITION_TIME);
      long posType  = PositionGetInteger(POSITION_TYPE);
      string ts     = (posType == POSITION_TYPE_BUY) ? "BUY" : "SELL";

      double bid = SymbolInfoDouble(symbol, SYMBOL_BID);
      double ask = SymbolInfoDouble(symbol, SYMBOL_ASK);
      InitTrackEntry(ticket, openPr, posType);
      UpdateExcursions(ticket, MathMin(bid, ask), MathMax(bid, ask));

      int tIdx = FindTrackedIdx(ticket);
      double mae = (tIdx != -1) ? g_TrackMAE[tIdx] : 0.0;
      double mfe = (tIdx != -1) ? g_TrackMFE[tIdx] : 0.0;

      string json = "{\"type\":\"TRADE_UPDATE\",\"platformAccountId\":\"" + acctId + "\","
                    "\"platform\":\"METATRADER5\",\"trade\":{"
                    "\"ticket\":\"POS-" + (string)ticket + "\",\"symbol\":\"" + symbol + "\","
                    "\"type\":\"" + ts + "\",\"volume\":" + DoubleToString(volume, 2) + ","
                    "\"entryPrice\":" + DoubleToString(openPr, 5) + ","
                    "\"pnl\":" + DoubleToString(profit, 2) + ",\"swap\":" + DoubleToString(swap, 2) + ","
                    "\"entryTime\":\"" + TimeToString(ToGmt(time), TIME_DATE|TIME_MINUTES|TIME_SECONDS) + "\","
                    "\"strategy\":\"" + Strategy + "\""
                    + OptField("stopLoss", sl, 5) + OptField("takeProfit", tp, 5)
                    + OptField("max_adverse_excursion", mae, 5) + OptField("max_favorable_excursion", mfe, 5) + "}}";
      SendJson(json);
   }
}

void SyncHistory()
{
   datetime fromTime = (HistoryDays == 0) ? 0 : TimeCurrent() - (datetime)(HistoryDays * 86400);
   if(!HistorySelect(fromTime, TimeCurrent())) return;
   int total = HistoryDealsTotal();
   string acctId = (string)AccountInfoInteger(ACCOUNT_LOGIN);
   int synced = 0;
   for(int i = 0; i < total; i++)
   {
      ulong dt = HistoryDealGetTicket(i);
      if(dt == 0) continue;
      ENUM_DEAL_TYPE deal_type = (ENUM_DEAL_TYPE)HistoryDealGetInteger(dt, DEAL_TYPE);
      if(deal_type != DEAL_TYPE_BUY && deal_type != DEAL_TYPE_SELL) continue;
      string symbol = HistoryDealGetString(dt, DEAL_SYMBOL);
      if(symbol == "") continue;

      ENUM_DEAL_ENTRY entry_type = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(dt, DEAL_ENTRY);
      ulong pos_id = HistoryDealGetInteger(dt, DEAL_POSITION_ID);
      double volume = HistoryDealGetDouble(dt, DEAL_VOLUME);
      double price  = HistoryDealGetDouble(dt, DEAL_PRICE);
      double profit = HistoryDealGetDouble(dt, DEAL_PROFIT);
      double comm   = HistoryDealGetDouble(dt, DEAL_COMMISSION);
      double swap   = HistoryDealGetDouble(dt, DEAL_SWAP);
      double sl     = HistoryDealGetDouble(dt, DEAL_SL);
      double tp     = HistoryDealGetDouble(dt, DEAL_TP);
      datetime time = (datetime)HistoryDealGetInteger(dt, DEAL_TIME);
      string ts = (deal_type == DEAL_TYPE_BUY) ? "BUY" : "SELL";
      string timeStr = TimeToString(ToGmt(time), TIME_DATE|TIME_MINUTES|TIME_SECONDS);

      if(entry_type == DEAL_ENTRY_IN)
      {
         string json = "{\"type\":\"TRADE_UPDATE\",\"platformAccountId\":\"" + acctId + "\","
                       "\"platform\":\"METATRADER5\",\"isHistorySync\":true,\"trade\":{"
                       "\"ticket\":\"POS-" + (string)pos_id + "\",\"symbol\":\"" + symbol + "\","
                       "\"type\":\"" + ts + "\",\"volume\":" + DoubleToString(volume, 2) + ","
                       "\"entryPrice\":" + DoubleToString(price, 5) + ","
                       "\"entryTime\":\"" + timeStr + "\",\"strategy\":\"" + Strategy + "\""
                       + OptField("stopLoss", sl, 5) + OptField("takeProfit", tp, 5) + "}}";
         SendJson(json); synced++;
      }
      else if(entry_type == DEAL_ENTRY_OUT || entry_type == DEAL_ENTRY_OUT_BY)
      {
         long reason = HistoryDealGetInteger(dt, DEAL_REASON);
         string cr = CloseReasonStr(reason);
         string json = "{\"type\":\"TRADE_UPDATE\",\"platformAccountId\":\"" + acctId + "\","
                       "\"platform\":\"METATRADER5\",\"isHistorySync\":true,\"trade\":{"
                       "\"ticket\":\"POS-" + (string)pos_id + "\",\"symbol\":\"" + symbol + "\","
                       "\"type\":\"" + ts + "\",\"volume\":" + DoubleToString(volume, 2) + ","
                       "\"exitPrice\":" + DoubleToString(price, 5) + ","
                       "\"pnl\":" + DoubleToString(profit, 2) + ",\"commission\":" + DoubleToString(comm, 2) + ","
                       "\"swap\":" + DoubleToString(swap, 2) + ","
                       "\"entryTime\":\"" + timeStr + "\",\"exitTime\":\"" + timeStr + "\","
                       "\"strategy\":\"" + Strategy + "\""
                       + OptField("stopLoss", sl, 5) + OptField("takeProfit", tp, 5)
                       + ",\"closeReason\":\"" + cr + "\"}}";
         SendJson(json); synced++;
      }
   }
   PrintFormat("PrismTrade SyncHistory: %d deals", synced);
}

//+------------------------------------------------------------------+
//| Init / Deinit / Timer                                            |
//+------------------------------------------------------------------+
int OnInit()
{
   if(BridgeKey == "") Print("PrismTrade WARNING: BridgeKey empty");
   g_Trade.SetExpertMagicNumber(42000);
   ChartSetInteger(0, CHART_EVENT_MOUSE_MOVE, true);
   CreateToolbar();
   ShowPositionLines();
   // Delay sync to first timer tick — don't block OnInit
   g_SyncDone = false;
   EventSetTimer(1);
   PrintFormat("PrismTrade v5.3 started on %s", Symbol());
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   ObjectsDeleteAll(0, PRISM_PREFIX);
   EventKillTimer();
}

void OnTimer()
{
   ClearError();

   // First timer tick: do the history sync that was deferred from OnInit
   if(!g_SyncDone)
   {
      g_SyncDone = true;
      if(BridgeKey != "") SyncHistory();
      EventKillTimer();
      EventSetTimer(TimerPeriod);
      return;
   }

   if(BridgeKey != "") { SendEquitySnapshot(); SyncOpenPositions(); }
   if(g_PlannerState == STATE_IDLE) ShowPositionLines();
}

void OnTradeTransaction(const MqlTradeTransaction& trans, const MqlTradeRequest& request, const MqlTradeResult& result)
{
   if(trans.type != TRADE_TRANSACTION_DEAL_ADD) return;
   ulong deal_ticket = trans.deal;
   if(!HistoryDealSelect(deal_ticket)) return;
   string symbol = HistoryDealGetString(deal_ticket, DEAL_SYMBOL);
   if(symbol == "") return;

   ENUM_DEAL_TYPE deal_type = (ENUM_DEAL_TYPE)HistoryDealGetInteger(deal_ticket, DEAL_TYPE);
   if(deal_type != DEAL_TYPE_BUY && deal_type != DEAL_TYPE_SELL) return;

   ENUM_DEAL_ENTRY entry_type = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(deal_ticket, DEAL_ENTRY);
   ulong pos_id = HistoryDealGetInteger(deal_ticket, DEAL_POSITION_ID);
   double volume = HistoryDealGetDouble(deal_ticket, DEAL_VOLUME);
   double price  = HistoryDealGetDouble(deal_ticket, DEAL_PRICE);
   double profit = HistoryDealGetDouble(deal_ticket, DEAL_PROFIT);
   double comm   = HistoryDealGetDouble(deal_ticket, DEAL_COMMISSION);
   double swap   = HistoryDealGetDouble(deal_ticket, DEAL_SWAP);
   double sl     = HistoryDealGetDouble(deal_ticket, DEAL_SL);
   double tp     = HistoryDealGetDouble(deal_ticket, DEAL_TP);
   datetime time = (datetime)HistoryDealGetInteger(deal_ticket, DEAL_TIME);
   string ts = (deal_type == DEAL_TYPE_BUY) ? "BUY" : "SELL";
   string acctId = (string)AccountInfoInteger(ACCOUNT_LOGIN);
   string timeStr = TimeToString(ToGmt(time), TIME_DATE|TIME_MINUTES|TIME_SECONDS);

   string json;
   if(entry_type == DEAL_ENTRY_IN)
   {
      long pt = (deal_type == DEAL_TYPE_BUY) ? POSITION_TYPE_BUY : POSITION_TYPE_SELL;
      InitTrackEntry(pos_id, price, pt);
      json = "{\"type\":\"TRADE_UPDATE\",\"platformAccountId\":\"" + acctId + "\","
             "\"platform\":\"METATRADER5\",\"trade\":{"
             "\"ticket\":\"POS-" + (string)pos_id + "\",\"symbol\":\"" + symbol + "\","
             "\"type\":\"" + ts + "\",\"volume\":" + DoubleToString(volume, 2) + ","
             "\"entryPrice\":" + DoubleToString(price, 5) + ","
             "\"entryTime\":\"" + timeStr + "\",\"strategy\":\"" + Strategy + "\""
             + OptField("stopLoss", sl, 5) + OptField("takeProfit", tp, 5) + "}}";
   }
   else
   {
      long reason = HistoryDealGetInteger(deal_ticket, DEAL_REASON);
      string cr = CloseReasonStr(reason);
      int cIdx = FindTrackedIdx(pos_id);
      double mae = (cIdx != -1) ? g_TrackMAE[cIdx] : 0.0;
      double mfe = (cIdx != -1) ? g_TrackMFE[cIdx] : 0.0;
      if(cIdx != -1) RemoveTrackedIdx(cIdx);
      json = "{\"type\":\"TRADE_UPDATE\",\"platformAccountId\":\"" + acctId + "\","
             "\"platform\":\"METATRADER5\",\"trade\":{"
             "\"ticket\":\"POS-" + (string)pos_id + "\",\"symbol\":\"" + symbol + "\","
             "\"type\":\"" + ts + "\",\"volume\":" + DoubleToString(volume, 2) + ","
             "\"exitPrice\":" + DoubleToString(price, 5) + ","
             "\"pnl\":" + DoubleToString(profit, 2) + ",\"commission\":" + DoubleToString(comm, 2) + ","
             "\"swap\":" + DoubleToString(swap, 2) + ","
             "\"entryTime\":\"" + timeStr + "\",\"exitTime\":\"" + timeStr + "\","
             "\"strategy\":\"" + Strategy + "\""
             + OptField("stopLoss", sl, 5) + OptField("takeProfit", tp, 5)
             + OptField("max_adverse_excursion", mae, 5) + OptField("max_favorable_excursion", mfe, 5)
             + ",\"closeReason\":\"" + cr + "\"}}";
   }
   if(BridgeKey != "") SendJson(json);
}
