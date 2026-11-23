import multer from "multer";

// Configure multer for memory storage (images uploaded to Cloudinary)
export const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});
