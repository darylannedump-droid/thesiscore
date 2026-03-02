import { useState, useEffect } from 'react';
import { Motion } from '@capacitor/motion';
import { Compass as CompassIcon } from 'lucide-react';

export default function Compass() {
    const [heading, setHeading] = useState(0);

    useEffect(() => {
        let watchId: any;

        const startCompass = async () => {
            try {
                watchId = await Motion.addListener('orientation', (event) => {
                    // Use alpha for heading (not perfect on all devices but a good start for offline)
                    if (event.alpha !== null) {
                        setHeading(Math.round(event.alpha));
                    }
                });
            } catch (err) {
                console.error('Compass not supported', err);
            }
        };

        startCompass();

        return () => {
            if (watchId) watchId.remove();
        };
    }, []);

    return (
        <div className="compass-container glass" style={{
            padding: '0.75rem',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative'
        }}>
            <div style={{
                transform: `rotate(${-heading}deg)`,
                transition: 'transform 0.1s linear'
            }}>
                <CompassIcon size={32} className="vibrant-green" />
            </div>
            <span style={{
                position: 'absolute',
                top: '-15px',
                fontSize: '0.6rem',
                fontWeight: 'bold',
                color: 'var(--text-secondary)'
            }}>N</span>
        </div>
    );
}
