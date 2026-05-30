import 'dotenv/config';
import { google } from 'googleapis';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';

function getAuth() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return oauth2Client;
}

async function findOrCreateBackupFolder(): Promise<string> {
  const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!rootFolderId) throw new Error('GOOGLE_DRIVE_FOLDER_ID not configured');

  const drive = google.drive({ version: 'v3', auth: getAuth() });

  const { data } = await drive.files.list({
    q: `name='backup' and mimeType='application/vnd.google-apps.folder' and '${rootFolderId}' in parents and trashed=false`,
    fields: 'files(id)',
    spaces: 'drive',
  });

  if (data.files && data.files.length > 0) {
    return data.files[0].id!;
  }

  const { data: folder } = await drive.files.create({
    requestBody: {
      name: 'backup',
      mimeType: 'application/vnd.google-apps.folder',
      parents: [rootFolderId],
    },
    fields: 'id',
  });
  return folder.id!;
}

export interface BackupResult {
  fileId: string;
  fileName: string;
  sizeBytes: number;
  timestamp: string;
}

export async function backupDatabase(): Promise<BackupResult> {
  const dbPath = path.resolve(process.cwd(), 'prisma/dev.db');

  if (!fs.existsSync(dbPath)) {
    throw new Error(`Database file not found at ${dbPath}`);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `prd-backup-${timestamp}.db`;

  const fileBuffer = fs.readFileSync(dbPath);
  const backupFolderId = await findOrCreateBackupFolder();

  const drive = google.drive({ version: 'v3', auth: getAuth() });
  const stream = Readable.from(fileBuffer);

  const { data } = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [backupFolderId],
    },
    media: {
      mimeType: 'application/x-sqlite3',
      body: stream,
    },
    fields: 'id,name',
  });

  return {
    fileId: data.id!,
    fileName: data.name!,
    sizeBytes: fileBuffer.length,
    timestamp,
  };
}
