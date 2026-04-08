# Direct File Upload Implementation Summary

## What Was Implemented

The system has been upgraded from manual Google Drive link submission to **direct file uploads** with automatic Google Drive integration.

### Previous Workflow (Old)

1. Student uploads file to their own Google Drive
2. Student gets shareable link
3. Student pastes link in NoDues system
4. Operator clicks link to view document

### New Workflow (Current)

1. Student selects file from their device
2. System automatically uploads to designated Google Drive folder
3. File is automatically named: `{due_id}_{roll_number}.{extension}`
4. Operator reviews files directly in organized Drive folders

---

## Files Changed/Created

### Backend Changes

#### Created Files:

1. **`BACKEND/services/googleDriveService.js`** (175 lines)
   - Google Drive API integration service
   - Functions: `uploadToGoogleDrive()`, `deleteFromGoogleDrive()`, `isDriveConfigured()`
   - Handles OAuth2 authentication
   - Uploads files to designated folders
   - Sets appropriate file permissions

2. **`BACKEND/config/multer.js`**
   - File upload middleware configuration
   - Memory storage (files stored in buffer, not disk)
   - File type validation (PDF, JPG, PNG, WEBP, DOC, DOCX)
   - 10MB file size limit
   - Exports `uploadSingleFile` middleware

3. **`BACKEND/getRefreshToken.js`**
   - Helper script to generate Google Drive refresh token
   - Interactive CLI tool
   - Guides through OAuth2 authorization flow

4. **`BACKEND/testDriveUpload.js`**
   - Test script to verify Drive integration
   - Creates and uploads test file
   - Checks configuration validity

#### Modified Files:

1. **`BACKEND/controllers/studentController.js`**
   - Imported `googleDriveService`
   - Completely rewrote `uploadDocument` function
   - Now handles multipart form data instead of JSON
   - Accepts file from `req.file` (multer middleware)
   - Uploads to Google Drive with proper naming
   - Stores Drive link in database (`proof_drive_link`)
   - Deletes old files on resubmission

2. **`BACKEND/routes/studentRoutes.js`**
   - Imported `uploadSingleFile` middleware
   - Added middleware to upload route: `/dues/:dueId/upload-document`

3. **`BACKEND/.env.example`**
   - Added Google Drive configuration section
   - Documented required environment variables
   - Added setup instructions

### Frontend Changes

#### Modified Files:

1. **`FRONTEND/src/components/student/DueCard.tsx`**
   - Changed state: `documentLink` → `selectedFile`
   - Added `uploadProgress` state for user feedback
   - Updated `handleUploadDocument()` function:
     - Now creates `FormData` instead of JSON
     - Validates file type before upload
     - Validates file size (max 10MB)
     - Shows upload progress
     - Displays selected file info
   - Updated upload modal UI:
     - File input instead of text input
     - Shows file preview (name, size)
     - Shows upload progress
     - Updated help text explaining auto-upload
     - Shows filename format in warning

### Documentation

1. **`GOOGLE_DRIVE_SETUP.md`** (Comprehensive setup guide)
   - Step-by-step Google Cloud setup
   - OAuth2 credential creation
   - Refresh token generation
   - Folder setup instructions
   - Troubleshooting guide

---

## Environment Variables Required

Add these to your `BACKEND/.env` file:

```env
# Google Drive Configuration
GOOGLE_DRIVE_CLIENT_ID=your-client-id-from-google-cloud
GOOGLE_DRIVE_CLIENT_SECRET=your-client-secret-from-google-cloud
GOOGLE_DRIVE_REFRESH_TOKEN=your-refresh-token-from-script
GOOGLE_DRIVE_DOCUMENTS_FOLDER_ID=folder-id-for-student-documents
GOOGLE_DRIVE_PERMISSIONS_FOLDER_ID=folder-id-for-permission-grants
```

---

## How It Works

### Student Side (Frontend)

1. **Student goes to Dues page**
2. **Clicks "Upload Document" on a due card**
3. **Upload modal appears with:**
   - File input (accepts PDF, images, documents)
   - File size/type shown after selection
   - Upload progress indicator
   - Auto-upload notice with filename format

