//+------------------------------------------------------------------+
//|                                              PrismTrade.mq5      |
//|                              PrismJournal Visual Trading EA      |
//|                                    v5.4.0                        |
//+------------------------------------------------------------------+
#property copyright "2026, PrismJournal"
#property link      "https://github.com/prismjournal"
#property version   "5.40"
#property description "v5.4: Full trade manager - visual planning, close tools, auto BE/trail/partial TPs."
#property strict

#include <Trade\Trade.mqh>

// ── Inputs ───────────────────────────────────────────────────────
input string   SyncUrl        = "https://your-prismjournal-domain.com/api/sync";
input string   BridgeKey      = "";
input string   Strategy       = "Default";
input double   RiskPercent    = 1.0;
input double   MaxRiskPercent = 5.0;
input int      TimerPeriod    = 60;
input int      HistoryDays    = 90;
input int      Slippage       = 10;

// ── Constants ────────────────────────────────────────────────────
#define HEADER_CONTENT_TYPE "Content-Type: application/json\r\n"
#define HEADER_BRIDGE_KEY   "X-Bridge-Key: "
#define PRISM_PREFIX        "Prsm_"
#define ERROR_TIP_SECS      5

// ── UI dimensions ─────────────────────────────────────────────────
#define PANEL_W    220
#define HDR_H       24
#define TAB_H       22
#define BTN_H       34
#define MED_H       22
#define SML_H       20
#define CLB_H       28
#define GAP          3
#define SETT_W     400
#define CONFIRM_W  260
#define GEAR_W      28

// ── Enums ─────────────────────────────────────────────────────────
enum PLANNER_STATE { STATE_IDLE=0, STATE_PLACING_ENTRY=1, STATE_PLACING_SL=2, STATE_PLACING_TP=3, STATE_CONFIRMING=4 };
enum VOL_MODE      { VOL_PCT=0, VOL_LOT=1, VOL_USD=2 };
enum ORD_TYPE      { ORD_MARKET=0, ORD_LIMIT=1, ORD_STOP=2 };

// ── CTrade ────────────────────────────────────────────────────────
CTrade g_Trade;

// ── Planner ───────────────────────────────────────────────────────
PLANNER_STATE g_PlannerState    = STATE_IDLE;
string        g_Direction       = "";
double        g_EntryPrice      = 0;
double        g_SLPrice         = 0;
double        g_TPPrice         = 0;
double        g_CalcLots        = 0;
double        g_CalcRiskMoney   = 0;
double        g_CalcRewardMoney = 0;
double        g_CalcRR          = 0;
bool          g_HighRisk        = false;
bool          g_NeedConfirm     = false;
datetime      g_ErrorTipTime    = 0;
bool          g_SyncDone        = false;

// ── Main toolbar drag ─────────────────────────────────────────────
int  g_PanelX        = 10;
int  g_PanelY        = 35;
int  g_DragOffX      = 0;
int  g_DragOffY      = 0;
bool g_DraggingPanel = false;
bool g_CloseMode     = false;

// ── Settings panel drag ───────────────────────────────────────────
int  g_SettX        = 240;
int  g_SettY        = 35;
int  g_SettDragOffX = 0;
int  g_SettDragOffY = 0;
bool g_DraggingSett = false;
bool g_SettOpen     = false;

// ── Volume / order type ───────────────────────────────────────────
VOL_MODE g_VolMode  = VOL_PCT;
double   g_VolValue = 1.0;
ORD_TYPE g_OrdType  = ORD_MARKET;

// ── Auto features ─────────────────────────────────────────────────
bool   g_AutoBE      = false;
int    g_BETrig      = 10;
int    g_BEOffset    = 0;
bool   g_TrailOn     = false;
int    g_TrailStart  = 20;
int    g_TrailStep   = 10;
bool   g_PartialOn   = false;
double g_TP1Pct      = 50.0;
double g_TP1R        = 1.0;
double g_TP2Pct      = 30.0;
double g_TP2R        = 2.0;
double g_TP3Pct      = 20.0;
double g_TP3R        = 3.0;
bool   g_LockRR      = false;
double g_LockRRRatio = 2.0;

// Pending partial TP data (set before order, read in OnTradeTransaction)
double g_PendingSLDist = 0.0;
bool   g_PendingPartial = false;

// ── MAE/MFE + partial TP tracking ────────────────────────────────
#define MAX_TRACKED 200
ulong  g_TkTicket[MAX_TRACKED];
double g_TkMAE[MAX_TRACKED];
double g_TkMFE[MAX_TRACKED];
double g_TkEntry[MAX_TRACKED];
long   g_TkType[MAX_TRACKED];
bool   g_TkPT1Hit[MAX_TRACKED];
bool   g_TkPT2Hit[MAX_TRACKED];
double g_TkOrigVol[MAX_TRACKED];
double g_TkSLDist[MAX_TRACKED];
int    g_TkCount = 0;

//+------------------------------------------------------------------+
//| MAE/MFE tracking                                                  |
//+------------------------------------------------------------------+
int FindTrackedIdx(ulong ticket)
{
   for(int i = 0; i < g_TkCount; i++)
      if(g_TkTicket[i] == ticket) return i;
   return -1;
}

void InitTrackEntry(ulong ticket, double entryPr, long posType)
{
   if(g_TkCount >= MAX_TRACKED || FindTrackedIdx(ticket) != -1) return;
   int i = g_TkCount;
   g_TkTicket[i]  = ticket;
   g_TkMAE[i]     = 0.0;
   g_TkMFE[i]     = 0.0;
   g_TkEntry[i]   = entryPr;
   g_TkType[i]    = posType;
   g_TkPT1Hit[i]  = false;
   g_TkPT2Hit[i]  = false;
   g_TkOrigVol[i] = 0.0;
   g_TkSLDist[i]  = 0.0;
   g_TkCount++;
}

void SetTrackPartialData(ulong ticket, double origVol, double slDist)
{
   int i = FindTrackedIdx(ticket);
   if(i < 0) return;
   g_TkOrigVol[i] = origVol;
   g_TkSLDist[i]  = slDist;
}

void RemoveTrackedIdx(int idx)
{
   if(idx < 0 || idx >= g_TkCount) return;
   g_TkCount--;
   if(idx < g_TkCount)
   {
      g_TkTicket[idx]  = g_TkTicket[g_TkCount];
      g_TkMAE[idx]     = g_TkMAE[g_TkCount];
      g_TkMFE[idx]     = g_TkMFE[g_TkCount];
      g_TkEntry[idx]   = g_TkEntry[g_TkCount];
      g_TkType[idx]    = g_TkType[g_TkCount];
      g_TkPT1Hit[idx]  = g_TkPT1Hit[g_TkCount];
      g_TkPT2Hit[idx]  = g_TkPT2Hit[g_TkCount];
      g_TkOrigVol[idx] = g_TkOrigVol[g_TkCount];
      g_TkSLDist[idx]  = g_TkSLDist[g_TkCount];
   }
}

void UpdateExcursions(ulong ticket, double curLow, double curHigh)
{
   int idx = FindTrackedIdx(ticket);
   if(idx < 0) return;
   double entry = g_TkEntry[idx];
   long posType  = g_TkType[idx];
   if(posType == POSITION_TYPE_BUY)
   {
      double adverse   = entry - curLow;
      double favorable = curHigh - entry;
      if(adverse   > g_TkMAE[idx]) g_TkMAE[idx] = adverse;
      if(favorable > g_TkMFE[idx]) g_TkMFE[idx] = favorable;
   }
   else
   {
      double adverse   = curHigh - entry;
      double favorable = entry - curLow;
      if(adverse   > g_TkMAE[idx]) g_TkMAE[idx] = adverse;
      if(favorable > g_TkMFE[idx]) g_TkMFE[idx] = favorable;
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

double NormPrice(double price)
{
   double tickSize = SymbolInfoDouble(Symbol(), SYMBOL_TRADE_TICK_SIZE);
   if(tickSize > 0)
      return NormalizeDouble(MathRound(price / tickSize) * tickSize, _Digits);
   return NormalizeDouble(price, _Digits);
}

//+------------------------------------------------------------------+
//| UI — primitive builders                                           |
//+------------------------------------------------------------------+
void MakeBtn(string name, int x, int y, int w, int h, color bg, color brd, string text, int fs = 9)
{
   ObjectDelete(0, name);
   ObjectCreate(0, name, OBJ_BUTTON, 0, 0, 0);
   ObjectSetInteger(0, name, OBJPROP_XDISTANCE,   x);
   ObjectSetInteger(0, name, OBJPROP_YDISTANCE,   y);
   ObjectSetInteger(0, name, OBJPROP_XSIZE,        w);
   ObjectSetInteger(0, name, OBJPROP_YSIZE,        h);
   ObjectSetInteger(0, name, OBJPROP_BGCOLOR,      bg);
   ObjectSetInteger(0, name, OBJPROP_BORDER_COLOR, brd);
   ObjectSetInteger(0, name, OBJPROP_COLOR,        C'215,215,235');
   ObjectSetInteger(0, name, OBJPROP_FONTSIZE,     fs);
   ObjectSetString (0, name, OBJPROP_TEXT,         text);
   ObjectSetString (0, name, OBJPROP_FONT,         "Arial");
   ObjectSetInteger(0, name, OBJPROP_CORNER,       CORNER_LEFT_UPPER);
   ObjectSetInteger(0, name, OBJPROP_BACK,         false);
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE,   false);
   ObjectSetInteger(0, name, OBJPROP_STATE,        false);
}

void MakeLabel(string name, int x, int y, color clr, int fs, string text)
{
   ObjectDelete(0, name);
   ObjectCreate(0, name, OBJ_LABEL, 0, 0, 0);
   ObjectSetInteger(0, name, OBJPROP_XDISTANCE,  x);
   ObjectSetInteger(0, name, OBJPROP_YDISTANCE,  y);
   ObjectSetString (0, name, OBJPROP_TEXT,        text);
   ObjectSetInteger(0, name, OBJPROP_COLOR,       clr);
   ObjectSetInteger(0, name, OBJPROP_FONTSIZE,    fs);
   ObjectSetString (0, name, OBJPROP_FONT,        "Arial");
   ObjectSetInteger(0, name, OBJPROP_CORNER,      CORNER_LEFT_UPPER);
   ObjectSetInteger(0, name, OBJPROP_BACK,        false);
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE,  false);
}

