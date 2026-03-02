import { Geolocation } from '@capacitor/geolocation';
import type { Position } from '@capacitor/geolocation';
import { dbService } from './database';

export interface RoutePoint {
    lat: number;
    lng: number;
    alt: number | null;
    timestamp: number;
    accuracy: number;
    speed: number | null;
}

export class TrackingService {
    private static instance: TrackingService;
    private watchId: string | null = null;
    private currentRouteId: string | null = null;
    private lastPosition: RoutePoint | null = null;
    private totalDistance: number = 0;
    private points: RoutePoint[] = [];

    // GPS quality controls (meters / seconds)
    private readonly initialFixAccuracyMeters = 15;
    private readonly maxAccuracyMeters = 25;
    private readonly minUpdateIntervalMs = 1500;
    private readonly stationaryNoiseMeters = 4;
    private readonly maxHikingSpeedMps = 8;
    private readonly smoothingAlpha = 0.3;

    private constructor() { }

    static getInstance() {
        if (!TrackingService.instance) {
            TrackingService.instance = new TrackingService();
        }
        return TrackingService.instance;
    }

    async startTracking(name: string = 'New Route') {
        this.currentRouteId = crypto.randomUUID();
        this.totalDistance = 0;
        this.points = [];
        this.lastPosition = null;

        // Save initial route record
        await dbService.saveRoute({
            id: this.currentRouteId,
            name,
            startTime: Date.now(),
            distance: 0
        });

        this.watchId = await Geolocation.watchPosition(
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
            (position, err) => {
                if (err) {
                    console.error('Tracking Error', err);
                    return;
                }
                if (position) {
                    this.handleNewPosition(position);
                }
            }
        );

        console.log('Started tracking route:', this.currentRouteId);
        return this.currentRouteId;
    }

    private async handleNewPosition(position: Position) {
        const rawPoint: RoutePoint = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            alt: position.coords.altitude,
            timestamp: position.timestamp,
            accuracy: position.coords.accuracy,
            speed: position.coords.speed
        };

        // Reject weak fixes (especially important for first lock)
        if (rawPoint.accuracy > this.maxAccuracyMeters) return;
        if (!this.lastPosition && rawPoint.accuracy > this.initialFixAccuracyMeters) return;

        // Avoid high-frequency jitter updates
        if (this.lastPosition && (rawPoint.timestamp - this.lastPosition.timestamp) < this.minUpdateIntervalMs) {
            return;
        }

        // Smooth coordinates against previous accepted point
        const newPoint = this.lastPosition
            ? this.smoothPoint(this.lastPosition, rawPoint)
            : rawPoint;

        if (this.lastPosition) {
            const dist = this.calculateDistance(
                this.lastPosition.lat, this.lastPosition.lng,
                newPoint.lat, newPoint.lng
            );

            const distanceMeters = dist * 1000;
            const timeDiff = (newPoint.timestamp - this.lastPosition.timestamp) / 1000;
            if (timeDiff <= 0) return;

            const inferredSpeedMps = distanceMeters / timeDiff;
            const sensorSpeedMps = newPoint.speed || 0;

            // Accept movement only if either GPS speed or geometric movement confirms it
            const movingBySensor = sensorSpeedMps > 0.7;
            const movingByDistance = distanceMeters > Math.max(this.stationaryNoiseMeters, newPoint.accuracy * 0.35);
            if (!movingBySensor && !movingByDistance) return;

            // Spike rejection for impossible hiking/running jumps
            if (inferredSpeedMps > this.maxHikingSpeedMps) return;

            this.totalDistance += dist;
        }

        this.lastPosition = newPoint;
        this.points.push(newPoint);

        // Save to DB
        if (this.currentRouteId) {
            await dbService.savePoint({
                routeId: this.currentRouteId,
                ...newPoint
            });

            // Update route distance in background
            await dbService.execute(
                'UPDATE routes SET distance = ? WHERE id = ?',
                [this.totalDistance, this.currentRouteId]
            );
        }

        // Dispatch event for UI updates
        window.dispatchEvent(new CustomEvent('trackingUpdate', {
            detail: {
                point: newPoint,
                totalDistance: this.totalDistance,
                routeId: this.currentRouteId
            }
        }));
    }

    private smoothPoint(previous: RoutePoint, current: RoutePoint): RoutePoint {
        const alpha = this.smoothingAlpha;
        return {
            ...current,
            lat: previous.lat + alpha * (current.lat - previous.lat),
            lng: previous.lng + alpha * (current.lng - previous.lng)
        };
    }

    private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    async stopTracking() {
        if (this.watchId) {
            await Geolocation.clearWatch({ id: this.watchId });
            this.watchId = null;
        }

        if (this.currentRouteId) {
            await dbService.execute(
                'UPDATE routes SET end_time = ?, distance = ? WHERE id = ?',
                [Date.now(), this.totalDistance, this.currentRouteId]
            );
            console.log('Stopped tracking route:', this.currentRouteId);
            this.currentRouteId = null;
        }
    }

    getStats() {
        return {
            distance: this.totalDistance,
            pointsCount: this.points.length,
            isActive: !!this.watchId
        };
    }
}

export const trackingService = TrackingService.getInstance();
