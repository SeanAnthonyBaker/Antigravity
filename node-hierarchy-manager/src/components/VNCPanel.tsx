import React from 'react';

interface VNCPanelProps {
    onClose?: () => void;
}

export const VNCPanel = React.memo<VNCPanelProps>(({ onClose }) => {
    // Construct VNC URL with auto-login parameters
    const vncUrl = `http://${import.meta.env.VITE_VNC_PUBLIC_IP || 'localhost'}:7900/?password=secret&autoconnect=true`;

    // Zoom state
    const [zoom, setZoom] = React.useState(1);

    const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.1, 3));
    const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.5));
    const handleResetZoom = () => setZoom(1);

    return (
        <div style={{
            backgroundColor: '#1E1E1E',
            color: '#fff',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
            height: '100%',
            width: '100%',
            overflow: 'hidden',
            border: '1px solid #333'
        }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.5rem 1rem',
                borderBottom: '1px solid #333',
                backgroundColor: '#252526'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.2rem' }}>🖥️</span>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Remote Desktop</h3>

                    {/* Zoom Controls */}
                    <div style={{ display: 'flex', gap: '0.3rem', marginLeft: '1.5rem' }}>
                        <button
                            onClick={handleZoomOut}
                            title="Zoom Out"
                            style={{ padding: '0.2rem 0.5rem', background: '#333', border: '1px solid #555', color: 'white', borderRadius: '4px', cursor: 'pointer' }}
                        >
                            -
                        </button>
                        <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', minWidth: '3.5rem', justifyContent: 'center' }}>
                            {Math.round(zoom * 100)}%
                        </span>
                        <button
                            onClick={handleZoomIn}
                            title="Zoom In"
                            style={{ padding: '0.2rem 0.5rem', background: '#333', border: '1px solid #555', color: 'white', borderRadius: '4px', cursor: 'pointer' }}
                        >
                            +
                        </button>
                        <button
                            onClick={handleResetZoom}
                            title="Reset Zoom"
                            style={{ padding: '0.2rem 0.5rem', background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '0.8rem' }}
                        >
                            Reset
                        </button>
                    </div>

                    {/* Open in New Window Button */}
                    <button
                        onClick={() => window.open(vncUrl, 'VNC_Window', 'width=1280,height=800')}
                        title="Open VNC in New Window"
                        style={{
                            padding: '0.3rem 0.8rem',
                            background: '#0078D4',
                            border: 'none',
                            color: 'white',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            marginLeft: '1rem',
                            fontWeight: 500
                        }}
                    >
                        🗖 Open in New Window
                    </button>
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#9ca3af',
                            fontSize: '1.5rem',
                            cursor: 'pointer',
                            padding: '0 0.5rem',
                            lineHeight: 1
                        }}
                        title="Close VNC View"
                    >
                        &times;
                    </button>
                )}
            </div>

            <div style={{
                flex: 1,
                position: 'relative',
                backgroundColor: '#000',
                overflow: 'auto', // Allow scrolling when zoomed in
                display: 'flex',
                justifyContent: 'center', // Center when zoomed out
                alignItems: 'flex-start'
            }}>
                <div style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    transform: `scale(${zoom})`,
                    transformOrigin: 'top center', // Scale from top center
                    transition: 'transform 0.2s ease-out'
                }}>
                    <iframe
                        src={vncUrl}
                        style={{
                            width: '100%',
                            height: '100%',
                            border: 'none',
                            display: 'block'
                        }}
                        title="VNC Session"
                        allowFullScreen
                    />
                </div>
            </div>
        </div>
    );
});
