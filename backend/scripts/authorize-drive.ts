/**
 * Run once to obtain a Google Drive refresh token.
 * Opens a browser, lets you pick any Google account, then saves the token.
 *
 * Run:  npx ts-node scripts/authorize-drive.ts
 */

import 'dotenv/config';
import { google } from 'googleapis';
import * as http from 'http';
import { URL } from 'url';
import { exec } from 'child_process';

const PORT = 3333;
const REDIRECT_URI = `http://localhost:${PORT}`;

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.error('\nError: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env\n');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  REDIRECT_URI,
);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/drive'],
  prompt: 'select_account consent', // always show account picker
});

// Open the browser automatically on Windows
exec(`start "" "${authUrl}"`);

console.log('\n─────────────────────────────────────────────────────');
console.log('  Browser opening... If it does not open, visit:');
console.log('─────────────────────────────────────────────────────');
console.log('\n' + authUrl + '\n');
console.log('─────────────────────────────────────────────────────');
console.log('  Waiting for Google to redirect back on port', PORT, '...');
console.log('─────────────────────────────────────────────────────\n');

// Temporary server that catches the OAuth redirect
const server = http.createServer(async (req, res) => {
  try {
    const params = new URL(req.url!, REDIRECT_URI).searchParams;
    const code = params.get('code');
    const error = params.get('error');

    if (error || !code) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h2>Authorization cancelled or failed. You can close this tab.</h2>');
      server.close();
      console.error('Authorization was denied or an error occurred:', error);
      process.exit(1);
    }

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h2 style="font-family:sans-serif;color:green">✓ Authorization successful! You can close this tab and go back to the terminal.</h2>');
    server.close();

    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      console.error('\nNo refresh_token returned.');
      console.error('This usually means the account already authorized this app before.');
      console.error('Fix: Go to https://myaccount.google.com/permissions, revoke access for this app, then run this script again.\n');
      process.exit(1);
    }

    console.log('─────────────────────────────────────────────────────');
    console.log('  SUCCESS — paste this into backend/.env:');
    console.log('─────────────────────────────────────────────────────');
    console.log(`\nGOOGLE_REFRESH_TOKEN="${tokens.refresh_token}"\n`);
    console.log('─────────────────────────────────────────────────────\n');

  } catch (err) {
    res.writeHead(500);
    res.end('Error');
    console.error('Error exchanging code:', err);
    server.close();
    process.exit(1);
  }
});

server.listen(PORT, () => {
  // listening and waiting for redirect
});