void MakeEdit(string name, int x, int y, int w, int h, string text)
{
   ObjectDelete(0, name);
   ObjectCreate(0, name, OBJ_EDIT, 0, 0, 0);
   ObjectSetInteger(0, name, OBJPROP_XDISTANCE,   x);
   ObjectSetInteger(0, name, OBJPROP_YDISTANCE,   y);
   ObjectSetInteger(0, name, OBJPROP_XSIZE,        w);
   ObjectSetInteger(0, name, OBJPROP_YSIZE,        h);
   ObjectSetString (0, name, OBJPROP_TEXT,         text);
   ObjectSetInteger(0, name, OBJPROP_COLOR,        C'210,210,230');
   ObjectSetInteger(0, name, OBJPROP_BGCOLOR,      C'20,20,42');
   ObjectSetInteger(0, name, OBJPROP_BORDER_COLOR, C'70,65,140');
   ObjectSetInteger(0, name, OBJPROP_FONTSIZE,     8);
   ObjectSetString (0, name, OBJPROP_FONT,         "Arial");
   ObjectSetInteger(0, name, OBJPROP_CORNER,       CORNER_LEFT_UPPER);
   ObjectSetInteger(0, name, OBJPROP_ALIGN,        ALIGN_CENTER);
   ObjectSetInteger(0, name, OBJPROP_READONLY,     false);
   ObjectSetInteger(0, name, OBJPROP_BACK,         false);
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE,   false);
}

void MakeToggle(string name, int x, int y, int w, int h, bool on)
{
   MakeBtn(name, x, y, w, h,
           on ? C'18,90,55'  : C'70,22,22',
           on ? C'25,148,90' : C'130,40,40',
           on ? "ON" : "OFF", 7);
}

void UpdateToggle(string name, bool on)
{
   if(ObjectFind(0, name) < 0) return;
   ObjectSetInteger(0, name, OBJPROP_BGCOLOR,      on ? C'18,90,55'  : C'70,22,22');
   ObjectSetInteger(0, name, OBJPROP_BORDER_COLOR, on ? C'25,148,90' : C'130,40,40');
   ObjectSetString (0, name, OBJPROP_TEXT,         on ? "ON" : "OFF");
   ObjectSetInteger(0, name, OBJPROP_STATE,        false);
}

//+------------------------------------------------------------------+
//| Main toolbar                                                      |
//+------------------------------------------------------------------+
int GetToolbarHeight()
{
   int base = HDR_H + GAP + TAB_H + GAP;
   if(g_CloseMode)
      return base + CLB_H * 5 + GAP * 4 + 4;
   // trade mode
   return base + BTN_H * 2 + MED_H * 3 + SML_H * 2 + GAP * 6 + 4;
}

void CreateToolbarShell()
{
   int px = g_PanelX, py = g_PanelY, w = PANEL_W;
   int h = GetToolbarHeight();

   // Background
   MakeBtn(PRISM_PREFIX + "BG", px - 3, py - 3, w + 6, h + 6, C'14,14,26', C'55,50,105', "", 1);

   // Header — left portion is drag zone, right is gear toggle
   MakeBtn(PRISM_PREFIX + "Title", px, py, w - GEAR_W - 2, HDR_H,
           C'50,40,110', C'90,75,200', ":: PRISM  v5.4", 8);
   MakeBtn(PRISM_PREFIX + "Gear", px + w - GEAR_W, py + 2, GEAR_W - 2, HDR_H - 4,
           C'45,35,100', C'90,75,200', "S", 8);

   // Mode tabs
   int ty = py + HDR_H + GAP;
   int hw = w / 2;
   MakeBtn(PRISM_PREFIX + "ModeT", px,      ty, hw,     TAB_H, C'60,50,140', C'100,85,220', "TRADE", 8);
   MakeBtn(PRISM_PREFIX + "ModeC", px + hw, ty, w - hw, TAB_H, C'25,23,48',  C'45,42,80',  "CLOSE", 8);
}

void CreateTradeModeContent()
{
   int px = g_PanelX, w = PANEL_W;
   int y = g_PanelY + HDR_H + GAP + TAB_H + GAP;
   int bw = w / 3;

   // BUY / SELL
   MakeBtn(PRISM_PREFIX + "Buy",  px, y, w, BTN_H, C'12,95,65', C'25,155,110', "\x25B2  BUY / LONG",  10); y += BTN_H + GAP;
   MakeBtn(PRISM_PREFIX + "Sell", px, y, w, BTN_H, C'120,22,22', C'200,55,55', "\x25BC  SELL / SHORT", 10); y += BTN_H + GAP;

   // Volume mode toggles
   MakeBtn(PRISM_PREFIX + "VolPct", px,         y, bw,      MED_H, C'60,50,140', C'100,85,220', "% BAL", 8);
   MakeBtn(PRISM_PREFIX + "VolLot", px + bw,    y, bw,      MED_H, C'25,23,48',  C'45,42,80',  "LOT",   8);
   MakeBtn(PRISM_PREFIX + "VolUsd", px + bw*2,  y, w-bw*2,  MED_H, C'25,23,48',  C'45,42,80',  "$ USD", 8);
   y += MED_H + GAP;

   // Volume value edit
   MakeEdit(PRISM_PREFIX + "VolEdit", px, y, w, MED_H, DoubleToString(g_VolValue, 2));
   y += MED_H + GAP;

   // Order type
   MakeBtn(PRISM_PREFIX + "OrdMkt", px,         y, bw,     MED_H, C'60,50,140', C'100,85,220', "MKT", 8);
   MakeBtn(PRISM_PREFIX + "OrdLmt", px + bw,    y, bw,     MED_H, C'25,23,48',  C'45,42,80',  "LMT", 8);
   MakeBtn(PRISM_PREFIX + "OrdStp", px + bw*2,  y, w-bw*2, MED_H, C'25,23,48',  C'45,42,80',  "STP", 8);
   y += MED_H + GAP;

   // Status + cancel
   MakeBtn(PRISM_PREFIX + "Status", px, y, w, SML_H, C'18,18,34', C'32,32,55', "Click BUY or SELL", 8); y += SML_H + GAP;
   MakeBtn(PRISM_PREFIX + "Reset",  px, y, w, SML_H, C'75,28,28', C'120,45,45', "x  Cancel", 8);
}

void CreateCloseModeContent()
{
   int px = g_PanelX, w = PANEL_W;
   int y = g_PanelY + HDR_H + GAP + TAB_H + GAP;

   MakeBtn(PRISM_PREFIX + "CloseAll",    px, y, w, CLB_H, C'70,22,22', C'200,55,55',   "Close ALL",       9); y += CLB_H + GAP;
   MakeBtn(PRISM_PREFIX + "CloseOpen",   px, y, w, CLB_H, C'22,60,100', C'50,130,200', "Close Open",      9); y += CLB_H + GAP;
   MakeBtn(PRISM_PREFIX + "CloseProfit", px, y, w, CLB_H, C'18,90,55',  C'25,155,110', "Close Profit",    9); y += CLB_H + GAP;
   MakeBtn(PRISM_PREFIX + "CloseLoss",   px, y, w, CLB_H, C'80,40,10',  C'200,100,30', "Close Loss",      9); y += CLB_H + GAP;
   MakeBtn(PRISM_PREFIX + "ClosePend",   px, y, w, CLB_H, C'40,20,80',  C'100,60,180', "Delete Pending",  9);
}

void DestroyModeContent()
{
   string names[] = {
      "Buy","Sell","VolPct","VolLot","VolUsd","VolEdit","OrdMkt","OrdLmt","OrdStp","Status","Reset",
      "CloseAll","CloseOpen","CloseProfit","CloseLoss","ClosePend"
   };
   for(int i = 0; i < ArraySize(names); i++) ObjectDelete(0, PRISM_PREFIX + names[i]);
}

void CreateToolbar()
{
   CreateToolbarShell();
   if(g_CloseMode) CreateCloseModeContent();
   else             CreateTradeModeContent();
   ChartRedraw(0);
}

void DestroyToolbar()
{
   string names[] = {"BG","Title","Gear","ModeT","ModeC"};
   for(int i = 0; i < ArraySize(names); i++) ObjectDelete(0, PRISM_PREFIX + names[i]);
   DestroyModeContent();
   HideConfirmPanel();
}

void RefreshToolbar()
{
   // Update BG height for current mode
   ObjectSetInteger(0, PRISM_PREFIX + "BG", OBJPROP_YSIZE, GetToolbarHeight() + 6);
   // Update tab colours
   ObjectSetInteger(0, PRISM_PREFIX + "ModeT", OBJPROP_BGCOLOR,      !g_CloseMode ? C'60,50,140' : C'25,23,48');
   ObjectSetInteger(0, PRISM_PREFIX + "ModeT", OBJPROP_BORDER_COLOR, !g_CloseMode ? C'100,85,220' : C'45,42,80');
   ObjectSetInteger(0, PRISM_PREFIX + "ModeC", OBJPROP_BGCOLOR,       g_CloseMode ? C'60,50,140' : C'25,23,48');
   ObjectSetInteger(0, PRISM_PREFIX + "ModeC", OBJPROP_BORDER_COLOR,  g_CloseMode ? C'100,85,220' : C'45,42,80');
}

