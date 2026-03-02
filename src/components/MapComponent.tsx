import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, useMap, Polyline, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import Compass from './Compass';
import { Fingerprint, AlertTriangle, Trash2 } from 'lucide-react';

// Fix for default marker icons in Leaflet + Vite
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIconRetina from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
    iconUrl: markerIcon,
    iconRetinaUrl: markerIconRetina,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapComponentProps {
    center?: [number, number];
    zoom?: number;
}

const DEFAULT_CENTER: [number, number] = [16.5916, 120.8986];

function MapController({ center }: { center: [number, number] }) {
    const map = useMap();
    useEffect(() => {
        map.setView(center, map.getZoom());
    }, [center, map]);
    return null;
}

function MapEvents({ onMapClick, isDrawing }: { onMapClick: (e: L.LeafletMouseEvent) => void, isDrawing: boolean }) {
    useMapEvents({
        click: (e) => {
            if (isDrawing) onMapClick(e);
        }
    });
    return null;
}

export default function MapComponent({ center = DEFAULT_CENTER, zoom = 13 }: MapComponentProps) {
    const [drawnPath, setDrawnPath] = useState<[number, number][]>([]);
    const [isDrawing, setIsDrawing] = useState(false);
    const [isOffTrack, setIsOffTrack] = useState(false);
    const mapRef = useRef<L.Map>(null);

    // Off-track detection logic
    useEffect(() => {
        if (drawnPath.length > 0 && center) {
            // Find nearest point on the drawn path
            let minDistance = Infinity;
            const currentPoint = L.latLng(center[0], center[1]);

            drawnPath.forEach(p => {
                const dist = currentPoint.distanceTo(L.latLng(p[0], p[1]));
                if (dist < minDistance) minDistance = dist;
            });

            // If distance to nearest point > 50 meters, we are off track
            setIsOffTrack(minDistance > 50);
        } else {
            setIsOffTrack(false);
        }
    }, [center, drawnPath]);

    const handleMapClick = (e: L.LeafletMouseEvent) => {
        setDrawnPath([...drawnPath, [e.latlng.lat, e.latlng.lng]]);
    };

    return (
        <div style={{ height: '100%', width: '100%', position: 'relative' }}>
            <MapContainer
                center={center as any}
                zoom={zoom}
                zoomControl={false}
                scrollWheelZoom={true}
                style={{ height: '100%', width: '100%', background: '#0A0F0D' }}
                ref={mapRef as any}
            >
                <TileLayer
                    attribution='&copy; OpenStreetMap'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                // In a production environment with Capacitor, we would override 
                // the getTileUrl to use MapCacheService.getLocalTileUrl(z, x, y)
                />
                <MapController center={center} />
                <MapEvents onMapClick={handleMapClick} isDrawing={isDrawing} />

                {drawnPath.length > 0 && (
                    <Polyline positions={drawnPath} color="#00E676" weight={4} dashArray="10, 10" />
                )}

                {center && (
                    <Marker position={center as any} />
                )}
            </MapContainer>

            {/* Compass Overlay */}
            <div style={{ position: 'absolute', top: '1rem', left: '1rem', zIndex: 1000 }}>
                <Compass />
            </div>

            {/* Off-Track Alert */}
            {isOffTrack && (
                <div className="off-track-alert pulse" style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 2000,
                    background: 'rgba(255, 82, 82, 0.9)',
                    color: 'white',
                    padding: '1rem 2rem',
                    borderRadius: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    boxShadow: '0 0 30px rgba(255, 82, 82, 0.5)'
                }}>
                    <AlertTriangle size={32} />
                    <div>
                        <h4 style={{ margin: 0 }}>OFF TRACK!</h4>
                        <p style={{ margin: 0, fontSize: '0.8rem' }}>Return to the path immediately.</p>
                    </div>
                </div>
            )}

            {/* Drawing Controls */}
            <div className="drawing-controls glass" style={{
                position: 'absolute',
                bottom: '10px',
                right: '1rem',
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                padding: '0.5rem',
                borderRadius: '12px'
            }}>
                <button
                    onClick={() => setIsDrawing(!isDrawing)}
                    className={isDrawing ? 'primary' : ''}
                    title="Draw Path"
                >
                    <Fingerprint size={20} />
                </button>
                <button onClick={() => setDrawnPath([])} title="Clear Path">
                    <Trash2 size={20} />
                </button>
            </div>

            {/* Zoom Controls */}
            <div className="map-controls glass" style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                padding: '0.5rem',
                borderRadius: '12px'
            }}>
                <button onClick={() => (mapRef.current as any)?.zoomIn()} style={{ padding: '0.5rem', minWidth: '40px' }}>+</button>
                <button onClick={() => (mapRef.current as any)?.zoomOut()} style={{ padding: '0.5rem', minWidth: '40px' }}>-</button>
            </div>
        </div>
    );
}
