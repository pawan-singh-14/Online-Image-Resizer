
type TargetFormat = 'image/jpeg' | 'image/png' | 'image/webp';

/**
 * Loads an image file into an HTMLImageElement.
 * @param file The image file to load.
 * @returns A promise that resolves with the loaded HTMLImageElement.
 */
function loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = (err) => reject(err);
            img.src = event.target?.result as string;
        };
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
    });
}

/**
 * Gets a blob from a canvas with a specific format and quality.
 * @param canvas The canvas to get the blob from.
 * @param format The desired image format.
 * @param quality The image quality (for JPEG/WEBP).
 * @returns A promise that resolves with the image Blob.
 */
function getCanvasBlob(canvas: HTMLCanvasElement, format: TargetFormat, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('Canvas to Blob conversion failed.'));
                }
            },
            format,
            quality
        );
    });
}


/**
 * Processes an image file to resize it to a target file size and convert its format.
 * @param file The original image file.
 * @param targetSizeKB The desired file size in kilobytes.
 * @param targetFormat The desired output format ('image/jpeg', 'image/png', 'image/webp').
 * @returns A promise that resolves with the processed image blob and its final size.
 */
export async function processImage(
    file: File,
    targetSizeKB: number,
    targetFormat: TargetFormat
): Promise<{ blob: Blob; finalSizeKB: number }> {
    const targetSizeBytes = targetSizeKB * 1024;
    const img = await loadImage(file);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Could not get canvas context.');
    }

    // Start with original dimensions
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    
    // For PNG, resizing is primarily done by reducing dimensions, as it's lossless.
    // This is less precise for hitting a target file size.
    if (targetFormat === 'image/png') {
        let currentBlob = await getCanvasBlob(canvas, targetFormat, 1);
        let scale = 1.0;
        
        while (currentBlob.size > targetSizeBytes && scale > 0.1) {
            scale -= 0.05; // Reduce dimensions by 5% each iteration
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            currentBlob = await getCanvasBlob(canvas, targetFormat, 1);
        }
        return { blob: currentBlob, finalSizeKB: currentBlob.size / 1024 };
    }
    
    // For JPEG and WEBP, we can use a binary search on the quality parameter, which is much faster and more effective.
    let minQuality = 0;
    let maxQuality = 1;
    let bestBlob: Blob | null = null;

    // Perform a few iterations of binary search to find the optimal quality
    for (let i = 0; i < 10; i++) {
        const quality = (minQuality + maxQuality) / 2;
        const currentBlob = await getCanvasBlob(canvas, targetFormat, quality);

        if (currentBlob.size <= targetSizeBytes) {
            bestBlob = currentBlob; // This is a potential candidate
            minQuality = quality; // Try for better quality (larger file)
        } else {
            maxQuality = quality; // Need to reduce quality (smaller file)
        }
    }
    
    if (bestBlob) {
        return { blob: bestBlob, finalSizeKB: bestBlob.size / 1024 };
    }

    // If no suitable blob was found (e.g., even lowest quality is too big),
    // return the blob from the last attempt with the lowest quality.
    const fallbackBlob = await getCanvasBlob(canvas, targetFormat, minQuality);
    if (fallbackBlob.size > targetSizeBytes * 1.2) {
         throw new Error(`Could not resize image below ${targetSizeKB}KB. Try reducing dimensions or using a different format.`);
    }
    return { blob: fallbackBlob, finalSizeKB: fallbackBlob.size / 1024 };
}
