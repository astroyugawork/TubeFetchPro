import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});


const uploadLarge = (filePath: string, options: Record<string, any>): Promise<any> =>
  new Promise((resolve, reject) => {
    cloudinary.uploader.upload_large(
      filePath,
      { ...options, chunk_size: 20 * 1024 * 1024 }, // 20MB chunks
      (err, result) => (err ? reject(err) : resolve(result))
    );
  });

export const uploadToCloudinary = async (filePath: string, publicId: string, resourceType: 'video' | 'raw' | 'auto') => {
  try {
    const { size } = fs.statSync(filePath);
    const mappedResource = resourceType === 'raw' ? 'auto' : resourceType;
    const options = {
      public_id: publicId,
      resource_type: mappedResource,
      folder: 'tubefetchpro',
    };

    // Cloudinary's basic upload endpoint caps at 100MB. Use chunked upload above that.
    const LARGE_THRESHOLD = 90 * 1024 * 1024;
    const result = size > LARGE_THRESHOLD
      ? await uploadLarge(filePath, options)
      : await cloudinary.uploader.upload(filePath, options);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return {
      url: result.secure_url,
      publicId: result.public_id,
      size: result.bytes,
    };
  } catch (error: any) {
    console.error(`[ERROR] Cloudinary upload failed: ${error.message}`);
    throw new Error(`Cloudinary upload failed: ${error.message}`);
  }
};
