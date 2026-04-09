const { S3Client } = require('@aws-sdk/client-s3');
const multer = require('multer');
const multerS3 = require('multer-s3');
const path = require('path');

// Detect if using Supabase
const isSupabase = () => {
  return !!process.env.AWS_S3_ENDPOINT_URL;
};

const getS3Config = () => {
  if (isSupabase()) {
    return {
      region: process.env.AWS_S3_REGION_NAME || 'eu-west-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
      endpoint: process.env.AWS_S3_ENDPOINT_URL,
      forcePathStyle: true, // Required for Supabase S3-compatible API
    };
  } else if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_S3_BUCKET) {
    return {
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    };
  }
  return null;
};

const bucketName = process.env.AWS_S3_BUCKET || process.env.AWS_STORAGE_BUCKET_NAME || process.env.BUCKET_NAME || 'luxe-looks-bucket';
const cdnUrl = process.env.AWS_CDN_URL || null;

const isS3Configured = () => {
  return !!getS3Config() && !!bucketName;
};

let s3Client;
let upload;

if (isS3Configured()) {
  const s3Config = getS3Config();
  
  s3Client = new S3Client(s3Config);
  
  upload = multer({
    storage: multerS3({
      s3: s3Client,
      bucket: bucketName,
      acl: 'public-read',
      contentType: (req, file, cb) => {
        cb(null, file.mimetype);
      },
      metadata: (req, file, cb) => {
        cb(null, { fieldName: file.fieldname });
      },
      key: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const fileName = `${file.fieldname}-${uniqueSuffix}${ext}`;
        cb(null, fileName);
      },
    }),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
      const allowedTypes = /jpeg|jpg|png|gif|webp/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype);
      if (mimetype && extname) {
        return cb(null, true);
      }
      cb(new Error('Only image files are allowed'));
    },
  });
} else {
  // Fallback to local storage
  const fs = require('fs');
  const uploadsDir = './uploads';
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const localStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    },
  });

  upload = multer({
    storage: localStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowedTypes = /jpeg|jpg|png|gif|webp/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype);
      if (mimetype && extname) {
        return cb(null, true);
      }
      cb(new Error('Only image files are allowed'));
    },
  });
}

// Get the image path - handles both S3 and local
const getImagePath = (reqFile, existingImage = null) => {
  if (reqFile) {
    // New file uploaded
    if (isS3Configured()) {
      let imageUrl;
      
      // For Supabase, construct the public URL using the S3 key
      if (isSupabase() && reqFile.key) {
        const endpoint = process.env.AWS_S3_ENDPOINT_URL;
        const projectId = endpoint?.split('.')[0]?.replace('https://', '') || 'mhjxymdsjgtlikmjdiqk';
        imageUrl = `https://${projectId}.supabase.co/storage/v1/object/public/${bucketName}/${reqFile.key}`;
      } else if (reqFile.location) {
        imageUrl = reqFile.location;
      }
      
      return imageUrl;
    }
    return `/uploads/${reqFile.filename}`; // Local storage
  }
  return existingImage || null;
};

module.exports = {
  upload,
  isS3Configured,
  isSupabase,
  getImagePath,
  s3Client,
  cdnUrl,
};
