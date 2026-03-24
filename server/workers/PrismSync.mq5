//+------------------------------------------------------------------+
//|                                                   PrismSync.mq5 |
//|                     Copyright 2025, PrismJournal                  |
//|                                                                  |
//+------------------------------------------------------------------+
#property copyright "2025, PrismJournal"
#property link      "https://github.com/prismjournal"
#property version   "3.14"
#property description "Syncs trades and equity snapshots to PrismJournal."
#property description "Syncs full trade history on startup, then live trades in real-time."
#property description "Get your Bridge Key and Sync URL from Settings > Connector Hub."

//--- input parameters
input string   SyncUrl     = "https://prism.we-share.nl/api/sync"; // Sync URL
input string   BridgeKey   = "";                 // Bridge Key (from PrismJournal settings)
input string   Strategy    = "Default";          // Current Strategy Name
input uint     TimerPeriod = 60;                 // Seconds between equity snapshots
input uint     HistoryDays = 90;                 // Days of trade history to sync on startup (0 = all time)

//--- constants
#define  HEADER_CONTENT_TYPE "Content-Type: application/json\r\n"
#define  HEADER_BRIDGE_KEY   "X-Bridge-Key: "

//+------------------------------------------------------------------+
//| Helper: convert broker server time to UTC                        |
//| Subtracts the broker's GMT offset so all timestamps sent to      |
//| PrismJournal are always in UTC regardless of broker timezone.    |
//+------------------------------------------------------------------+
datetime ToGmt(datetime brokerTime)
  {
   return brokerTime - (TimeCurrent() - TimeGMT());
  }

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
  {
   if(BridgeKey == "")
     {
      Alert("PrismSync: Please enter your Bridge Key. "
            "Find it in PrismJournal > Settings > Connector Hub.");
      return(INIT_PARAMETERS_INCORRECT);
     }

   PrintFormat("%s: PrismSync EA v3.0 started — syncing to %s", __FUNCTION__, SyncUrl);

   // Sync full trade history on startup
   SyncHistory();

   EventSetTimer(TimerPeriod);
   return(INIT_SUCCEEDED);
  }

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   EventKillTimer();
   Print(__FUNCTION__,": PrismSync EA stopped");
  }

//+------------------------------------------------------------------+
//| Timer event - send EQUITY_SNAPSHOT every TimerPeriod seconds     |
//+------------------------------------------------------------------+
void OnTimer()
  {
   double balance  = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity   = AccountInfoDouble(ACCOUNT_EQUITY);
   string acctId   = (string)AccountInfoInteger(ACCOUNT_LOGIN);

   string json = "{"
                 "\"type\":\"EQUITY_SNAPSHOT\","
                 "\"platformAccountId\":\"" + acctId + "\","
                 "\"platform\":\"METATRADER5\","
                 "\"snapshot\":{"
                 "\"balance\":" + DoubleToString(balance, 2) + ","
                 "\"equity\":"  + DoubleToString(equity , 2) + ","
                 "\"timestamp\":\"" + TimeToString(ToGmt(TimeCurrent()), TIME_DATE|TIME_MINUTES|TIME_SECONDS) + "\""
                 "}"
                 "}";

   SendJson(json);

   // Update all open positions with live P&L
   SyncOpenPositions();
  }