void UpdateVolModeButtons()
{
   string nms[] = {"VolPct","VolLot","VolUsd"};
   for(int i = 0; i < 3; i++)
   {
      bool active = (i == (int)g_VolMode);
      string n = PRISM_PREFIX + nms[i];
      if(ObjectFind(0, n) < 0) continue;
      ObjectSetInteger(0, n, OBJPROP_BGCOLOR,      active ? C'60,50,140' : C'25,23,48');
      ObjectSetInteger(0, n, OBJPROP_BORDER_COLOR, active ? C'100,85,220' : C'45,42,80');
   }
}

void UpdateOrdTypeButtons()
{
   string nms[] = {"OrdMkt","OrdLmt","OrdStp"};
   for(int i = 0; i < 3; i++)
   {
      bool active = (i == (int)g_OrdType);
      string n = PRISM_PREFIX + nms[i];
      if(ObjectFind(0, n) < 0) continue;
      ObjectSetInteger(0, n, OBJPROP_BGCOLOR,      active ? C'60,50,140' : C'25,23,48');
      ObjectSetInteger(0, n, OBJPROP_BORDER_COLOR, active ? C'100,85,220' : C'45,42,80');
   }
}

void UpdateStatus()
{
   string s = "";
   switch(g_PlannerState)
   {
      case STATE_PLACING_ENTRY: s = ">> Click chart: ENTRY"; break;
      case STATE_PLACING_SL:    s = ">> Click chart: STOP LOSS"; break;
      case STATE_PLACING_TP:    s = ">> Click chart: TAKE PROFIT"; break;
      case STATE_CONFIRMING:    s = ">> Drag lines or EXECUTE"; break;
      default:                  s = "Click BUY or SELL"; break;
   }
   if(ObjectFind(0, PRISM_PREFIX + "Status") >= 0)
      ObjectSetString(0, PRISM_PREFIX + "Status", OBJPROP_TEXT, s);
}

void MoveToolbar(int dx, int dy)
{
   g_PanelX += dx;
   g_PanelY += dy;
   string nms[] = {
      "BG","Title","Gear","ModeT","ModeC",
      "Buy","Sell","VolPct","VolLot","VolUsd","VolEdit","OrdMkt","OrdLmt","OrdStp","Status","Reset",
      "CloseAll","CloseOpen","CloseProfit","CloseLoss","ClosePend"
   };
   for(int i = 0; i < ArraySize(nms); i++)
   {
      string n = PRISM_PREFIX + nms[i];
      if(ObjectFind(0, n) >= 0)
      {
         ObjectSetInteger(0, n, OBJPROP_XDISTANCE, (int)ObjectGetInteger(0, n, OBJPROP_XDISTANCE) + dx);
         ObjectSetInteger(0, n, OBJPROP_YDISTANCE, (int)ObjectGetInteger(0, n, OBJPROP_YDISTANCE) + dy);
      }
   }
   ChartRedraw(0);
}

bool IsOverMainTitle(int x, int y)
{
   return (x >= g_PanelX && x <= g_PanelX + PANEL_W - GEAR_W - 2 &&
           y >= g_PanelY && y <= g_PanelY + HDR_H);
}

bool IsOverToolbar(int x, int y)
{
   int h = GetToolbarHeight();
   return (x >= g_PanelX - 3 && x <= g_PanelX + PANEL_W + 3 &&
           y >= g_PanelY - 3 && y <= g_PanelY + h + 3);
}

//+------------------------------------------------------------------+
//| Settings panel                                                    |
//+------------------------------------------------------------------+
void CreateSettingsPanel()
{
   if(!g_SettOpen) return;
   int px = g_SettX, py = g_SettY, w = SETT_W;
   int rh   = 26;   // row height
   int gap2 = 4;    // gap between rows
   int ind  = 16;   // left indent for sub-rows
   int togW = 56, togH = 20;
   int editW = 80;  // edit field width

   // totalH: header + info bar + 10 section/sub rows
   int totalH = HDR_H + GAP + 22 + GAP + 10 * (rh + gap2) + 3 * (rh + gap2) + (rh + gap2) + 12;
   MakeBtn(PRISM_PREFIX + "SttBG", px - 3, py - 3, w + 6, totalH + 6, C'14,14,26', C'55,50,105', "", 1);

   // Header
   MakeBtn(PRISM_PREFIX + "SttTitle", px, py, w - 26, HDR_H, C'50,40,110', C'90,75,200', ":: SETTINGS", 9);
   MakeBtn(PRISM_PREFIX + "SttX",     px + w - 24, py, 24, HDR_H, C'90,25,25', C'150,45,45', "x", 9);

   // Tick-size info bar
   double tickSz   = SymbolInfoDouble(Symbol(), SYMBOL_TRADE_TICK_SIZE);
   string tickInfo = Symbol() + "   1 tick = " + DoubleToString(tickSz, _Digits) + "   (values entered in ticks)";
   MakeBtn(PRISM_PREFIX + "SttInfo", px, py + HDR_H + GAP, w, 22, C'22,22,44', C'50,48,90', tickInfo, 8);

   int y = py + HDR_H + GAP + 22 + GAP;

   // ── Auto Breakeven ─────────────────────────────────────────────
   MakeLabel(PRISM_PREFIX + "SttBELbl",  px + 6,            y + 4,  C'210,205,240', 10, "Auto Breakeven");
   MakeToggle(PRISM_PREFIX + "SttBEBtn", px + w - togW - 4, y + 3, togW, togH, g_AutoBE);
   y += rh + gap2;

   MakeLabel(PRISM_PREFIX + "SttBETLbl", px + ind,           y + 5, C'155,150,190', 8, "Trigger:");
   MakeEdit( PRISM_PREFIX + "SttBETrig", px + ind + 68,      y, editW, rh - 2, IntegerToString(g_BETrig));
   MakeLabel(PRISM_PREFIX + "SttBEULbl", px + ind + 68 + editW + 4, y + 5, C'155,150,190', 8, "ticks");
   MakeLabel(PRISM_PREFIX + "SttBEOLbl", px + ind + 68 + editW + 50, y + 5, C'155,150,190', 8, "Offset:");
   MakeEdit( PRISM_PREFIX + "SttBEOff",  px + ind + 68 + editW + 106, y, editW, rh - 2, IntegerToString(g_BEOffset));
   MakeLabel(PRISM_PREFIX + "SttBEOU",   px + ind + 68 + editW + 106 + editW + 4, y + 5, C'155,150,190', 8, "ticks");
   y += rh + gap2 + 4;

   // ── Trailing Stop ──────────────────────────────────────────────
   MakeLabel(PRISM_PREFIX + "SttTRLbl",  px + 6,            y + 4,  C'210,205,240', 10, "Trailing Stop");
   MakeToggle(PRISM_PREFIX + "SttTRBtn", px + w - togW - 4, y + 3, togW, togH, g_TrailOn);
   y += rh + gap2;

   MakeLabel(PRISM_PREFIX + "SttTRSLbl",  px + ind,          y + 5, C'155,150,190', 8, "Start:");
   MakeEdit( PRISM_PREFIX + "SttTRStart", px + ind + 54,     y, editW, rh - 2, IntegerToString(g_TrailStart));
   MakeLabel(PRISM_PREFIX + "SttTRSU",    px + ind + 54 + editW + 4,  y + 5, C'155,150,190', 8, "ticks");
   MakeLabel(PRISM_PREFIX + "SttTRStLbl", px + ind + 54 + editW + 52, y + 5, C'155,150,190', 8, "Step:");
   MakeEdit( PRISM_PREFIX + "SttTRStep",  px + ind + 54 + editW + 100, y, editW, rh - 2, IntegerToString(g_TrailStep));
   MakeLabel(PRISM_PREFIX + "SttTRStU",   px + ind + 54 + editW + 100 + editW + 4, y + 5, C'155,150,190', 8, "ticks");
   y += rh + gap2 + 4;

   // ── Partial Take Profits ───────────────────────────────────────
   MakeLabel(PRISM_PREFIX + "SttPTLbl",  px + 6,            y + 4,  C'210,205,240', 10, "Partial Take Profits");
   MakeToggle(PRISM_PREFIX + "SttPTBtn", px + w - togW - 4, y + 3, togW, togH, g_PartialOn);
   y += rh + gap2;

   double tpPcts[] = {g_TP1Pct, g_TP2Pct, g_TP3Pct};
   double tpRs[]   = {g_TP1R,   g_TP2R,   g_TP3R};
   string tpPfx[]  = {"SttPT1", "SttPT2", "SttPT3"};
   string tpLbl[]  = {"TP1:", "TP2:", "TP3:"};
   for(int i = 0; i < 3; i++)
   {
      MakeLabel(PRISM_PREFIX + tpPfx[i] + "Lbl", px + ind,          y + 5, C'155,150,190', 8, tpLbl[i]);
      MakeEdit( PRISM_PREFIX + tpPfx[i] + "P",   px + ind + 40,     y, editW, rh - 2, DoubleToString(tpPcts[i], 0));
      MakeLabel(PRISM_PREFIX + tpPfx[i] + "PU",  px + ind + 40 + editW + 4,  y + 5, C'155,150,190', 8, "%  at");
      MakeEdit( PRISM_PREFIX + tpPfx[i] + "R",   px + ind + 40 + editW + 48, y, editW, rh - 2, DoubleToString(tpRs[i], 1));
      MakeLabel(PRISM_PREFIX + tpPfx[i] + "RU",  px + ind + 40 + editW + 48 + editW + 4, y + 5, C'155,150,190', 8, "R");
      y += rh + gap2;
   }

   y += 4;
   // ── Lock R:R Ratio ─────────────────────────────────────────────
   MakeLabel(PRISM_PREFIX + "SttRRLbl",  px + 6,            y + 4,  C'210,205,240', 10, "Lock R:R Ratio");
   MakeToggle(PRISM_PREFIX + "SttRRBtn", px + w - togW - 4, y + 3, togW, togH, g_LockRR);
   y += rh + gap2;

   MakeLabel(PRISM_PREFIX + "SttRRVLbl", px + ind,      y + 5, C'155,150,190', 8, "Ratio:");
   MakeEdit( PRISM_PREFIX + "SttRRVal",  px + ind + 58, y, editW, rh - 2, DoubleToString(g_LockRRRatio, 1));

   ChartRedraw(0);
}

