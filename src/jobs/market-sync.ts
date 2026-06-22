import { marketPriceService } from '../modules/market-price/service.js';

const SYNC_INTERVAL_MS = 5 * 60 * 1000;

async function syncMarketPrices() {
  console.log('[Market Sync] Starting price sync...');
  
  try {
    await marketPriceService.syncPrices();
    console.log('[Market Sync] Price sync completed successfully');
  } catch (error) {
    console.error('[Market Sync] Price sync failed:', error);
  }
}

let syncInterval: NodeJS.Timeout | null = null;

export function startMarketSyncJob() {
  if (syncInterval) {
    console.log('[Market Sync] Job already running');
    return;
  }
  
  syncMarketPrices();
  
  syncInterval = setInterval(syncMarketPrices, SYNC_INTERVAL_MS);
  console.log(`[Market Sync] Job started, syncing every ${SYNC_INTERVAL_MS / 1000 / 60} minutes`);
}

export function stopMarketSyncJob() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    console.log('[Market Sync] Job stopped');
  }
}