//+------------------------------------------------------------------+
//| Sync live P&L for all currently open positions                   |
//+------------------------------------------------------------------+
void SyncOpenPositions()
  {
   string acctId = (string)AccountInfoInteger(ACCOUNT_LOGIN);
   int total = PositionsTotal();
   for(int i = 0; i < total; i++)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      if(!PositionSelectByTicket(ticket)) continue;

      string symbol   = PositionGetString(POSITION_SYMBOL);
      double volume   = PositionGetDouble(POSITION_VOLUME);
      double openPr   = PositionGetDouble(POSITION_PRICE_OPEN);
      double curPr    = PositionGetDouble(POSITION_PRICE_CURRENT);
      double profit   = PositionGetDouble(POSITION_PROFIT);
      double swap     = PositionGetDouble(POSITION_SWAP);
      double sl       = PositionGetDouble(POSITION_SL);
      double tp       = PositionGetDouble(POSITION_TP);
      datetime time   = (datetime)PositionGetInteger(POSITION_TIME);
      long   posType  = PositionGetInteger(POSITION_TYPE);

      string type_str = (posType == POSITION_TYPE_BUY) ? "BUY" : "SELL";

      string posJson = "{"
                       "\"type\":\"TRADE_UPDATE\","
                       "\"platformAccountId\":\"" + acctId + "\","
                       "\"platform\":\"METATRADER5\","
                       "\"trade\":{"
                       "\"ticket\":\"POS-" + (string)ticket + "\","
                       "\"symbol\":\"" + symbol + "\","
                       "\"type\":\""   + type_str + "\","
                       "\"volume\":"   + DoubleToString(volume, 2) + ","
                       "\"entryPrice\":" + DoubleToString(openPr, 5) + ","
                       "\"pnl\":"      + DoubleToString(profit, 2) + ","
                       "\"swap\":"      + DoubleToString(swap, 2) + ","
                       "\"entryTime\":\"" + TimeToString(ToGmt(time), TIME_DATE|TIME_MINUTES|TIME_SECONDS) + "\","
                       "\"strategy\":\"" + Strategy + "\""
                       + OptField("stopLoss", sl, 5)
                       + OptField("takeProfit", tp, 5)
                       + "}"
                       "}";
      SendJson(posJson);
     }
  }

//+------------------------------------------------------------------+
//| Build optional JSON field (skip if value is 0)                   |
//+------------------------------------------------------------------+
string OptField(string name, double val, int digits)
  {
   if(val == 0) return "";
   return ",\"" + name + "\":" + DoubleToString(val, digits);
  }