void DestroySettingsPanel()
{
   string nms[] = {
      "SttBG","SttTitle","SttX","SttInfo",
      "SttBELbl","SttBEBtn","SttBETLbl","SttBETrig","SttBEULbl","SttBEOLbl","SttBEOff","SttBEOU",
      "SttTRLbl","SttTRBtn","SttTRSLbl","SttTRStart","SttTRSU","SttTRStLbl","SttTRStep","SttTRStU",
      "SttPTLbl","SttPTBtn",
      "SttPT1Lbl","SttPT1P","SttPT1PU","SttPT1R","SttPT1RU",
      "SttPT2Lbl","SttPT2P","SttPT2PU","SttPT2R","SttPT2RU",
      "SttPT3Lbl","SttPT3P","SttPT3PU","SttPT3R","SttPT3RU",
      "SttRRLbl","SttRRBtn","SttRRVLbl","SttRRVal"
   };
   for(int i = 0; i < ArraySize(nms); i++) ObjectDelete(0, PRISM_PREFIX + nms[i]);
}

void MoveSettings(int dx, int dy)
{
   g_SettX += dx;
   g_SettY += dy;
   string nms[] = {
      "SttBG","SttTitle","SttX","SttInfo",
      "SttBELbl","SttBEBtn","SttBETLbl","SttBETrig","SttBEULbl","SttBEOLbl","SttBEOff","SttBEOU",
      "SttTRLbl","SttTRBtn","SttTRSLbl","SttTRStart","SttTRSU","SttTRStLbl","SttTRStep","SttTRStU",
      "SttPTLbl","SttPTBtn",
      "SttPT1Lbl","SttPT1P","SttPT1PU","SttPT1R","SttPT1RU",
      "SttPT2Lbl","SttPT2P","SttPT2PU","SttPT2R","SttPT2RU",
      "SttPT3Lbl","SttPT3P","SttPT3PU","SttPT3R","SttPT3RU",
      "SttRRLbl","SttRRBtn","SttRRVLbl","SttRRVal"
   };
   for(int i = 0; i < ArraySize(nms); i++)
   {
      string n = PRISM_PREFIX + nms[i];
      if(ObjectFind(0, n) >= 0)
      {
         ObjectSetInteger(0, n, OBJPROP_XDISTANCE, (int)ObjectGetInteger(0, n, OBJPROP_XDISTANCE) + dx);
         ObjectSetInteger(0, n, OBJPROP_YDISTANCE, (int)ObjectGetInteger(0, n, OBJPROP_YDISTANCE) + dy);
      }
   }
   ChartRedraw(0);
}

bool IsOverSettTitle(int x, int y)
{
   if(!g_SettOpen) return false;
   return (x >= g_SettX && x <= g_SettX + SETT_W - 22 &&
           y >= g_SettY && y <= g_SettY + HDR_H);
}

bool IsOverSettings(int x, int y)
{
   if(!g_SettOpen) return false;
   int rh = 20, gap2 = 2;
   int totalH = HDR_H + GAP + 14 * (rh + gap2) + 6;
   return (x >= g_SettX - 3 && x <= g_SettX + SETT_W + 3 &&
           y >= g_SettY - 3 && y <= g_SettY + totalH + 3);
}

//+------------------------------------------------------------------+
//| Confirm panel                                                     |
//+------------------------------------------------------------------+
int ConfirmLeft() { return (int)ChartGetInteger(0, CHART_WIDTH_IN_PIXELS) - CONFIRM_W - 20; }

void ShowConfirmPanel()
{
   HideConfirmPanel();
   int px = ConfirmLeft(), py = 35, w = CONFIRM_W, rowH = 20, lm = 12;
   int y = py + 10;

   MakeBtn(PRISM_PREFIX + "CfmBG", px, py, w, 290, C'16,16,32', C'124,106,255', "", 1);

   string ordStr = (g_OrdType == ORD_LIMIT) ? " LIMIT" : (g_OrdType == ORD_STOP) ? " STOP" : "";
   MakeLabel(PRISM_PREFIX + "CfmDir",   px + lm, y, C'124,106,255', 11, g_Direction + " TRADE" + ordStr); y += rowH;
   MakeLabel(PRISM_PREFIX + "CfmLots",  px + lm, y, C'255,255,255', 9,  "Lots:  " + DoubleToString(g_CalcLots, 2)); y += rowH;
   MakeLabel(PRISM_PREFIX + "CfmRR",    px + lm, y, C'38,166,154',  9,  "R:R    1:" + DoubleToString(g_CalcRR, 1)); y += rowH;
   MakeLabel(PRISM_PREFIX + "CfmRisk$", px + lm, y, C'239,83,80',   9,  "Risk   -$" + DoubleToString(g_CalcRiskMoney, 2)); y += rowH;
   MakeLabel(PRISM_PREFIX + "CfmGain$", px + lm, y, C'38,166,154',  9,  "Gain   +$" + DoubleToString(g_CalcRewardMoney, 2)); y += rowH;

   if(g_PartialOn)
   {
      MakeLabel(PRISM_PREFIX + "CfmPT", px + lm, y, C'234,179,8', 8,
                "TP1:" + DoubleToString(g_TP1Pct,0) + "% @" + DoubleToString(g_TP1R,1) + "R  "
                + "TP2:" + DoubleToString(g_TP2Pct,0) + "% @" + DoubleToString(g_TP2R,1) + "R");
      y += rowH;
   }
   if(g_LockRR)
   {
      MakeLabel(PRISM_PREFIX + "CfmRRLock", px + lm, y, C'180,160,240', 8, "R:R Locked  1:" + DoubleToString(g_LockRRRatio,1));
      y += rowH;
   }
   if(g_HighRisk)
   {
      MakeLabel(PRISM_PREFIX + "CfmWarn", px + lm, y, C'234,179,8', 9,
                g_NeedConfirm ? "HIGH RISK — click EXECUTE again" : "Risk > " + DoubleToString(MaxRiskPercent,0) + "%");
      y += rowH;
   }

   y += 6;
   int hw = w / 2 - 10;
   MakeBtn(PRISM_PREFIX + "CfmExec",   px + 8,       y, hw, 34,
           g_CalcLots <= 0 ? C'35,35,50' : C'50,40,120',
           g_CalcLots <= 0 ? C'55,55,70' : C'100,85,220',
           g_NeedConfirm ? "CONFIRM" : "EXECUTE", 9);
   MakeBtn(PRISM_PREFIX + "CfmCancel", px + hw + 16, y, hw, 34, C'90,25,25', C'150,45,45', "CANCEL", 9);
   ChartRedraw(0);
}

void HideConfirmPanel()
{
   string nms[] = {"CfmBG","CfmDir","CfmLots","CfmRR","CfmRisk$","CfmGain$","CfmPT","CfmRRLock","CfmWarn","CfmExec","CfmCancel"};
   for(int i = 0; i < ArraySize(nms); i++) ObjectDelete(0, PRISM_PREFIX + nms[i]);
}

//+------------------------------------------------------------------+
//| Trade lines                                                       |
//+------------------------------------------------------------------+
void MakeHLine(string name, double price, color clr, ENUM_LINE_STYLE style, int width, string label)
{
   ObjectDelete(0, name);
   ObjectCreate(0, name, OBJ_HLINE, 0, 0, price);
   ObjectSetInteger(0, name, OBJPROP_COLOR,      clr);
   ObjectSetInteger(0, name, OBJPROP_STYLE,      style);
   ObjectSetInteger(0, name, OBJPROP_WIDTH,      width);
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE, true);
   ObjectSetInteger(0, name, OBJPROP_SELECTED,   false);
   ObjectSetInteger(0, name, OBJPROP_BACK,       false);
   ObjectSetInteger(0, name, OBJPROP_HIDDEN,     false);
   ObjectSetString (0, name, OBJPROP_TOOLTIP,    label);
   ObjectSetString (0, name, OBJPROP_TEXT,       label);
}

void CreateEntryLine(double price)
{
   MakeHLine(PRISM_PREFIX + "Entry", price, C'124,106,255', STYLE_SOLID, 3,
             "ENTRY  " + DoubleToString(price, _Digits) + "  [drag to adjust]");
}

void CreateSLLine(double price)
{
   MakeHLine(PRISM_PREFIX + "SL", price, C'239,83,80', STYLE_SOLID, 3,
             "STOP LOSS  " + DoubleToString(price, _Digits) + "  [drag to adjust]");
}

void CreateTPLine(double price)
{
   MakeHLine(PRISM_PREFIX + "TP", price, C'38,166,154', STYLE_SOLID, 3,
             "TAKE PROFIT  " + DoubleToString(price, _Digits) + "  [drag to adjust]");
}

void DeleteTradeLines()
{
   ObjectDelete(0, PRISM_PREFIX + "Entry");
   ObjectDelete(0, PRISM_PREFIX + "SL");
   ObjectDelete(0, PRISM_PREFIX + "TP");
}

