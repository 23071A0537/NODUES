import dotenv from 'dotenv';
import { google } from 'googleapis';
import http from 'http';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from parent directory
dotenv.config({ path: join(__dirname, '..', '.env') });

require('dotenv').config();

const CLIENT_ID = process.env.GOOGLE_DRIVE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3001/callback';

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: SCOPES,
});

console.log('========================================');
console.log('Google Drive API - Get Refresh Token');
console.log('========================================\n');
console.log('IMPORTANT: Before running, make sure you have added');
console.log(`  ${REDIRECT_URI}`);
console.log('as an Authorized redirect URI in Google Cloud Console:\n');
console.log('  Google Cloud Console > APIs & Services > Credentials');
console.log('  > Edit your OAuth 2.0 Client ID > Authorized redirect URIs\n');
console.log('1. Visit this URL in your browser:\n');
console.log(authUrl);
console.log('\n2. Sign in and authorize the application');
console.log('3. You will be redirected automatically...\n');

// Start a local server to capture the OAuth callback
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:3001`);
  if (url.pathname !== '/callback') return;

  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h1>Authorization failed</h1><p>You can close this window.</p>');
    console.error('\nAuthorization denied:', error);
    server.close();
    process.exit(1);
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h1>Success!</h1><p>Refresh token generated. Check your terminal. You can close this window.</p>');

    console.log('\n========================================');
    console.log('SUCCESS! Your credentials:');
    console.log('========================================\n');
    console.log('Refresh Token:');
    console.log(tokens.refresh_token);
    console.log('\n========================================');
    console.log('Update GOOGLE_DRIVE_REFRESH_TOKEN in your .env file:');
    console.log('========================================\n');
    console.log(`GOOGLE_DRIVE_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log('\n');
  } catch (err) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h1>Error</h1><p>Failed to get token. Check your terminal.</p>');
    console.error('\nError retrieving access token:', err.message);
  }

  server.close();
  process.exit(0);
});

server.listen(3001, () => {
  console.log('Waiting for authorization on http://localhost:3001/callback ...\n');
});
