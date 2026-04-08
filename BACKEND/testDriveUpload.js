import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { isDriveConfigured, uploadToGoogleDrive } from './services/googleDriveService.js';

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from parent directory
dotenv.config({ path: join(__dirname, '..', '.env') });

async function testDriveUpload() {
  console.log('========================================');
  console.log('Google Drive Upload Test');
  console.log('========================================\n');

  // Debug: Check what environment variables are loaded
  console.log('🔍 Checking environment variables...\n');
  console.log('CLIENT_ID:', process.env.GOOGLE_DRIVE_CLIENT_ID ? `✓ Set (${process.env.GOOGLE_DRIVE_CLIENT_ID.substring(0, 20)}...)` : '❌ Missing');
  console.log('CLIENT_SECRET:', process.env.GOOGLE_DRIVE_CLIENT_SECRET ? `✓ Set (${process.env.GOOGLE_DRIVE_CLIENT_SECRET.substring(0, 10)}...)` : '❌ Missing');
  console.log('REFRESH_TOKEN:', process.env.GOOGLE_DRIVE_REFRESH_TOKEN ? `✓ Set (${process.env.GOOGLE_DRIVE_REFRESH_TOKEN.substring(0, 20)}...)` : '❌ Missing');
  console.log('DOCUMENTS_FOLDER_ID:', process.env.GOOGLE_DRIVE_DOCUMENTS_FOLDER_ID ? `✓ Set (${process.env.GOOGLE_DRIVE_DOCUMENTS_FOLDER_ID})` : '❌ Missing');
  console.log('PERMISSIONS_FOLDER_ID:', process.env.GOOGLE_DRIVE_PERMISSIONS_FOLDER_ID ? `✓ Set (${process.env.GOOGLE_DRIVE_PERMISSIONS_FOLDER_ID})` : '❌ Missing');
  console.log('');

  // Check if Drive is configured
  const configured = isDriveConfigured();
  console.log('✓ Drive configured:', configured);
  
  if (!configured) {
    console.error('\n❌ Drive not configured!');
    console.error('Please check your .env file has these variables:');
    console.error('- GOOGLE_DRIVE_CLIENT_ID');
    console.error('- GOOGLE_DRIVE_CLIENT_SECRET');
    console.error('- GOOGLE_DRIVE_REFRESH_TOKEN');
    console.error('- GOOGLE_DRIVE_DOCUMENTS_FOLDER_ID');
    console.error('- GOOGLE_DRIVE_PERMISSIONS_FOLDER_ID');
    return;
  }
  
  console.log('\n📤 Creating test file...');
  
  // Create a test buffer
  const testContent = `NoDues System - Test Upload
Generated: ${new Date().toISOString()}
This is a test file to verify Google Drive integration.

If you can see this file in your Drive folder, the integration is working correctly!
`;
  
  const testBuffer = Buffer.from(testContent, 'utf-8');
  const testFile = {
    buffer: testBuffer,
    originalname: 'test-upload.txt',
    mimetype: 'text/plain'
  };
  
  try {
    console.log('📤 Uploading to Google Drive...');
    const result = await uploadToGoogleDrive(testFile, 999, 'TEST001', 'documents');
    
    console.log('\n========================================');
    console.log('✓ Upload Successful!');
    console.log('========================================\n');
    console.log('File ID:', result.fileId);
    console.log('File Name:', result.fileName);
    console.log('View Link:', result.webViewLink);
    console.log('\n📁 Check your "Documents" folder in Google Drive!');
    console.log('The file should be named: 999_TEST001.txt\n');
  } catch (error) {
    console.error('\n========================================');
    console.error('❌ Upload Failed');
    console.error('========================================\n');
    console.error('Error:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Check all environment variables are correct');
    console.error('2. Verify Google Drive API is enabled');
    console.error('3. Ensure refresh token is valid (not expired)');
    console.error('4. Check folder IDs are correct');
    console.error('5. Make sure folder exists and is accessible\n');
  }
}

// Run the test
testDriveUpload();
