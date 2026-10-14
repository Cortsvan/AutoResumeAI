import { uid } from './ids.js';

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_DIMENSION = 1600;
const QUALITY = 0.85;

/**
 * Validates and scales an image file/blob to a reasonable dimension and returns base64 data URL.
 */
export async function processScreenshotFile(file) {
  if (!file) throw new Error('No image file provided.');

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error('Unsupported image format. Please upload PNG, JPG, or WebP screenshots.');
  }

  if (file.size > 15 * 1024 * 1024) {
    throw new Error('Screenshot is too large (max 15MB).');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to parse image data.'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          if (width > height) {
            height = Math.round((height * MAX_DIMENSION) / width);
            width = MAX_DIMENSION;
          } else {
            width = Math.round((width * MAX_DIMENSION) / height);
            height = MAX_DIMENSION;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve({
            id: uid('img'),
            dataUrl: reader.result,
            name: file.name || 'screenshot.png',
            size: file.size,
            width: img.width,
            height: img.height,
          });
        }

        ctx.drawImage(img, 0, 0, width, height);
        const format = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const dataUrl = canvas.toDataURL(format, QUALITY);

        resolve({
          id: uid('img'),
          dataUrl,
          name: file.name || `screenshot_${Date.now().toString(36)}.png`,
          size: Math.round((dataUrl.length * 3) / 4),
          width,
          height,
        });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Extracts image files from clipboard paste event.
 */
export function extractImagesFromClipboard(clipboardData) {
  if (!clipboardData || !clipboardData.items) return [];
  const images = [];
  for (let i = 0; i < clipboardData.items.length; i++) {
    const item = clipboardData.items[i];
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) {
        images.push(file);
      }
    }
  }
  return images;
}
