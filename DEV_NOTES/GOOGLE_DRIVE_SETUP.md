# Google Drive API Setup Guide

This guide will help you configure Google Drive integration for direct file uploads in the No Dues system.

## Overview

The system uploads student documents directly to your Google Drive folders:

- **Documents Folder**: Student due clearance documents (transcripts, certificates, etc.)
- **Permissions Folder**: Special permission grant requests

Files are automatically named: `{due_id}_{roll_number}.{extension}`

## Prerequisites

- A Google account with access to Google Drive
- Access to Google Cloud Console
- Node.js installed (for authentication script)

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a project** → **New Project**
3. Enter project name (e.g., "NoDues-FileUpload")
4. Click **Create**

## Step 2: Enable Google Drive API

1. In your project, go to **APIs & Services** → **Library**
2. Search for "Google Drive API"
3. Click on **Google Drive API**
4. Click **Enable**

## Step 3: Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **+ Create Credentials** → **OAuth client ID**
3. If prompted, configure the OAuth consent screen:
   - User Type: **Internal** (if using Google Workspace) or **External**
   - App name: "NoDues System"
   - User support email: Your email
   - Developer contact: Your email
   - Click **Save and Continue**
   - Scopes: Skip for now, click **Save and Continue**
   - Test users: Add your email if using External
   - Click **Save and Continue**
4. Back to **Create OAuth client ID**:
   - Application type: **Desktop app**
   - Name: "NoDues Desktop Client"
   - Click **Create**
5. **Download JSON** file and save it securely
6. Note your **Client ID** and **Client Secret**

## Step 4: Get Refresh Token

The project already includes a `getRefreshToken.js` script in your BACKEND directory.

**Edit the script** and replace the placeholder credentials:

```javascript
import { google } from "googleapis";
import readline from "readline";

// Replace with your credentials from Google Cloud Console
const CLIENT_ID = "your-client-id-here";
const CLIENT_SECRET = "your-client-secret-here";
const REDIRECT_URI = "urn:ietf:wg:oauth:2.0:oob";

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI,
);

const SCOPES = ["https://www.googleapis.com/auth/drive.file"];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  scope: SCOPES,
});

console.log("Authorize this app by visiting this url:", authUrl);
console.log("\\n");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("Enter the code from that page here: ", async (code) => {
  rl.close();
  try {
    const { tokens } = await oauth2Client.getToken(code);
    console.log("\\nYour refresh token is:");
    console.log(tokens.refresh_token);
    console.log("\\nAdd this to your .env file as GOOGLE_DRIVE_REFRESH_TOKEN");
  } catch (error) {
    console.error("Error retrieving access token", error);
  }
});
```

Run the script:

```bash
cd BACKEND
node getRefreshToken.js
```

1. Click the URL shown in the console
2. Sign in with your Google account
3. Click **Allow** to grant permissions
4. Copy the authorization code
5. Paste it in the terminal
6. Copy the **refresh token** displayed

## Step 5: Create Google Drive Folders

1. Go to [Google Drive](https://drive.google.com)
2. Create two folders:
   - "NoDues - Student Documents"
   - "NoDues - Permission Grants"
3. For each folder:
   - Open the folder
   - Copy the **Folder ID** from the URL
   - URL format: `drive.google.com/drive/folders/FOLDER_ID_HERE`
   - Example: If URL is `drive.google.com/drive/folders/1a2B3c4D5e6F7g8H9i0J`, the ID is `1a2B3c4D5e6F7g8H9i0J`

## Step 6: Configure Environment Variables

Edit your `BACKEND/.env` file and add:

```env
# Google Drive Configuration
GOOGLE_DRIVE_CLIENT_ID=your-client-id-from-step-3
GOOGLE_DRIVE_CLIENT_SECRET=your-client-secret-from-step-3
GOOGLE_DRIVE_REFRESH_TOKEN=your-refresh-token-from-step-4
GOOGLE_DRIVE_DOCUMENTS_FOLDER_ID=folder-id-for-documents
GOOGLE_DRIVE_PERMISSIONS_FOLDER_ID=folder-id-for-permissions
```

## Step 7: Test the Configuration

The project already includes a `testDriveUpload.js` script. Simply run it:

```bash
cd BACKEND
node testDriveUpload.js
```

The script uses ES6 imports and will:

1. Check if all Google Drive environment variables are configured
2. Create a test text file buffer
3. Upload it to your Documents folder
4. Display the file ID and view link

If successful, you should see a file appear in your Documents folder!

## Troubleshooting

### "Invalid grant" error

- Your refresh token expired
- Re-run `getRefreshToken.js` to get a new one

### "Access denied" error

- Make sure Google Drive API is enabled
- Check that your OAuth consent screen is properly configured

### "Folder not found" error

- Verify the folder IDs are correct
- Make sure the folders exist in the Drive account that generated the refresh token

### Files not appearing

- Check that you're logged into the same Google account
- Folder IDs might be incorrect
- Verify all environment variables are set

## File Upload Limits

- Maximum file size: **10 MB**
- Allowed formats: PDF, JPG, JPEG, PNG, WEBP, DOC, DOCX
- Files are automatically renamed: `{due_id}_{roll_number}.{extension}`

## Security Notes

1. **Never commit** `.env` file to version control
2. Keep your `CLIENT_SECRET` and `REFRESH_TOKEN` private
3. Use **Internal** OAuth type if on Google Workspace
4. Regularly review uploaded files for compliance
5. Set up folder permissions appropriately (only operators should have edit access)

## File Naming Convention

When a student with roll number `21071A0501` uploads a document for due ID `15`:

- File is saved as: `15_21071A0501.pdf` (or appropriate extension)
- This makes it easy to identify which student uploaded which document for which due

## Operator Workflow

1. Operators access the designated Drive folders
2. Files are automatically organized by the system
3. Operators review submissions:
   - Approve: Mark permission as granted in the system
   - Reject: Add rejection reason in the system (student can reupload)
4. Old files are automatically deleted when students reupload

## Support

For issues with Google Drive integration:

- Check environment variables are correctly set
- Ensure API quotas haven't been exceeded
- Review error logs in the Node.js console
- Test with `testDriveUpload.js` script

---

**Setup Complete!** Students can now upload files directly through the system, and they'll appear in your organized Drive folders automatically.
