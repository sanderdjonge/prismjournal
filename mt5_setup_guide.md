# PrismSync MT5 Installation Guide

To enable automated trade syncing between MetaTrader 5 and PrismJournal on your Mac, follow these steps:

## 1. Locate the EA File
Find the [PrismSync.mq5](file:///Users/sanderdejonge/Documents/AI-Stuff/PrismJournal/server/workers/PrismSync.mq5) file in your project directory.

## 2. Add to MT5
1. Open MetaTrader 5.
2. Go to **File > Open Data Folder**.
3. Navigate to **MQL5 > Experts**.
4. Copy the `PrismSync.mq5` file into this folder (or a sub-folder if you prefer).

## 3. Enable WebRequests (CRITICAL)
Since the EA needs to send data to your server, you must whitelist the URL:
1. In MT5, go to **Tools > Options**.
2. Select the **Expert Advisors** tab.
3. Check **"Allow WebRequest for listed URL"**.
4. Add your backend URL (e.g., `http://localhost:3000`).

## 4. Run the EA
1. In the **Navigator** panel (Ctrl+N), right-click **Expert Advisors** and select **Refresh**.
2. Find **PrismSync** and drag it onto any open chart.
3. In the "Inputs" tab, enter your `Prism API Key`.
4. Click **OK**.

> [!TIP]
> Look for a "Smiley Face" icon in the top right corner of your chart. If it's smiling, the EA is active! Check the "Experts" tab at the bottom for sync logs.