//+------------------------------------------------------------------+
//| Map DEAL_REASON integer to a human-readable close reason string  |
//+------------------------------------------------------------------+
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
//| Sync full deal history on startup                                |
//| Groups entry + exit deals by position ID for complete trades     |
//+------------------------------------------------------------------+
void SyncHistory()
  {
   datetime fromTime = (HistoryDays == 0) ? 0 : TimeCurrent() - (datetime)(HistoryDays * 86400);
   if(!HistorySelect(fromTime, TimeCurrent()))
     {
      Print("SyncHistory: Failed to select deal history");
      return;
     }

   int total = HistoryDealsTotal();
   PrintFormat("SyncHistory: Found %d deals in history, scanning...", total);

   string acctId = (string)AccountInfoInteger(ACCOUNT_LOGIN);

   // Collect position IDs and their entry/exit deals
   // We process sequentially: entry deals create, exit deals update via upsert
   int synced = 0;

   // First pass: collect all unique position IDs with their entry deal data
   for(int i = 0; i < total; i++)
     {
      ulong deal_ticket = HistoryDealGetTicket(i);
      if(deal_ticket == 0) continue;

      ENUM_DEAL_TYPE deal_type = (ENUM_DEAL_TYPE)HistoryDealGetInteger(deal_ticket, DEAL_TYPE);
      if(deal_type != DEAL_TYPE_BUY && deal_type != DEAL_TYPE_SELL)
         continue;

      string symbol = HistoryDealGetString(deal_ticket, DEAL_SYMBOL);
      if(symbol == "") continue;

      ENUM_DEAL_ENTRY entry_type = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(deal_ticket, DEAL_ENTRY);
      ulong    pos_id  = HistoryDealGetInteger(deal_ticket, DEAL_POSITION_ID);
      double   volume  = HistoryDealGetDouble(deal_ticket, DEAL_VOLUME);
      double   price   = HistoryDealGetDouble(deal_ticket, DEAL_PRICE);
      double   profit  = HistoryDealGetDouble(deal_ticket, DEAL_PROFIT);
      double   comm    = HistoryDealGetDouble(deal_ticket, DEAL_COMMISSION);
      double   swap    = HistoryDealGetDouble(deal_ticket, DEAL_SWAP);
      double   sl      = HistoryDealGetDouble(deal_ticket, DEAL_SL);
      double   tp      = HistoryDealGetDouble(deal_ticket, DEAL_TP);
      datetime time    = (datetime)HistoryDealGetInteger(deal_ticket, DEAL_TIME);

      string type_str = (deal_type == DEAL_TYPE_BUY) ? "BUY" : "SELL";

      if(entry_type == DEAL_ENTRY_IN)
        {
         // Entry deal — send with entry info, SL, TP
         string json = "{"
                       "\"type\":\"TRADE_UPDATE\","
                       "\"platformAccountId\":\"" + acctId + "\","
                       "\"platform\":\"METATRADER5\","
                       "\"isHistorySync\":true,"
                       "\"trade\":{"
                       "\"ticket\":\"POS-" + (string)pos_id + "\","
                       "\"symbol\":\"" + symbol + "\","
                       "\"type\":\""   + type_str + "\","
                       "\"volume\":"   + DoubleToString(volume, 2) + ","
                       "\"entryPrice\":" + DoubleToString(price, 5) + ","
                       "\"entryTime\":\"" + TimeToString(ToGmt(time), TIME_DATE|TIME_MINUTES|TIME_SECONDS) + "\","
                       "\"strategy\":\"" + Strategy + "\""
                       + OptField("stopLoss", sl, 5)
                       + OptField("takeProfit", tp, 5)
                       + "}"
                       "}";
         SendJson(json);
         synced++;
        }
      else if(entry_type == DEAL_ENTRY_OUT || entry_type == DEAL_ENTRY_OUT_BY)
        {
         // Exit deal — update with exit info, P&L, commission, swap
         long   reason      = HistoryDealGetInteger(deal_ticket, DEAL_REASON);
         string closeReason = CloseReasonStr(reason);
         string json = "{"
                       "\"type\":\"TRADE_UPDATE\","
                       "\"platformAccountId\":\"" + acctId + "\","
                       "\"platform\":\"METATRADER5\","
                       "\"isHistorySync\":true,"
                       "\"trade\":{"
                       "\"ticket\":\"POS-" + (string)pos_id + "\","
                       "\"symbol\":\"" + symbol + "\","
                       "\"type\":\""   + type_str + "\","
                       "\"volume\":"   + DoubleToString(volume, 2) + ","
                       "\"exitPrice\":" + DoubleToString(price, 5) + ","
                       "\"pnl\":"      + DoubleToString(profit, 2) + ","
                       "\"commission\":" + DoubleToString(comm, 2) + ","
                       "\"swap\":"      + DoubleToString(swap, 2) + ","
                       "\"entryTime\":\"" + TimeToString(ToGmt(time), TIME_DATE|TIME_MINUTES|TIME_SECONDS) + "\","
                       "\"exitTime\":\"" + TimeToString(ToGmt(time), TIME_DATE|TIME_MINUTES|TIME_SECONDS) + "\","
                       "\"strategy\":\"" + Strategy + "\""
                       + OptField("stopLoss", sl, 5)
                       + OptField("takeProfit", tp, 5)
                       + ",\"closeReason\":\"" + closeReason + "\""
                       + "}"
                       "}";
         SendJson(json);
         synced++;
        }
     }

   PrintFormat("SyncHistory: Synced %d deals to PrismJournal", synced);
  }

