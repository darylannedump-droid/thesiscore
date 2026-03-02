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
        const newPoint: RoutePoint = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            alt: position.coords.altitude,
            timestamp: position.timestamp,
            accuracy: position.coords.accuracy,
            speed: position.coords.speed
        };

        // --- INTELLIGENT GPS FILTERING ---

        // 1. Extreme Accuracy Check
        // If the signal is very weak (> 20m error), we don't trust it for distance.
        if (newPoint.accuracy > 20) return;

        // 2. Stationary Drift Protection (Speed Gating)
        // If the hardware reports speed < 0.5 m/s (approx 1.8 km/h), 
        // it's likely noise or the user is standing still/fidgeting.
        const speedKmh = (newPoint.speed || 0) * 3.6;
        const isActuallyMoving = speedKmh > 0.8; // Ignore movements slower than walking pace

        // 3. Temporal Gating
        // Don't process updates faster than once per 2 seconds to avoid jitter "noise".
        if (this.lastPosition && (newPoint.timestamp - this.lastPosition.timestamp) < 2000) {
            return;
        }

        // 4. Moving Average / Jitter Reduction
        // We calculate distance based on a slightly "lazier" update to avoid zig-zagging.
        if (this.lastPosition) {
            const dist = this.calculateDistance(
                this.lastPosition.lat, this.lastPosition.lng,
                newPoint.lat, newPoint.lng
            );

            // If we are "stationary" (low speed), we only count distance if it's a significant jump
            // otherwise we assume it's just GPS sensors drifting around.
            if (!isActuallyMoving && dist < 0.005) return; // 5 meters threshold for non-moving updates

            // Final sanity check: Human speed limit (Walking/Running max)
            // If movement jump implies > 40 km/h (unless they are in a car, but this is a hiking app), it's a spike.
            const timeDiff = (newPoint.timestamp - this.lastPosition.timestamp) / 1000;
            const velocity = (dist * 1000) / timeDiff; // meters per second
            if (velocity > 12) return; // Ignore if > 43 km/h (Bolt speed)

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
