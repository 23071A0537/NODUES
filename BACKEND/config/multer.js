import multer from 'multer';

/**
 * Multer configuration for file uploads
 * Files are stored in memory (buffer) before uploading to Google Drive
 */

// Memory storage - files stored as Buffer in memory
const storage = multer.memoryStorage();

// File filter - accept only specific file types
const fileFilter = (req, file, cb) => {
  // Allowed file types
  const allowedMimeTypes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.doc', '.docx'];

  // Check MIME type
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed. Accepted types: ${allowedExtensions.join(', ')}`), false);
  }
};

// Multer upload instance
export const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
  fileFilter: fileFilter
});

// Export single file upload middleware
export const uploadSingleFile = upload.single('document');

export default upload;
