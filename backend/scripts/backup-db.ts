import 'dotenv/config';
import { backupDatabase } from '../src/lib/backupService';

(async () => {
  console.log(`[backup] Starting database backup — ${new Date().toISOString()}`);
  try {
    const result = await backupDatabase();
    const kb = (result.sizeBytes / 1024).toFixed(1);
    console.log(`[backup] Done — ${result.fileName} (${kb} KB) uploaded to Google Drive (id: ${result.fileId})`);
    process.exit(0);
  } catch (err) {
    console.error('[backup] Failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
})();