4. **Student selects file and clicks Submit**
5. **Frontend validates:**
   - File type allowed
   - File size under 10MB

6. **Creates FormData and sends to backend**
   - Field name: `document`
   - Content-Type: `multipart/form-data` (automatic)

### Backend Processing

1. **Request hits `/api/student/dues/:dueId/upload-document`**
2. **Multer middleware (`uploadSingleFile`):**
   - Intercepts file upload
   - Validates file type
   - Checks file size
   - Stores in memory buffer
   - Attaches to `req.file`

3. **Controller (`studentController.uploadDocument`):**
   - Checks if Drive is configured
   - Extracts student roll number from JWT
   - Gets due details from database
   - Calls `uploadToGoogleDrive()` with:
     - File buffer
     - Due ID
     - Roll number
     - Upload type ('documents' or 'permissions')

4. **Google Drive Service:**
   - Creates OAuth2 client
   - Generates filename: `{dueId}_{rollNumber}.{extension}`
   - Uploads to designated folder
   - Sets file permissions (anyone with link can view)
   - Returns file metadata

5. **Controller updates database:**
   - Stores Drive link in `student_dues.proof_drive_link`
   - Sets status to 'under_review'
   - If resubmission, deletes old Drive file

6. **Returns success response to frontend**

### Operator Side

1. **Operator accesses Google Drive folders:**
   - Documents folder: All student submissions
   - Permissions folder: Special permission requests

2. **Files are organized by naming:**
   - Format: `{due_id}_{roll_number}.{extension}`
   - Example: `15_21071A0501.pdf`
   - Easy to identify: Due #15, Student 21071A0501

3. **Operator reviews and acts in NoDues system:**
   - Approve: Grants permission via operator dashboard
   - Reject: Adds rejection reason (student can reupload)

---

## File Upload Specifications

### Allowed File Types

- **PDF**: `application/pdf`
- **Images**: `image/jpeg`, `image/jpg`, `image/png`, `image/webp`
- **Documents**: `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

### File Size Limit

- **Maximum**: 10 MB
- Enforced by multer middleware
- Frontend validates before upload

### File Naming Convention

```
{due_id}_{student_roll_number}.{extension}