//+------------------------------------------------------------------+
//| Error display                                                     |
//+------------------------------------------------------------------+
void ShowError(string msg)
{
   g_ErrorTipTime = TimeCurrent();
   if(ObjectFind(0, PRISM_PREFIX + "Status") >= 0)
   {
      ObjectSetString (0, PRISM_PREFIX + "Status", OBJPROP_TEXT,  msg);
      ObjectSetInteger(0, PRISM_PREFIX + "Status", OBJPROP_COLOR, C'239,83,80');
   }
   // Also surface in confirm panel label and chart comment so it's always visible
   if(ObjectFind(0, PRISM_PREFIX + "CfmDir") >= 0)
   {
      ObjectSetString (0, PRISM_PREFIX + "CfmDir", OBJPROP_TEXT,  "ERROR: " + msg);
      ObjectSetInteger(0, PRISM_PREFIX + "CfmDir", OBJPROP_COLOR, C'239,83,80');
   }
   ChartSetString(0, CHART_COMMENT, "PrismTrade error: " + msg);
   Print("PrismTrade error: ", msg);
}

void ClearError()
{
   if(g_ErrorTipTime == 0) return;
   if(TimeCurrent() - g_ErrorTipTime > ERROR_TIP_SECS)
   {
      g_ErrorTipTime = 0;
      if(ObjectFind(0, PRISM_PREFIX + "Status") >= 0)
         ObjectSetInteger(0, PRISM_PREFIX + "Status", OBJPROP_COLOR, C'215,215,235');
      ChartSetString(0, CHART_COMMENT, "");
      UpdateStatus();
   }
}

//+------------------------------------------------------------------+
//| Risk calculation                                                  |
//+------------------------------------------------------------------+
bool CalculateRiskReward()
{
   if(g_EntryPrice == 0 || g_SLPrice == 0 || g_TPPrice == 0) return false;

   double tickSize  = SymbolInfoDouble(Symbol(), SYMBOL_TRADE_TICK_SIZE);
   double tickValue = SymbolInfoDouble(Symbol(), SYMBOL_TRADE_TICK_VALUE_PROFIT);
   double balance   = AccountInfoDouble(ACCOUNT_BALANCE);
   double minLot    = SymbolInfoDouble(Symbol(), SYMBOL_VOLUME_MIN);
   double maxLot    = SymbolInfoDouble(Symbol(), SYMBOL_VOLUME_MAX);
   double lotStep   = SymbolInfoDouble(Symbol(), SYMBOL_VOLUME_STEP);

   double slDistance = MathAbs(g_EntryPrice - g_SLPrice);
   if(slDistance < tickSize * 2)
   {
      g_CalcLots = 0; g_CalcRiskMoney = 0; g_CalcRewardMoney = 0;
      g_CalcRR = 0; g_HighRisk = false; g_NeedConfirm = false;
      return false;
   }

   double ticksInSL = slDistance / tickSize;
   double lotSize, riskMoney;

   if(g_VolMode == VOL_LOT)
   {
      lotSize   = g_VolValue;
      riskMoney = lotSize * ticksInSL * tickValue;
   }
   else if(g_VolMode == VOL_USD)
   {
      riskMoney = g_VolValue;
      lotSize   = riskMoney / (ticksInSL * tickValue);
   }
   else // VOL_PCT
   {
      riskMoney = balance * g_VolValue / 100.0;
      lotSize   = riskMoney / (ticksInSL * tickValue);
   }

   if(lotStep > 0) lotSize = MathFloor(lotSize / lotStep) * lotStep;
   if(lotSize < minLot) lotSize = minLot;
   if(lotSize > maxLot) lotSize = maxLot;

   g_CalcLots       = lotSize;
   g_CalcRiskMoney  = lotSize * ticksInSL * tickValue;
   double tpDist    = MathAbs(g_TPPrice - g_EntryPrice);
   g_CalcRewardMoney= lotSize * (tpDist / tickSize) * tickValue;
   g_CalcRR         = (slDistance > 0) ? tpDist / slDistance : 0;

   double riskPct = (balance > 0) ? (g_CalcRiskMoney / balance * 100.0) : 0;
   g_HighRisk    = (riskPct > 2.0);
   g_NeedConfirm = (riskPct > MaxRiskPercent);

   return (lotSize >= minLot);
}

//+------------------------------------------------------------------+
//| Trade execution                                                   |
//+------------------------------------------------------------------+
bool ExecutePlannedTrade()
{
   if(g_CalcLots <= 0) return false;

   double sl = NormPrice(g_SLPrice);
   double tp = NormPrice(g_TPPrice);

   // For pending orders use the user-set entry price; for market use current bid/ask
   double price;
   ENUM_ORDER_TYPE orderType;
   if(g_Direction == "LONG")
   {
      price     = (g_OrdType == ORD_MARKET) ? SymbolInfoDouble(Symbol(), SYMBOL_ASK) : NormPrice(g_EntryPrice);
      orderType = (g_OrdType == ORD_MARKET) ? ORDER_TYPE_BUY :
                  (g_OrdType == ORD_LIMIT)  ? ORDER_TYPE_BUY_LIMIT  : ORDER_TYPE_BUY_STOP;
   }
   else
   {
      price     = (g_OrdType == ORD_MARKET) ? SymbolInfoDouble(Symbol(), SYMBOL_BID) : NormPrice(g_EntryPrice);
      orderType = (g_OrdType == ORD_MARKET) ? ORDER_TYPE_SELL :
                  (g_OrdType == ORD_LIMIT)  ? ORDER_TYPE_SELL_LIMIT : ORDER_TYPE_SELL_STOP;
   }

   double curAsk = SymbolInfoDouble(Symbol(), SYMBOL_ASK);
   double curBid = SymbolInfoDouble(Symbol(), SYMBOL_BID);

   // Validate pending order price relative to current market
   long   stopLvl  = SymbolInfoInteger(Symbol(), SYMBOL_TRADE_STOPS_LEVEL);
   double minPtDist = stopLvl * SymbolInfoDouble(Symbol(), SYMBOL_POINT);

   if(g_OrdType == ORD_LIMIT)
   {
      if(g_Direction == "LONG"  && price >= curAsk)
         { ShowError("Buy Limit must be BELOW Ask " + DoubleToString(curAsk, _Digits)); return false; }
      if(g_Direction == "SHORT" && price <= curBid)
         { ShowError("Sell Limit must be ABOVE Bid " + DoubleToString(curBid, _Digits)); return false; }
      if(g_Direction == "LONG"  && curAsk - price < minPtDist)
         { ShowError("Buy Limit too close to Ask — move " + (string)stopLvl + " pts further"); return false; }
      if(g_Direction == "SHORT" && price - curBid < minPtDist)
         { ShowError("Sell Limit too close to Bid — move " + (string)stopLvl + " pts further"); return false; }
   }
   if(g_OrdType == ORD_STOP)
   {
      if(g_Direction == "LONG"  && price <= curAsk)
         { ShowError("Buy Stop must be ABOVE Ask " + DoubleToString(curAsk, _Digits)); return false; }
      if(g_Direction == "SHORT" && price >= curBid)
         { ShowError("Sell Stop must be BELOW Bid " + DoubleToString(curBid, _Digits)); return false; }
      if(g_Direction == "LONG"  && price - curAsk < minPtDist)
         { ShowError("Buy Stop too close to Ask — move " + (string)stopLvl + " pts further"); return false; }
      if(g_Direction == "SHORT" && curBid - price < minPtDist)
         { ShowError("Sell Stop too close to Bid — move " + (string)stopLvl + " pts further"); return false; }
   }

   // Validate stop distance for market orders
   if(g_OrdType == ORD_MARKET)
   {
      long stopLevel = SymbolInfoInteger(Symbol(), SYMBOL_TRADE_STOPS_LEVEL);
      double minDist = stopLevel * SymbolInfoDouble(Symbol(), SYMBOL_POINT);
      if(g_Direction == "LONG")
      {
         if(sl > 0 && price - sl < minDist) { ShowError("SL too close (stops level)"); return false; }
         if(tp > 0 && tp - price < minDist) { ShowError("TP too close (stops level)"); return false; }
      }
      else
      {
         if(sl > 0 && sl - price < minDist) { ShowError("SL too close (stops level)"); return false; }
         if(tp > 0 && price - tp < minDist) { ShowError("TP too close (stops level)"); return false; }
      }
   }

   // Store partial TP state before execution
   g_PendingSLDist  = MathAbs(g_EntryPrice - g_SLPrice);
   g_PendingPartial = g_PartialOn;

   g_Trade.SetDeviationInPoints(Slippage);
   bool ok = false;

   if(g_OrdType == ORD_MARKET)
      ok = g_Trade.PositionOpen(Symbol(), orderType, g_CalcLots, price, sl, tp, "PrismTrade");
   else if(g_OrdType == ORD_LIMIT)
      ok = (g_Direction == "LONG")
           ? g_Trade.BuyLimit (g_CalcLots, price, Symbol(), sl, tp, ORDER_TIME_GTC, 0, "PrismTrade")
           : g_Trade.SellLimit(g_CalcLots, price, Symbol(), sl, tp, ORDER_TIME_GTC, 0, "PrismTrade");
   else
      ok = (g_Direction == "LONG")
           ? g_Trade.BuyStop (g_CalcLots, price, Symbol(), sl, tp, ORDER_TIME_GTC, 0, "PrismTrade")
           : g_Trade.SellStop(g_CalcLots, price, Symbol(), sl, tp, ORDER_TIME_GTC, 0, "PrismTrade");

   if(!ok)
   {
      ShowError("FAIL #" + (string)(int)g_Trade.ResultRetcode() + ": " + g_Trade.ResultRetcodeDescription());
      return false;
   }
   return true;
}

