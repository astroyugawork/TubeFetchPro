import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Cloudinary free plan caps video assets at 100 MB. Override via env var if paid plan.
const MAX_BYTES = Number(process.env.CLOUDINARY_MAX_BYTES) || 100 * 1024 * 1024;

const uploadLarge = (filePath: string, options: Record<string, any>): Promise<any> =>
  new Promise((resolve, reject) => {
    cloudinary.uploader.upload_large(
      filePath,
      { ...options, chunk_size: 20 * 1024 * 1024 },
      (err, result) => (err ? reject(err) : resolve(result))
    );
  });

const friendlyTooLarge = (bytes: number) => {
  const mb = (bytes / 1048576).toFixed(0);
  const capMb = (MAX_BYTES / 1048576).toFixed(0);
  return `File too large for online library (${mb} MB, cap ${capMb} MB). Pick a lower quality, or use the Download button to save directly to your device.`;
};

export const uploadToCloudinary = async (filePath: string, publicId: string, resourceType: 'video' | 'raw' | 'auto') => {
  const { size } = fs.statSync(filePath);

  if (size > MAX_BYTES) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    throw new Error(friendlyTooLarge(size));
  }

  try {
    const mappedResource = resourceType === 'raw' ? 'auto' : resourceType;
    const options = {
      public_id: publicId,
      resource_type: mappedResource,
      folder: 'tubefetchpro',
    };

    const LARGE_THRESHOLD = 90 * 1024 * 1024;
    const result = size > LARGE_THRESHOLD
      ? await uploadLarge(filePath, options)
      : await cloudinary.uploader.upload(filePath, options);

    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    return {
      url: result.secure_url,
      publicId: result.public_id,
      size: result.bytes,
    };
  } catch (error: any) {
    console.error(`[ERROR] Cloudinary upload failed: ${error.message}`);
    // If Cloudinary itself returned a size error, rewrite to the friendly message.
    if (/too large|max|413/i.test(error.message)) {
      throw new Error(friendlyTooLarge(size));
    }
    throw new Error(`Upload failed: ${error.message}`);
  }
};
