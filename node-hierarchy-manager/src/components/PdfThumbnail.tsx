import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// @ts-ignore
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.js?url';

// Set worker source to local Vite bundled worker or fallback to CDN
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker || `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// In-memory cache for rendered PDF thumbnails so they only render once
const pdfThumbCache = new Map<string, string>();

interface PdfThumbnailProps {
    url: string;
    className?: string;
    fallbackIcon?: React.ReactNode;
}

export const PdfThumbnail: React.FC<PdfThumbnailProps> = ({
    url,
    className = 'child-thumb-img',
    fallbackIcon
}) => {
    const [thumbUrl, setThumbUrl] = useState<string | null>(() => pdfThumbCache.get(url) || null);
    const [loading, setLoading] = useState<boolean>(!pdfThumbCache.has(url));
    const [hasError, setHasError] = useState<boolean>(false);
    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;

        if (!url) {
            setHasError(true);
            setLoading(false);
            return;
        }

        if (pdfThumbCache.has(url)) {
            setThumbUrl(pdfThumbCache.get(url)!);
            setLoading(false);
            return;
        }

        let cancelled = false;
        let loadingTask: any = null;
        let renderTask: any = null;

        const renderFirstPage = async () => {
            try {
                setLoading(true);
                setHasError(false);

                loadingTask = pdfjsLib.getDocument({
                    url,
                    withCredentials: false,
                    cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/cmaps/`,
                    cMapPacked: true
                });

                const pdf = await loadingTask.promise;
                if (cancelled) return;

                const page = await pdf.getPage(1);
                if (cancelled) return;

                // Scale for ultra high-res crisp thumbnail (approx 720px width for 2x retina sharpness)
                const unscaledViewport = page.getViewport({ scale: 1.0 });
                const targetWidth = 720;
                const scale = (targetWidth / unscaledViewport.width) || 1.0;
                const viewport = page.getViewport({ scale });

                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.width = Math.max(1, Math.floor(viewport.width));
                canvas.height = Math.max(1, Math.floor(viewport.height));

                if (!context) {
                    throw new Error('Canvas 2D context not available');
                }

                renderTask = page.render({
                    canvasContext: context,
                    viewport
                });

                await renderTask.promise;
                if (cancelled) return;

                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                pdfThumbCache.set(url, dataUrl);

                if (isMounted.current) {
                    setThumbUrl(dataUrl);
                    setLoading(false);
                }
            } catch (err) {
                console.warn('[PdfThumbnail] Could not render first page of PDF:', url, err);
                if (isMounted.current && !cancelled) {
                    setHasError(true);
                    setLoading(false);
                }
            }
        };

        renderFirstPage();

        return () => {
            cancelled = true;
            isMounted.current = false;
            if (renderTask && typeof renderTask.cancel === 'function') {
                try { renderTask.cancel(); } catch {}
            }
            if (loadingTask && typeof loadingTask.destroy === 'function') {
                try { loadingTask.destroy(); } catch {}
            }
        };
    }, [url]);

    if (thumbUrl && !hasError) {
        return (
            <img
                src={thumbUrl}
                alt="PDF First Page"
                className={className}
                loading="lazy"
                onError={() => setHasError(true)}
            />
        );
    }

    if (loading) {
        if (fallbackIcon) {
            return (
                <div style={{ opacity: 0.65, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                    {fallbackIcon}
                </div>
            );
        }
        return (
            <div className="thumb-icon-wrapper" style={{ opacity: 0.7 }}>
                <span className="thumb-icon">📄</span>
                <span className="thumb-mini-label" style={{ fontSize: '0.6rem' }}>Rendering...</span>
            </div>
        );
    }

    // Fallback if CORS or rendering error occurs
    return (
        fallbackIcon ? (
            <>{fallbackIcon}</>
        ) : (
            <div className="thumb-icon-wrapper">
                <span className="thumb-icon">📄</span>
                <span className="thumb-mini-label">PDF</span>
            </div>
        )
    );
};