//+------------------------------------------------------------------+
//| Close operations                                                  |
//+------------------------------------------------------------------+
void CloseAllPositions()
{
   int total = PositionsTotal();
   for(int i = total - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0 || PositionGetString(POSITION_SYMBOL) != Symbol()) continue;
      g_Trade.PositionClose(ticket, Slippage);
   }
}

void CloseOpenPositions()
{
   CloseAllPositions(); // open = all live positions
}

void CloseProfitPositions()
{
   int total = PositionsTotal();
   for(int i = total - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0 || !PositionSelectByTicket(ticket)) continue;
      if(PositionGetString(POSITION_SYMBOL) != Symbol()) continue;
      if(PositionGetDouble(POSITION_PROFIT) > 0)
         g_Trade.PositionClose(ticket, Slippage);
   }
}

void CloseLossPositions()
{
   int total = PositionsTotal();
   for(int i = total - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0 || !PositionSelectByTicket(ticket)) continue;
      if(PositionGetString(POSITION_SYMBOL) != Symbol()) continue;
      if(PositionGetDouble(POSITION_PROFIT) < 0)
         g_Trade.PositionClose(ticket, Slippage);
   }
}

void DeletePendingOrders()
{
   int total = OrdersTotal();
   for(int i = total - 1; i >= 0; i--)
   {
      ulong ticket = OrderGetTicket(i);
      if(ticket == 0 || OrderGetString(ORDER_SYMBOL) != Symbol()) continue;
      g_Trade.OrderDelete(ticket);
   }
}

//+------------------------------------------------------------------+
//| Auto features (called from OnTick)                               |
//+------------------------------------------------------------------+
void RunAutoBreakeven()
{
   double tick = SymbolInfoDouble(Symbol(), SYMBOL_TRADE_TICK_SIZE);
   int total = PositionsTotal();
   for(int i = 0; i < total; i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0 || !PositionSelectByTicket(ticket)) continue;
      if(PositionGetString(POSITION_SYMBOL) != Symbol()) continue;
      long   posType  = PositionGetInteger(POSITION_TYPE);
      double entry    = PositionGetDouble(POSITION_PRICE_OPEN);
      double sl       = PositionGetDouble(POSITION_SL);
      double tp       = PositionGetDouble(POSITION_TP);
      double bid      = SymbolInfoDouble(Symbol(), SYMBOL_BID);
      double ask      = SymbolInfoDouble(Symbol(), SYMBOL_ASK);
      double trigPts  = g_BETrig   * tick;
      double offPts   = g_BEOffset * tick;

      if(posType == POSITION_TYPE_BUY)
      {
         double beLevel = NormPrice(entry + offPts);
         if(bid >= entry + trigPts && sl < beLevel)
            g_Trade.PositionModify(ticket, beLevel, tp);
      }
      else
      {
         double beLevel = NormPrice(entry - offPts);
         if(ask <= entry - trigPts && (sl == 0 || sl > beLevel))
            g_Trade.PositionModify(ticket, beLevel, tp);
      }
   }
}

void RunTrailingStop()
{
   double tick = SymbolInfoDouble(Symbol(), SYMBOL_TRADE_TICK_SIZE);
   int total = PositionsTotal();
   for(int i = 0; i < total; i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0 || !PositionSelectByTicket(ticket)) continue;
      if(PositionGetString(POSITION_SYMBOL) != Symbol()) continue;
      long   posType   = PositionGetInteger(POSITION_TYPE);
      double entry     = PositionGetDouble(POSITION_PRICE_OPEN);
      double sl        = PositionGetDouble(POSITION_SL);
      double tp        = PositionGetDouble(POSITION_TP);
      double bid       = SymbolInfoDouble(Symbol(), SYMBOL_BID);
      double ask       = SymbolInfoDouble(Symbol(), SYMBOL_ASK);
      double startPts  = g_TrailStart * tick;
      double trailDist = g_TrailStep  * tick;

      if(posType == POSITION_TYPE_BUY)
      {
         if(bid >= entry + startPts)
         {
            double newSL = NormPrice(bid - trailDist);
            if(newSL > sl) g_Trade.PositionModify(ticket, newSL, tp);
         }
      }
      else
      {
         if(ask <= entry - startPts)
         {
            double newSL = NormPrice(ask + trailDist);
            if(sl == 0 || newSL < sl) g_Trade.PositionModify(ticket, newSL, tp);
         }
      }
   }
}

void RunPartialTPs()
{
   for(int i = 0; i < g_TkCount; i++)
   {
      ulong ticket  = g_TkTicket[i];
      double slDist = g_TkSLDist[i];
      double orgVol = g_TkOrigVol[i];
      if(slDist == 0 || orgVol == 0) continue;
      if(!PositionSelectByTicket(ticket)) continue;
      if(PositionGetString(POSITION_SYMBOL) != Symbol()) continue;

      long   posType = g_TkType[i];
      double entry   = g_TkEntry[i];
      double curVol  = PositionGetDouble(POSITION_VOLUME);
      double minLot  = SymbolInfoDouble(Symbol(), SYMBOL_VOLUME_MIN);
      double bid     = SymbolInfoDouble(Symbol(), SYMBOL_BID);
      double ask     = SymbolInfoDouble(Symbol(), SYMBOL_ASK);

      if(!g_TkPT1Hit[i])
      {
         double tp1 = (posType == POSITION_TYPE_BUY) ? entry + slDist * g_TP1R : entry - slDist * g_TP1R;
         bool   hit = (posType == POSITION_TYPE_BUY) ? bid >= tp1 : ask <= tp1;
         if(hit)
         {
            double vol = NormalizeDouble(orgVol * g_TP1Pct / 100.0, 2);
            if(vol < minLot) vol = minLot;
            if(vol <= curVol) { g_Trade.PositionClosePartial(ticket, vol, Slippage); g_TkPT1Hit[i] = true; }
         }
      }
      else if(!g_TkPT2Hit[i])
      {
         double tp2 = (posType == POSITION_TYPE_BUY) ? entry + slDist * g_TP2R : entry - slDist * g_TP2R;
         bool   hit = (posType == POSITION_TYPE_BUY) ? bid >= tp2 : ask <= tp2;
         if(hit)
         {
            double vol = NormalizeDouble(orgVol * g_TP2Pct / 100.0, 2);
            if(vol < minLot) vol = minLot;
            curVol = PositionGetDouble(POSITION_VOLUME);
            if(vol <= curVol) { g_Trade.PositionClosePartial(ticket, vol, Slippage); g_TkPT2Hit[i] = true; }
         }
      }
   }
}

//+------------------------------------------------------------------+
//| Position SL/TP lines                                             |
//+------------------------------------------------------------------+
bool ModifyPositionSLTP(ulong ticket, double newSL, double newTP)
{
   if(!PositionSelectByTicket(ticket)) return false;
   if(newSL == 0) newSL = PositionGetDouble(POSITION_SL);
   if(newTP == 0) newTP = PositionGetDouble(POSITION_TP);
   newSL = NormPrice(newSL);
   newTP = NormPrice(newTP);
   if(!g_Trade.PositionModify(ticket, newSL, newTP)) { ShowError("Modify failed"); return false; }
   SendPositionUpdate(ticket);
   return true;
}

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
         MakeHLine(PRISM_PREFIX + "PosSL" + (string)ticket, sl, C'239,83,80', STYLE_DASH, 2,
                   "SL #" + (string)ticket + "  " + DoubleToString(sl, _Digits) + "  [drag to modify]");
      if(tp > 0)
         MakeHLine(PRISM_PREFIX + "PosTP" + (string)ticket, tp, C'38,166,154', STYLE_DASH, 2,
                   "TP #" + (string)ticket + "  " + DoubleToString(tp, _Digits) + "  [drag to modify]");
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

//+------------------------------------------------------------------+
//| State helpers                                                     |
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
   if(ObjectFind(0, PRISM_PREFIX + "Status") >= 0)
      ObjectSetInteger(0, PRISM_PREFIX + "Status", OBJPROP_COLOR, C'215,215,235');
}

