import React, { useState, useCallback, useMemo } from 'react';
import { processImage } from './utils/imageProcessor';
import { UploadIcon, DownloadIcon, CheckCircleIcon, XCircleIcon, PhotoIcon } from './components/Icons';

type TargetFormat = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/jpg';

const formatFileSize = (kb?: number, precision: number = 2): string => {
    if (typeof kb !== 'number') return '';

    if (kb >= 1000) {
        const mb = kb / 1024;
        return `${mb.toFixed(2)} MB`;
    }
    
    return `${kb.toFixed(precision)} KB`;
}

const App: React.FC = () => {
    const [originalFile, setOriginalFile] = useState<File | null>(null);
    const [targetSizeKB, setTargetSizeKB] = useState<number>(100);
    const [targetFormat, setTargetFormat] = useState<TargetFormat>('image/jpeg');
    const [processedImage, setProcessedImage] = useState<{ url: string; size: number } | null>(null);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const originalPreviewUrl = useMemo(() => {
        if (originalFile) {
            return URL.createObjectURL(originalFile);
        }
        return null;
    }, [originalFile]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                setError('Please upload a valid image file.');
                return;
            }
            setOriginalFile(file);
            setProcessedImage(null);
            setError(null);
        }
    };
    
    const handleProcessImage = useCallback(async () => {
        if (!originalFile) {
            setError('Please upload an image first.');
            return;
        }

        setIsProcessing(true);
        setError(null);
        setProcessedImage(null);

        try {
            const processingFormat = targetFormat === 'image/jpg' ? 'image/jpeg' : targetFormat;
            const { blob, finalSizeKB } = await processImage(originalFile, targetSizeKB, processingFormat);
            const url = URL.createObjectURL(blob);
            setProcessedImage({ url, size: finalSizeKB });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred during processing.');
            setProcessedImage(null);
        } finally {
            setIsProcessing(false);
        }
    }, [originalFile, targetSizeKB, targetFormat]);
    
    const getFileExtension = (mimeType: TargetFormat) => {
        if (mimeType === 'image/jpg') {
            return 'jpg';
        }
        return mimeType.split('/')[1];
    }

    const handleDownload = () => {
        if (!processedImage || !originalFile) return;

        const link = document.createElement('a');
        link.href = processedImage.url;
        const originalName = originalFile.name.substring(0, originalFile.name.lastIndexOf('.'));
        link.download = `${originalName}_resized.${getFileExtension(targetFormat)}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
            <div className="w-full max-w-4xl mx-auto">
                <header className="text-center mb-8">
                    <h1 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white">Online Image Resizer</h1>
                    <p className="text-lg text-slate-600 dark:text-slate-400 mt-2">Resize and reformat your images to the perfect size, right in your browser.</p>
                </header>
                
                <main className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6 md:p-8">
                    {!originalFile ? (
                        <ImageUploader onFileChange={handleFileChange} />
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                           <ImagePreviewPanel title="Original Image" src={originalPreviewUrl} size={originalFile.size / 1024} />
                           <div className="flex flex-col space-y-6">
                                <ImagePreviewPanel title="Processed Image" src={processedImage?.url} size={processedImage?.size} isLoading={isProcessing} />
                               <ControlsPanel
                                   targetSizeKB={targetSizeKB}
                                   setTargetSizeKB={setTargetSizeKB}
                                   targetFormat={targetFormat}
                                   setTargetFormat={setTargetFormat}
                                   onProcess={handleProcessImage}
                                   isProcessing={isProcessing}
                                   isProcessed={!!processedImage}
                                   onDownload={handleDownload}
                                   onFileChange={handleFileChange}
                               />
                           </div>
                        </div>
                    )}
                    {error && (
                        <div className="mt-6 p-4 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg flex items-center gap-3">
                            <XCircleIcon className="h-5 w-5" />
                            <span>{error}</span>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

interface ImageUploaderProps {
    onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ onFileChange }) => (
    <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-center">
        <UploadIcon className="h-16 w-16 text-slate-400 dark:text-slate-500 mb-4" />
        <h3 className="text-xl font-semibold mb-2 text-slate-800 dark:text-slate-200">Drag & Drop or Click to Upload</h3>
        <p className="text-slate-500 dark:text-slate-400 mb-6">Supports JPEG, PNG, WEBP files.</p>
        <label htmlFor="file-upload" className="cursor-pointer bg-indigo-600 text-white font-semibold py-2 px-6 rounded-lg hover:bg-indigo-700 transition-colors">
            Select Image
        </label>
        <input id="file-upload" type="file" className="hidden" accept="image/*" onChange={onFileChange} />
    </div>
);

interface ImagePreviewPanelProps {
    title: string;
    src: string | null;
    size?: number;
    isLoading?: boolean;
}

const ImagePreviewPanel: React.FC<ImagePreviewPanelProps> = ({ title, src, size, isLoading = false }) => (
    <div className="bg-slate-100 dark:bg-slate-900/50 p-4 rounded-lg flex-1 flex flex-col">
        <h3 className="text-lg font-semibold mb-3 text-slate-800 dark:text-slate-200">{title}</h3>
        <div className="relative w-full aspect-square bg-slate-200 dark:bg-slate-700 rounded-md flex items-center justify-center overflow-hidden">
            {isLoading && (
                <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center z-10">
                     <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
                     <p className="text-white mt-3">Processing...</p>
                </div>
            )}
            {src ? (
                <img src={src} alt={title} className="w-full h-full object-contain" />
            ) : (
                !isLoading && <PhotoIcon className="h-20 w-20 text-slate-400 dark:text-slate-500" />
            )}
        </div>
        {size !== undefined && (
            <p className="text-sm text-center mt-3 font-medium text-slate-600 dark:text-slate-400">
                File Size: <span className="text-indigo-600 dark:text-indigo-400">{formatFileSize(size, 2)}</span>
            </p>
        )}
    </div>
);


interface ControlsPanelProps {
    targetSizeKB: number;
    setTargetSizeKB: (value: number) => void;
    targetFormat: TargetFormat;
    setTargetFormat: (value: TargetFormat) => void;
    onProcess: () => void;
    isProcessing: boolean;
    isProcessed: boolean;
    onDownload: () => void;
    onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const ControlsPanel: React.FC<ControlsPanelProps> = ({
    targetSizeKB, setTargetSizeKB, targetFormat, setTargetFormat, onProcess, isProcessing, isProcessed, onDownload, onFileChange
}) => {
    return (
        <div className="flex flex-col space-y-6 justify-center">
            <div>
                <label htmlFor="size-slider" className="block text-md font-medium text-slate-700 dark:text-slate-300">
                    Target File Size: <span className="font-bold text-indigo-600 dark:text-indigo-400">{formatFileSize(targetSizeKB, 0)}</span>
                </label>
                <input
                    id="size-slider"
                    type="range"
                    min="20"
                    max="1024"
                    step="10"
                    value={targetSizeKB}
                    onChange={(e) => setTargetSizeKB(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer mt-2"
                />
            </div>

            <div>
                <label htmlFor="format-select" className="block text-md font-medium text-slate-700 dark:text-slate-300">
                    Output Format
                </label>
                <select
                    id="format-select"
                    value={targetFormat}
                    onChange={(e) => setTargetFormat(e.target.value as TargetFormat)}
                    className="mt-2 block w-full pl-3 pr-10 py-2 text-base border-slate-300 dark:border-slate-600 dark:bg-slate-700 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                >
                    <option value="image/jpg">JPG</option>
                    <option value="image/jpeg">JPEG</option>
                    <option value="image/png">PNG</option>
                    <option value="image/webp">WEBP</option>
                </select>
                 {targetFormat === 'image/png' && 
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">Note: PNG resizing is less precise and may not hit the exact target size.</p>
                }
            </div>

            <div className="pt-4 space-y-4">
                <button
                    onClick={onProcess}
                    disabled={isProcessing}
                    className="w-full flex items-center justify-center bg-indigo-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-indigo-400 disabled:cursor-not-allowed"
                >
                    {isProcessing ? 'Processing...' : 'Resize Image'}
                </button>

                {isProcessed && (
                    <button
                        onClick={onDownload}
                        className="w-full flex items-center justify-center gap-2 bg-emerald-500 text-white font-semibold py-3 px-6 rounded-lg hover:bg-emerald-600 transition-colors"
                    >
                        <DownloadIcon className="h-5 w-5" />
                        Download Processed Image
                    </button>
                )}
            </div>
            <div className="text-center">
                <label htmlFor="change-file" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 cursor-pointer font-medium text-sm">
                    Or change image
                </label>
                <input id="change-file" type="file" className="hidden" accept="image/*" onChange={onFileChange} />
            </div>
        </div>
    );
};

export default App;