Examples:
- 15_21071A0501.pdf
- 42_21071A0502.jpg
- 8_21071A0503.png
```

### Storage

- **Development**: Files stored in memory buffer (not saved to disk)
- **Upload Destination**: Google Drive folders
- **No local filesystem pollution**

---

## Setup Instructions

### 1. Install Dependencies

Already installed during implementation:

```bash
cd BACKEND
npm install googleapis multer
```

### 2. Configure Google Drive API

Follow the comprehensive guide in [`GOOGLE_DRIVE_SETUP.md`](./GOOGLE_DRIVE_SETUP.md)

### 3. Generate Refresh Token

```bash
cd BACKEND
node getRefreshToken.js
```

Follow the prompts to authorize and get your refresh token.

### 4. Create Drive Folders

1. Go to Google Drive
2. Create two folders:
   - "NoDues - Student Documents"
   - "NoDues - Permission Grants"
3. Copy the folder IDs from URLs

### 5. Update Environment Variables

Edit `BACKEND/.env`:

```env
GOOGLE_DRIVE_CLIENT_ID=<from-google-cloud>
GOOGLE_DRIVE_CLIENT_SECRET=<from-google-cloud>
GOOGLE_DRIVE_REFRESH_TOKEN=<from-script>
GOOGLE_DRIVE_DOCUMENTS_FOLDER_ID=<folder-id>
GOOGLE_DRIVE_PERMISSIONS_FOLDER_ID=<folder-id>
```

### 6. Test the Integration

```bash
cd BACKEND
node testDriveUpload.js
```

Check if test file appears in your Documents folder.

### 7. Restart the Backend

```bash
cd BACKEND
npm start
```

---

## Testing the Feature

### Manual Test Steps

1. **Start both servers:**

   ```bash
   # Terminal 1 - Backend
   cd BACKEND
   npm start

   # Terminal 2 - Frontend
   cd FRONTEND
   npm run dev
   ```

2. **Login as a student:**
   - Go to http://localhost:5173
   - Login with test student credentials

3. **Navigate to Dues page:**
   - Should see list of dues
   - Find a non-payable due (requires document)

4. **Test upload:**
   - Click "Upload Document" on a due card
   - Select a PDF or image file
   - Verify file info shows (name, size)
   - Click "Submit"
   - Should see "Uploading to Google Drive..." progress
   - Should get success message

5. **Verify in Google Drive:**
   - Open your Documents folder
   - Should see uploaded file with name: `{due_id}_{roll_number}.{extension}`

6. **Test resubmission:**
   - Upload another file for the same due
   - Old file should be automatically deleted
   - New file should appear

---

## Advantages Over Previous System

### For Students

✅ **Easier workflow** - No manual Drive upload needed  
✅ **Faster submission** - Single-click upload  
✅ **Instant validation** - File type/size checked immediately  
✅ **Progress feedback** - See upload status in real-time  
✅ **No link mistakes** - Can't paste wrong link

### For Operators

✅ **Organized storage** - All files in designated folders  
✅ **Easy identification** - Filename shows due ID and student  
✅ **Automatic cleanup** - Old files deleted on resubmission  
✅ **Better security** - Controlled folder access  
✅ **Audit trail** - All files in one place

### For System Administrators

✅ **Centralized storage** - All documents in institution's Drive  
✅ **Better control** - Manage folder permissions  
✅ **Scalable** - Google Drive handles storage  
✅ **Trackable** - Drive provides access logs  
✅ **Recoverable** - Drive has trash/version history

---

## Security Considerations

### File Validation

- ✓ File type whitelist (only safe formats)
- ✓ File size limit (prevent abuse)
- ✓ Memory storage (no disk writes)
- ✓ Extension validation

### Authentication

- ✓ JWT token required for upload
- ✓ Student can only upload for their own dues
- ✓ OAuth2 for Google Drive
- ✓ Refresh tokens (never expire access tokens)

### Drive Permissions

- ✓ Files uploaded to controlled folders
- ✓ Operators have review access
- ✓ Students can't delete/modify after upload
- ✓ Links are view-only by default

---

## Troubleshooting

### "Upload failed" error

**Possible causes:**

- Google Drive not configured
- Invalid credentials
- Folder ID incorrect
- API quota exceeded

**Solutions:**

- Run `testDriveUpload.js` to diagnose
- Check all environment variables
- Verify folder exists and is accessible

### "File too large" error

**Cause:** File exceeds 10MB limit  
**Solution:** Student should compress/resize file

### "Invalid file type" error

**Cause:** File type not in whitelist  
**Solution:** Convert to PDF or allowed image format

### Files not appearing in Drive

**Check:**

- Logged into correct Google account
- Folder IDs are correct
- Refresh token is valid
- API is enabled

---

## Next Steps

### Optional Enhancements

1. **Progress bar** - Show upload percentage
2. **File preview** - Show image preview before upload
3. **Drag & drop** - Allow drag-drop file upload
4. **Multiple files** - Upload multiple documents at once
5. **Operator dashboard** - Drive file viewer in system
6. **Compression** - Auto-compress large images

### Maintenance

- Monitor Drive storage quota
- Review uploaded files periodically
- Archive old files after academic year
- Rotate OAuth credentials if compromised

---

## Summary

✅ **Direct file upload implemented**  
✅ **Google Drive integration complete**  
✅ **Automatic file naming configured**  
✅ **Two-folder organization (documents/permissions)**  
✅ **Frontend updated with file input**  
✅ **Backend configured with multer + googleapis**  
✅ **Comprehensive documentation created**  
✅ **Test scripts provided**  
✅ **Security measures in place**

**Status:** Implementation complete, ready for Google Drive API configuration and testing!