//+------------------------------------------------------------------+
//| Chart event                                                       |
//+------------------------------------------------------------------+
void OnChartEvent(const int id, const long& lparam, const double& dparam, const string& sparam)
{
   ClearError();

   // ── Button clicks ────────────────────────────────────────────
   if(id == CHARTEVENT_OBJECT_CLICK)
   {
      if(StringFind(sparam, PRISM_PREFIX) == 0)
         ObjectSetInteger(0, sparam, OBJPROP_STATE, false);

      // ── Mode tabs ──────────────────────────────────────────────
      if(sparam == PRISM_PREFIX + "ModeT" && g_CloseMode)
      {
         g_CloseMode = false; DestroyModeContent(); RefreshToolbar(); CreateTradeModeContent();
         UpdateVolModeButtons(); UpdateOrdTypeButtons(); ChartRedraw(0); return;
      }
      if(sparam == PRISM_PREFIX + "ModeC" && !g_CloseMode)
      {
         g_CloseMode = true; ResetPlanner(); DestroyModeContent(); RefreshToolbar(); CreateCloseModeContent();
         ChartRedraw(0); return;
      }

      // ── Settings gear ──────────────────────────────────────────
      if(sparam == PRISM_PREFIX + "Gear")
      {
         g_SettOpen = !g_SettOpen;
         if(g_SettOpen) { g_SettX = g_PanelX + PANEL_W + 10; g_SettY = g_PanelY; CreateSettingsPanel(); }
         else           DestroySettingsPanel();
         ChartRedraw(0); return;
      }

      // ── Settings close ────────────────────────────────────────
      if(sparam == PRISM_PREFIX + "SttX")
      { g_SettOpen = false; DestroySettingsPanel(); ChartRedraw(0); return; }

      // ── Settings toggles ──────────────────────────────────────
      if(sparam == PRISM_PREFIX + "SttBEBtn") { g_AutoBE   = !g_AutoBE;   UpdateToggle(PRISM_PREFIX + "SttBEBtn", g_AutoBE);   return; }
      if(sparam == PRISM_PREFIX + "SttTRBtn") { g_TrailOn  = !g_TrailOn;  UpdateToggle(PRISM_PREFIX + "SttTRBtn", g_TrailOn);  return; }
      if(sparam == PRISM_PREFIX + "SttPTBtn") { g_PartialOn= !g_PartialOn;UpdateToggle(PRISM_PREFIX + "SttPTBtn", g_PartialOn);return; }
      if(sparam == PRISM_PREFIX + "SttRRBtn") { g_LockRR   = !g_LockRR;   UpdateToggle(PRISM_PREFIX + "SttRRBtn", g_LockRR);   return; }

      // ── Volume mode ───────────────────────────────────────────
      if(sparam == PRISM_PREFIX + "VolPct" || sparam == PRISM_PREFIX + "VolLot" || sparam == PRISM_PREFIX + "VolUsd")
      {
         VOL_MODE prev = g_VolMode;
         if(sparam == PRISM_PREFIX + "VolPct") g_VolMode = VOL_PCT;
         if(sparam == PRISM_PREFIX + "VolLot") g_VolMode = VOL_LOT;
         if(sparam == PRISM_PREFIX + "VolUsd") g_VolMode = VOL_USD;
         if(g_VolMode != prev)
         {
            if(g_VolMode == VOL_LOT) g_VolValue = 0.10;
            else if(g_VolMode == VOL_USD) g_VolValue = 100.0;
            else g_VolValue = RiskPercent;
            if(ObjectFind(0, PRISM_PREFIX + "VolEdit") >= 0)
               ObjectSetString(0, PRISM_PREFIX + "VolEdit", OBJPROP_TEXT, DoubleToString(g_VolValue, 2));
            UpdateVolModeButtons();
            if(g_PlannerState == STATE_CONFIRMING) { CalculateRiskReward(); ShowConfirmPanel(); }
         }
         return;
      }

      // ── Order type ────────────────────────────────────────────
      if(sparam == PRISM_PREFIX + "OrdMkt" || sparam == PRISM_PREFIX + "OrdLmt" || sparam == PRISM_PREFIX + "OrdStp")
      {
         if(sparam == PRISM_PREFIX + "OrdMkt") g_OrdType = ORD_MARKET;
         if(sparam == PRISM_PREFIX + "OrdLmt") g_OrdType = ORD_LIMIT;
         if(sparam == PRISM_PREFIX + "OrdStp") g_OrdType = ORD_STOP;
         UpdateOrdTypeButtons();
         if(g_PlannerState == STATE_CONFIRMING) ShowConfirmPanel();
         return;
      }

      // ── Trade direction ───────────────────────────────────────
      if(sparam == PRISM_PREFIX + "Buy")
      {
         g_Direction = "LONG"; g_PlannerState = STATE_PLACING_ENTRY;
         HidePositionLines(); UpdateStatus(); ChartRedraw(0); return;
      }
      if(sparam == PRISM_PREFIX + "Sell")
      {
         g_Direction = "SHORT"; g_PlannerState = STATE_PLACING_ENTRY;
         HidePositionLines(); UpdateStatus(); ChartRedraw(0); return;
      }

      // ── Reset / Cancel ────────────────────────────────────────
      if(sparam == PRISM_PREFIX + "Reset") { ResetPlanner(); ChartRedraw(0); return; }

      // ── Confirm execute ───────────────────────────────────────
      if(sparam == PRISM_PREFIX + "CfmExec")
      {
         if(g_CalcLots <= 0) return;
         if(g_NeedConfirm) { g_NeedConfirm = false; ShowConfirmPanel(); return; }
         if(ExecutePlannedTrade()) ResetPlanner();
         else { g_NeedConfirm = false; ShowConfirmPanel(); }
         ChartRedraw(0); return;
      }
      if(sparam == PRISM_PREFIX + "CfmCancel") { ResetPlanner(); ChartRedraw(0); return; }

      // ── Close mode buttons ────────────────────────────────────
      if(sparam == PRISM_PREFIX + "CloseAll")    { CloseAllPositions();    return; }
      if(sparam == PRISM_PREFIX + "CloseOpen")   { CloseOpenPositions();   return; }
      if(sparam == PRISM_PREFIX + "CloseProfit") { CloseProfitPositions(); return; }
      if(sparam == PRISM_PREFIX + "CloseLoss")   { CloseLossPositions();   return; }
      if(sparam == PRISM_PREFIX + "ClosePend")   { DeletePendingOrders();  return; }
   }

   // ── Edit fields ───────────────────────────────────────────────
   if(id == CHARTEVENT_OBJECT_ENDEDIT)
   {
      string val = ObjectGetString(0, sparam, OBJPROP_TEXT);
      double dv = StringToDouble(val);
      int    iv = (int)StringToInteger(val);

      if(sparam == PRISM_PREFIX + "VolEdit")
      {
         if(dv > 0) g_VolValue = dv;
         else ObjectSetString(0, sparam, OBJPROP_TEXT, DoubleToString(g_VolValue, 2));
         if(g_PlannerState == STATE_CONFIRMING) { CalculateRiskReward(); ShowConfirmPanel(); }
      }
      else if(sparam == PRISM_PREFIX + "SttBETrig") { if(iv > 0) g_BETrig    = iv; else ObjectSetString(0, sparam, OBJPROP_TEXT, IntegerToString(g_BETrig)); }
      else if(sparam == PRISM_PREFIX + "SttBEOff")  { if(iv >= 0)g_BEOffset  = iv; else ObjectSetString(0, sparam, OBJPROP_TEXT, IntegerToString(g_BEOffset)); }
      else if(sparam == PRISM_PREFIX + "SttTRStart"){ if(iv > 0) g_TrailStart= iv; else ObjectSetString(0, sparam, OBJPROP_TEXT, IntegerToString(g_TrailStart)); }
      else if(sparam == PRISM_PREFIX + "SttTRStep") { if(iv > 0) g_TrailStep = iv; else ObjectSetString(0, sparam, OBJPROP_TEXT, IntegerToString(g_TrailStep)); }
      else if(sparam == PRISM_PREFIX + "SttPT1P")   { if(dv > 0 && dv <= 100) g_TP1Pct = dv; else ObjectSetString(0, sparam, OBJPROP_TEXT, DoubleToString(g_TP1Pct, 0)); }
      else if(sparam == PRISM_PREFIX + "SttPT1R")   { if(dv > 0) g_TP1R = dv; else ObjectSetString(0, sparam, OBJPROP_TEXT, DoubleToString(g_TP1R, 1)); }
      else if(sparam == PRISM_PREFIX + "SttPT2P")   { if(dv > 0 && dv <= 100) g_TP2Pct = dv; else ObjectSetString(0, sparam, OBJPROP_TEXT, DoubleToString(g_TP2Pct, 0)); }
      else if(sparam == PRISM_PREFIX + "SttPT2R")   { if(dv > 0) g_TP2R = dv; else ObjectSetString(0, sparam, OBJPROP_TEXT, DoubleToString(g_TP2R, 1)); }
      else if(sparam == PRISM_PREFIX + "SttPT3P")   { if(dv > 0 && dv <= 100) g_TP3Pct = dv; else ObjectSetString(0, sparam, OBJPROP_TEXT, DoubleToString(g_TP3Pct, 0)); }
      else if(sparam == PRISM_PREFIX + "SttPT3R")   { if(dv > 0) g_TP3R = dv; else ObjectSetString(0, sparam, OBJPROP_TEXT, DoubleToString(g_TP3R, 1)); }
      else if(sparam == PRISM_PREFIX + "SttRRVal")  { if(dv > 0) g_LockRRRatio = dv; else ObjectSetString(0, sparam, OBJPROP_TEXT, DoubleToString(g_LockRRRatio, 1)); }
      return;
   }

   // ── Mouse move — panel dragging ───────────────────────────────
   if(id == CHARTEVENT_MOUSE_MOVE)
   {
      int  mx       = (int)lparam;
      int  my       = (int)dparam;
      bool leftDown = ((long)StringToInteger(sparam) & 1) == 1;

      if(!leftDown)
      {
         if(g_DraggingPanel || g_DraggingSett)
            ChartSetInteger(0, CHART_MOUSE_SCROLL, true);
         g_DraggingPanel = false;
         g_DraggingSett  = false;
      }
      else
      {
         // Initiate main toolbar drag
         if(!g_DraggingPanel && !g_DraggingSett && IsOverMainTitle(mx, my))
         {
            g_DraggingPanel = true;
            g_DragOffX = mx - g_PanelX;
            g_DragOffY = my - g_PanelY;
            ChartSetInteger(0, CHART_MOUSE_SCROLL, false);
         }

         // Initiate settings panel drag
         if(!g_DraggingPanel && !g_DraggingSett && IsOverSettTitle(mx, my))
         {
            g_DraggingSett = true;
            g_SettDragOffX = mx - g_SettX;
            g_SettDragOffY = my - g_SettY;
            ChartSetInteger(0, CHART_MOUSE_SCROLL, false);
         }
      }

      if(g_DraggingPanel && leftDown)
      {
         int dx = (mx - g_DragOffX) - g_PanelX;
         int dy = (my - g_DragOffY) - g_PanelY;
         if(dx != 0 || dy != 0) MoveToolbar(dx, dy);
         return;
      }
      if(g_DraggingSett && leftDown)
      {
         int dx = (mx - g_SettDragOffX) - g_SettX;
         int dy = (my - g_SettDragOffY) - g_SettY;
         if(dx != 0 || dy != 0) MoveSettings(dx, dy);
         return;
      }
   }

   // ── Chart click — trade planning ──────────────────────────────
   if(id == CHARTEVENT_CLICK)
   {
      int mx = (int)lparam, my = (int)dparam;
      if(IsOverToolbar(mx, my) || IsOverSettings(mx, my)) return;
      if(g_PlannerState != STATE_PLACING_ENTRY &&
         g_PlannerState != STATE_PLACING_SL    &&
         g_PlannerState != STATE_PLACING_TP) return;

      int subWin = 0; datetime clickTime; double clickPrice;
      if(!ChartXYToTimePrice(0, mx, my, subWin, clickTime, clickPrice)) return;
      clickPrice = NormPrice(clickPrice);

      if(g_PlannerState == STATE_PLACING_ENTRY)
      {
         g_EntryPrice = clickPrice; CreateEntryLine(g_EntryPrice);
         g_PlannerState = STATE_PLACING_SL; UpdateStatus(); ChartRedraw(0); return;
      }
      if(g_PlannerState == STATE_PLACING_SL)
      {
         double tickSize = SymbolInfoDouble(Symbol(), SYMBOL_TRADE_TICK_SIZE);
         if(MathAbs(clickPrice - g_EntryPrice) < tickSize * 2) { ShowError("SL too close to entry"); return; }
         if(g_Direction == "LONG"  && clickPrice >= g_EntryPrice) { ShowError("SL must be BELOW entry"); return; }
         if(g_Direction == "SHORT" && clickPrice <= g_EntryPrice) { ShowError("SL must be ABOVE entry"); return; }
         g_SLPrice = clickPrice; CreateSLLine(g_SLPrice);
         g_PlannerState = STATE_PLACING_TP; UpdateStatus(); ChartRedraw(0); return;
      }
      if(g_PlannerState == STATE_PLACING_TP)
      {
         if(g_Direction == "LONG"  && clickPrice <= g_EntryPrice) { ShowError("TP must be ABOVE entry"); return; }
         if(g_Direction == "SHORT" && clickPrice >= g_EntryPrice) { ShowError("TP must be BELOW entry"); return; }
         g_TPPrice = clickPrice; CreateTPLine(g_TPPrice);
         CalculateRiskReward(); g_PlannerState = STATE_CONFIRMING;
         ShowConfirmPanel(); UpdateStatus(); ChartRedraw(0); return;
      }
   }

   // ── Object drag — SL/TP/Entry lines ──────────────────────────
   if(id == CHARTEVENT_OBJECT_DRAG)
   {
      if(g_PlannerState == STATE_CONFIRMING)
      {
         bool changed = false;
         if(sparam == PRISM_PREFIX + "Entry")
         {
            double np = NormPrice(ObjectGetDouble(0, sparam, OBJPROP_PRICE));
            ObjectSetDouble(0, sparam, OBJPROP_PRICE, np);
            bool bad = (g_Direction == "LONG")
                       ? (np >= g_SLPrice || np >= g_TPPrice)
                       : (np <= g_SLPrice || np <= g_TPPrice);
            if(bad) { ObjectSetDouble(0, sparam, OBJPROP_PRICE, g_EntryPrice); ShowError("Entry can't cross SL/TP"); }
            else
            {
               g_EntryPrice = np;
               if(g_LockRR && g_SLPrice != 0)
               {
                  double slDist = MathAbs(g_EntryPrice - g_SLPrice);
                  g_TPPrice = NormPrice((g_Direction == "LONG") ? g_EntryPrice + slDist * g_LockRRRatio : g_EntryPrice - slDist * g_LockRRRatio);
                  CreateTPLine(g_TPPrice);
               }
            }
            changed = true;
         }
         if(sparam == PRISM_PREFIX + "SL")
         {
            double np  = NormPrice(ObjectGetDouble(0, sparam, OBJPROP_PRICE));
            ObjectSetDouble(0, sparam, OBJPROP_PRICE, np);
            bool   bad = (g_Direction == "LONG") ? np >= g_EntryPrice : np <= g_EntryPrice;
            if(bad) { ObjectSetDouble(0, sparam, OBJPROP_PRICE, g_SLPrice); ShowError("SL wrong side"); }
            else
            {
               g_SLPrice = np;
               if(g_LockRR)
               {
                  double slDist = MathAbs(g_EntryPrice - g_SLPrice);
                  g_TPPrice = NormPrice((g_Direction == "LONG") ? g_EntryPrice + slDist * g_LockRRRatio : g_EntryPrice - slDist * g_LockRRRatio);
                  CreateTPLine(g_TPPrice);
               }
            }
            changed = true;
         }
         if(sparam == PRISM_PREFIX + "TP" && !g_LockRR)
         {
            double np  = NormPrice(ObjectGetDouble(0, sparam, OBJPROP_PRICE));
            ObjectSetDouble(0, sparam, OBJPROP_PRICE, np);
            bool   bad = (g_Direction == "LONG") ? np <= g_EntryPrice : np >= g_EntryPrice;
            if(bad) { ObjectSetDouble(0, sparam, OBJPROP_PRICE, g_TPPrice); ShowError("TP wrong side"); }
            else g_TPPrice = np;
            changed = true;
         }
         if(changed) { CalculateRiskReward(); ShowConfirmPanel(); ChartRedraw(0); }
      }

      if(g_PlannerState == STATE_IDLE)
      {
         if(StringFind(sparam, PRISM_PREFIX + "PosSL") == 0 || StringFind(sparam, PRISM_PREFIX + "PosTP") == 0)
         {
            string ticketStr = (StringFind(sparam, PRISM_PREFIX + "PosSL") == 0)
                               ? StringSubstr(sparam, StringLen(PRISM_PREFIX + "PosSL"))
                               : StringSubstr(sparam, StringLen(PRISM_PREFIX + "PosTP"));
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
      if(g_PlannerState == STATE_CONFIRMING) ShowConfirmPanel();
}

//+------------------------------------------------------------------+
//| Sync helpers                                                      |
//+------------------------------------------------------------------+
void SendJson(const string &json)
{
   string headers = HEADER_CONTENT_TYPE + HEADER_BRIDGE_KEY + BridgeKey + "\r\n";
   uchar  data[];
   int    len = StringToCharArray(json, data, 0, WHOLE_ARRAY, CP_UTF8);
   if(len > 0) ArrayResize(data, len - 1);
   uchar  result[];
   string res_headers;
   int res = WebRequest("POST", SyncUrl, headers, 5000, data, result, res_headers);
   if(res == -1) PrintFormat("PrismTrade WebRequest error %d", GetLastError());
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
      double mae = (tIdx != -1) ? g_TkMAE[tIdx] : 0.0;
      double mfe = (tIdx != -1) ? g_TkMFE[tIdx] : 0.0;
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
      string ts     = (deal_type == DEAL_TYPE_BUY) ? "BUY" : "SELL";
      string timeStr= TimeToString(ToGmt(time), TIME_DATE|TIME_MINUTES|TIME_SECONDS);
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
         string cr   = CloseReasonStr(reason);
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
//| Init / Deinit / Tick / Timer / Trade                             |
//+------------------------------------------------------------------+
int OnInit()
{
   if(BridgeKey == "") Print("PrismTrade WARNING: BridgeKey empty");
   g_Trade.SetExpertMagicNumber(42000);
   ChartSetInteger(0, CHART_EVENT_MOUSE_MOVE, true);
   g_SettX = g_PanelX + PANEL_W + 10;
   g_SettY = g_PanelY;
   CreateToolbar();
   ShowPositionLines();
   g_SyncDone = false;
   EventSetTimer(1);
   PrintFormat("PrismTrade v5.4 started on %s", Symbol());
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   ObjectsDeleteAll(0, PRISM_PREFIX);
   ChartSetInteger(0, CHART_MOUSE_SCROLL, true);
   EventKillTimer();
}

void OnTick()
{
   if(g_AutoBE)   RunAutoBreakeven();
   if(g_TrailOn)  RunTrailingStop();
   if(g_PartialOn)RunPartialTPs();
}

void OnTimer()
{
   ClearError();
   if(!g_SyncDone)
   {
      g_SyncDone = true;
      if(BridgeKey != "") SyncHistory();
      EventKillTimer(); EventSetTimer(TimerPeriod);
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
   string ts     = (deal_type == DEAL_TYPE_BUY) ? "BUY" : "SELL";
   string acctId = (string)AccountInfoInteger(ACCOUNT_LOGIN);
   string timeStr= TimeToString(ToGmt(time), TIME_DATE|TIME_MINUTES|TIME_SECONDS);

   string json;
   if(entry_type == DEAL_ENTRY_IN)
   {
      long pt = (deal_type == DEAL_TYPE_BUY) ? POSITION_TYPE_BUY : POSITION_TYPE_SELL;
      InitTrackEntry(pos_id, price, pt);
      if(g_PendingPartial && g_PendingSLDist > 0)
      {
         SetTrackPartialData(pos_id, volume, g_PendingSLDist);
         g_PendingPartial = false;
         g_PendingSLDist  = 0.0;
      }
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
      string cr   = CloseReasonStr(reason);
      int cIdx    = FindTrackedIdx(pos_id);
      double mae  = (cIdx != -1) ? g_TkMAE[cIdx] : 0.0;
      double mfe  = (cIdx != -1) ? g_TkMFE[cIdx] : 0.0;
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
