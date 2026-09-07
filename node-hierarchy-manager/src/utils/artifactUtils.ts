export const getDomain = (urlStr: string): string => {
    try {
        const u = new URL(urlStr);
        return u.hostname.replace(/^www\./, '');
    } catch {
        return '';
    }
};

export const getYouTubeVideoId = (url: string): string | null => {
    try {
        const parsed = new URL(url);
        if (parsed.hostname.includes('youtube.com')) {
            return parsed.searchParams.get('v');
        }
        if (parsed.hostname === 'youtu.be') {
            return parsed.pathname.replace(/^\//, '').split('/')[0] || null;
        }
    } catch {
        // Fallback regex if URL parsing fails
        const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
        if (match) return match[1];
    }
    return null;
};

export const isImageUrl = (url?: string | null, urltype?: string | null): boolean => {
    if (!url) return false;
    const type = (urltype || '').toLowerCase();
    if (type === 'image' || type === 'png' || type === 'infographic') return true;
    const cleanUrl = url.split('?')[0].toLowerCase();
    return /\.(png|jpe?g|webp|gif|svg|bmp)$/i.test(cleanUrl) || url.startsWith('data:image/');
};

export interface ArtifactThumbnailInfo {
    kind: 'quiz' | 'image' | 'video' | 'audio' | 'pdf' | 'powerpoint' | 'word' | 'excel' | 'markdown' | 'link';
    icon: string;
    label: string;
    imageUrl: string | null;
    isVideoFile: boolean;
    domain: string;
}

export const getArtifactThumbnail = (url?: string | null, urltype?: string | null): ArtifactThumbnailInfo | null => {
    if (!url && !urltype) return null;

    const type = (urltype || '').toLowerCase();
    const cleanUrl = (url || '').split('?')[0].toLowerCase();
    const domain = url ? getDomain(url) : '';

    // Quiz
    if (type === 'quiz') {
        return {
            kind: 'quiz',
            icon: '🎯',
            label: 'Quiz',
            imageUrl: null,
            isVideoFile: false,
            domain
        };
    }

    // Direct Image or Infographic
    if (isImageUrl(url, urltype)) {
        return {
            kind: 'image',
            icon: '🖼️',
            label: 'Image',
            imageUrl: url && !url.includes('example.com') ? url : null,
            isVideoFile: false,
            domain
        };
    }

    // Video
    const ytId = url ? getYouTubeVideoId(url) : null;
    const isVideoExt = /\.(mp4|webm|mov|mkv)$/i.test(cleanUrl);
    if (type === 'video' || isVideoExt || ytId) {
        return {
            kind: 'video',
            icon: '🎬',
            label: 'Video',
            imageUrl: ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : null,
            isVideoFile: isVideoExt,
            domain
        };
    }

    // Audio
    if (type === 'audio' || /\.(mp3|wav|ogg|m4a|aac)$/i.test(cleanUrl)) {
        return {
            kind: 'audio',
            icon: '🎙️',
            label: 'Audio',
            imageUrl: null,
            isVideoFile: false,
            domain
        };
    }

    // PDF / Specification
    if (type === 'pdf' || type === 'specification' || /\.pdf$/i.test(cleanUrl)) {
        return {
            kind: 'pdf',
            icon: '📄',
            label: 'PDF',
            imageUrl: null,
            isVideoFile: false,
            domain
        };
    }

    // PowerPoint
    if (url && (url.includes(':p:') || /\.pptx?$/i.test(cleanUrl))) {
        return {
            kind: 'powerpoint',
            icon: '📊',
            label: 'Slides',
            imageUrl: null,
            isVideoFile: false,
            domain
        };
    }

    // Word
    if (url && (url.includes(':w:') || /\.docx?$/i.test(cleanUrl))) {
        return {
            kind: 'word',
            icon: '📝',
            label: 'Doc',
            imageUrl: null,
            isVideoFile: false,
            domain
        };
    }

    // Excel
    if (url && (url.includes(':x:') || /\.xlsx?$/i.test(cleanUrl))) {
        return {
            kind: 'excel',
            icon: '📈',
            label: 'Sheet',
            imageUrl: null,
            isVideoFile: false,
            domain
        };
    }

    // Markdown
    if (type === 'markdown' || /\.md$/i.test(cleanUrl)) {
        return {
            kind: 'markdown',
            icon: '📑',
            label: 'Markdown',
            imageUrl: null,
            isVideoFile: false,
            domain
        };
    }

    // Generic URL
    if (url) {
        return {
            kind: 'link',
            icon: '🔗',
            label: 'Link',
            imageUrl: null,
            isVideoFile: false,
            domain
        };
    }

    return null;
};