//+------------------------------------------------------------------+
//| Trade transaction event - send TRADE_UPDATE for live deals       |
//+------------------------------------------------------------------+
void OnTradeTransaction(const MqlTradeTransaction& trans,
                         const MqlTradeRequest    &request,
                         const MqlTradeResult     &result)
  {
   if(trans.type != TRADE_TRANSACTION_DEAL_ADD)
      return;

   ulong deal_ticket = trans.deal;
   if(!HistoryDealSelect(deal_ticket)) return;

   string symbol = HistoryDealGetString(deal_ticket, DEAL_SYMBOL);
   if(symbol == "") return;

   ENUM_DEAL_TYPE  deal_type  = (ENUM_DEAL_TYPE)HistoryDealGetInteger(deal_ticket, DEAL_TYPE);
   if(deal_type != DEAL_TYPE_BUY && deal_type != DEAL_TYPE_SELL) return;

   ENUM_DEAL_ENTRY entry_type = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(deal_ticket, DEAL_ENTRY);
   ulong    pos_id  = HistoryDealGetInteger(deal_ticket, DEAL_POSITION_ID);
   double   volume  = HistoryDealGetDouble(deal_ticket, DEAL_VOLUME);
   double   price   = HistoryDealGetDouble(deal_ticket, DEAL_PRICE);
   double   profit  = HistoryDealGetDouble(deal_ticket, DEAL_PROFIT);
   double   comm    = HistoryDealGetDouble(deal_ticket, DEAL_COMMISSION);
   double   swap    = HistoryDealGetDouble(deal_ticket, DEAL_SWAP);
   double   sl      = HistoryDealGetDouble(deal_ticket, DEAL_SL);
   double   tp      = HistoryDealGetDouble(deal_ticket, DEAL_TP);
   datetime time    = (datetime)HistoryDealGetInteger(deal_ticket, DEAL_TIME);

   string type_str = (deal_type == DEAL_TYPE_BUY) ? "BUY" : "SELL";
   string acctId   = (string)AccountInfoInteger(ACCOUNT_LOGIN);

   string json;
   if(entry_type == DEAL_ENTRY_IN)
     {
      json = "{"
             "\"type\":\"TRADE_UPDATE\","
             "\"platformAccountId\":\"" + acctId + "\","
             "\"platform\":\"METATRADER5\","
             "\"trade\":{"
             "\"ticket\":\"POS-" + (string)pos_id + "\","
             "\"symbol\":\"" + symbol + "\","
             "\"type\":\""   + type_str + "\","
             "\"volume\":"   + DoubleToString(volume, 2) + ","
             "\"entryPrice\":" + DoubleToString(price, 5) + ","
             "\"entryTime\":\"" + TimeToString(ToGmt(time), TIME_DATE|TIME_MINUTES|TIME_SECONDS) + "\","
             "\"strategy\":\"" + Strategy + "\""
             + OptField("stopLoss", sl, 5)
             + OptField("takeProfit", tp, 5)
             + "}"
             "}";
     }
   else
     {
      long   reason      = HistoryDealGetInteger(deal_ticket, DEAL_REASON);
      string closeReason = CloseReasonStr(reason);
      json = "{"
             "\"type\":\"TRADE_UPDATE\","
             "\"platformAccountId\":\"" + acctId + "\","
             "\"platform\":\"METATRADER5\","
             "\"trade\":{"
             "\"ticket\":\"POS-" + (string)pos_id + "\","
             "\"symbol\":\"" + symbol + "\","
             "\"type\":\""   + type_str + "\","
             "\"volume\":"   + DoubleToString(volume, 2) + ","
             "\"exitPrice\":" + DoubleToString(price, 5) + ","
             "\"pnl\":"      + DoubleToString(profit, 2) + ","
             "\"commission\":" + DoubleToString(comm, 2) + ","
             "\"swap\":"      + DoubleToString(swap, 2) + ","
             "\"entryTime\":\"" + TimeToString(ToGmt(time), TIME_DATE|TIME_MINUTES|TIME_SECONDS) + "\","
             "\"exitTime\":\"" + TimeToString(ToGmt(time), TIME_DATE|TIME_MINUTES|TIME_SECONDS) + "\","
             "\"strategy\":\"" + Strategy + "\""
             + OptField("stopLoss", sl, 5)
             + OptField("takeProfit", tp, 5)
             + ",\"closeReason\":\"" + closeReason + "\""
             + "}"
             "}";
     }

   SendJson(json);
  }

//+------------------------------------------------------------------+
//| Helper: send JSON string via WebRequest                          |
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

   if(res == -1)
      PrintFormat("WebRequest failed, error %d", GetLastError());
   else
     {
      string body = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
      PrintFormat("HTTP %d — %s", res, body);
     }
  }
