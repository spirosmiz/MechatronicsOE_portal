import { google } from 'googleapis';
import { Readable } from 'stream';

function getAuth() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });
  return oauth2Client;
}

function isDriveConfigured() {
  return !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN &&
    process.env.GOOGLE_DRIVE_FOLDER_ID
  );
}

export { isDriveConfigured };

// ─── Folder helpers ────────────────────────────────────────────────────────

export async function createDriveFolder(name: string, parentId: string): Promise<string> {
  return createFolder(name, parentId);
}

async function createFolder(name: string, parentId: string): Promise<string> {
  const drive = google.drive({ version: 'v3', auth: getAuth() });
  const { data } = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
  });
  return data.id!;
}

export interface InventoryItemFolders {
  rootId: string;
  photosId: string;
  datasheetsId: string;
}

export async function createInventoryItemFolders(partNumber: string, name: string, brandFolderId: string): Promise<InventoryItemFolders> {
  const rootId = await createFolder(`${partNumber} - ${name}`, brandFolderId);
  const [photosId, datasheetsId] = await Promise.all([
    createFolder('Photos', rootId),
    createFolder('Datasheets', rootId),
  ]);
  return { rootId, photosId, datasheetsId };
}

export interface CustomerFolders {
  rootId: string;
  mediaId: string;
  offersId: string;
  contractsId: string;
}

export async function createCustomerFolders(companyName: string, customersRootId: string): Promise<CustomerFolders> {
  const rootId = await createFolder(companyName, customersRootId);
  const [mediaId, offersId, contractsId] = await Promise.all([
    createFolder('Media', rootId),
    createFolder('Offers', rootId),
    createFolder('Contracts', rootId),
  ]);
  return { rootId, mediaId, offersId, contractsId };
}

// ─── File helpers ──────────────────────────────────────────────────────────

export interface DriveFile {
  fileId: string;
  webViewLink: string;
  thumbnailUrl: string | null;
}

export async function uploadToDrive(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
  folderId?: string
): Promise<DriveFile> {
  const targetFolder = folderId ?? process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!targetFolder) throw new Error('GOOGLE_DRIVE_FOLDER_ID not configured');

  const drive = google.drive({ version: 'v3', auth: getAuth() });
  const stream = Readable.from(buffer);

  const { data } = await drive.files.create({
    requestBody: { name: fileName, parents: [targetFolder] },
    media: { mimeType, body: stream },
    fields: 'id,webViewLink,thumbnailLink',
  });

  await drive.permissions.create({
    fileId: data.id!,
    requestBody: { role: 'reader', type: 'anyone' },
  });

  return {
    fileId: data.id!,
    webViewLink: data.webViewLink!,
    thumbnailUrl: data.thumbnailLink ?? null,
  };
}

export async function deleteFromDrive(fileId: string): Promise<void> {
  const drive = google.drive({ version: 'v3', auth: getAuth() });
  await drive.files.delete({ fileId });
}
