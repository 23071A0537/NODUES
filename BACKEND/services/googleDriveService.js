import dotenv from 'dotenv';
import { google } from 'googleapis';
import { dirname, extname, join } from 'path';
import { Readable } from 'stream';
import { fileURLToPath } from 'url';

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from parent directory
dotenv.config({ path: join(__dirname, '..', '..', '.env') });

/**
 * Google Drive Service
 * 
 * Environment Variables Required:
 * - GOOGLE_DRIVE_CLIENT_ID
 * - GOOGLE_DRIVE_CLIENT_SECRET
 * - GOOGLE_DRIVE_REDIRECT_URI
 * - GOOGLE_DRIVE_REFRESH_TOKEN
 * - GOOGLE_DRIVE_DOCUMENTS_FOLDER_ID (folder for student document uploads)
 * - GOOGLE_DRIVE_INTERNSHIP_LETTERS_FOLDER_ID (folder for internship letter copy uploads)
 * - GOOGLE_DRIVE_OFFER_LETTERS_FOLDER_ID (folder for offer letter copy uploads)
 * - GOOGLE_DRIVE_OTHER_DOCUMENTS_FOLDER_ID (folder for non internship/offer copy uploads)
 * - GOOGLE_DRIVE_PERMISSIONS_FOLDER_ID (folder for permission grant documents)
 * 
 * Setup Instructions:
 * 1. Go to Google Cloud Console (console.cloud.google.com)
 * 2. Create a new project or select existing one
 * 3. Enable Google Drive API
 * 4. Create OAuth 2.0 credentials
 * 5. Generate refresh token using OAuth 2.0 Playground
 * 6. Create two folders in Google Drive for uploads
 * 7. Get folder IDs from URL and add to .env
 */

const CLIENT_ID = process.env.GOOGLE_DRIVE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_DRIVE_REDIRECT_URI || 'https://developers.google.com/oauthplayground';
const REFRESH_TOKEN = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;

// Folder IDs for different upload types
const DOCUMENTS_FOLDER_ID = process.env.GOOGLE_DRIVE_DOCUMENTS_FOLDER_ID;
const INTERNSHIP_LETTERS_FOLDER_ID = process.env.GOOGLE_DRIVE_INTERNSHIP_LETTERS_FOLDER_ID;
const OFFER_LETTERS_FOLDER_ID = process.env.GOOGLE_DRIVE_OFFER_LETTERS_FOLDER_ID;
const OTHER_DOCUMENTS_FOLDER_ID = process.env.GOOGLE_DRIVE_OTHER_DOCUMENTS_FOLDER_ID;
const PERMISSIONS_FOLDER_ID = process.env.GOOGLE_DRIVE_PERMISSIONS_FOLDER_ID;

const resolveFolderIdForUploadType = (uploadType) => {
  switch (uploadType) {
    case 'permission':
      return PERMISSIONS_FOLDER_ID;
    case 'internship-document':
      return INTERNSHIP_LETTERS_FOLDER_ID || OTHER_DOCUMENTS_FOLDER_ID || DOCUMENTS_FOLDER_ID;
    case 'offer-document':
      return OFFER_LETTERS_FOLDER_ID || OTHER_DOCUMENTS_FOLDER_ID || DOCUMENTS_FOLDER_ID;
    case 'other-document':
      return OTHER_DOCUMENTS_FOLDER_ID || DOCUMENTS_FOLDER_ID;
    case 'document':
    default:
      return DOCUMENTS_FOLDER_ID;
  }
};

/**
 * Initialize OAuth2 client
 */
const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

if (REFRESH_TOKEN) {
  oauth2Client.setCredentials({
    refresh_token: REFRESH_TOKEN
  });
}

const drive = google.drive({ version: 'v3', auth: oauth2Client });

/**
 * Upload file to Google Drive
 * @param {Object} fileObject - File object with buffer, originalname, mimetype
 * @param {string} dueId - Due ID
 * @param {string} studentRollNumber - Student roll number
 * @param {string} uploadType - one of 'document', 'permission', 'internship-document', 'offer-document', or 'other-document'
 * @returns {Promise<Object>} - Drive file metadata with webViewLink
 */
export const uploadToGoogleDrive = async (fileObject, dueId, studentRollNumber, uploadType = 'document') => {
  try {
    // Validate credentials
    if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
      throw new Error('Google Drive API credentials not configured. Please check .env file.');
    }

    // Determine target folder based on upload type routing
    const folderId = resolveFolderIdForUploadType(uploadType);

    if (!folderId) {
      throw new Error(`Google Drive folder ID not configured for upload type: ${uploadType}`);
    }

    // Generate filename: {due_id}_{student_roll_number}.{extension}
    const fileExtension = extname(fileObject.originalname);
    const fileName = `${dueId}_${studentRollNumber}${fileExtension}`;

    // File metadata
    const fileMetadata = {
      name: fileName,
      parents: [folderId]
    };

    // File media (from buffer)
    const media = {
      mimeType: fileObject.mimetype,
      body: Readable.from(fileObject.buffer)
    };

    // Upload file
    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink, webContentLink'
    });

    // Make file accessible (anyone with link can view)
    await drive.permissions.create({
      fileId: response.data.id,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    });

    // Get shareable link
    const file = await drive.files.get({
      fileId: response.data.id,
      fields: 'id, name, webViewLink, webContentLink'
    });

    return {
      fileId: file.data.id,
      fileName: file.data.name,
      webViewLink: file.data.webViewLink,
      webContentLink: file.data.webContentLink,
      uploadType
    };
  } catch (error) {
    console.error('Error uploading to Google Drive:', error);
    throw new Error(`Failed to upload to Google Drive: ${error.message}`);
  }
};

/**
 * Delete file from Google Drive
 * @param {string} fileId - Google Drive file ID
 * @returns {Promise<boolean>}
 */
export const deleteFromGoogleDrive = async (fileId) => {
  try {
    await drive.files.delete({
      fileId: fileId
    });
    return true;
  } catch (error) {
    console.error('Error deleting from Google Drive:', error);
    return false;
  }
};

/**
 * Extract file ID from Google Drive URL
 * @param {string} url - Google Drive URL
 * @returns {string|null} - File ID or null
 */
export const extractFileIdFromUrl = (url) => {
  if (!url) return null;
  
  // Match patterns:
  // https://drive.google.com/file/d/{FILE_ID}/view
  // https://drive.google.com/open?id={FILE_ID}
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
};

/**
 * Check if Google Drive is configured
 * @returns {boolean}
 */
export const isDriveConfigured = () => {
  return !!(CLIENT_ID && CLIENT_SECRET && REFRESH_TOKEN && DOCUMENTS_FOLDER_ID && PERMISSIONS_FOLDER_ID);
};

export default {
  uploadToGoogleDrive,
  deleteFromGoogleDrive,
  extractFileIdFromUrl,
  isDriveConfigured
};
