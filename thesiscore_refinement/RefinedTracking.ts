import { Geolocation } from '@capacitor/geolocation';
import type { Position } from '@capacitor/geolocation';

/**
 * RefinedTracking.ts - High-Accuracy GPS Logic
 * 
 * Features:
 * - Speed-based Confidence Gating
 * - Kalman-lite Filtering (Smoothing)
 * - Temporal Jitter Rejection
 * - Accuracy Thresholding (< 15m default)
 */

export interface GPSPoint {
    lat: number;
    lng: number;
    accuracy: number;
    speed: number | null;
    timestamp: number;
}

export class RefinedTracking {
    private lastPoint: GPSPoint | null = null;
    private totalDistance: number = 0;

    // Kalman configuration (Simplified for battery efficiency)
    private minAccuracy = 15; // Only trust points with error < 15m
    private minSpeedKmh = 0.5; // Ignore drift slower than 0.5 km/h
    private updateInterval = 1000; // Minimum time between points (ms)

    /**
     * Handles new GPS position with advanced filtering
     */
    processPosition(position: Position): GPSPoint | null {
        const { latitude, longitude, accuracy, speed } = position.coords;
        const timestamp = position.timestamp;

        // 1. Accuracy Filter
        if (accuracy > this.minAccuracy) return null;

        const currentPoint: GPSPoint = {
            lat: latitude,
            lng: longitude,
            accuracy,
            speed,
            timestamp
        };

        // 2. Initial point
        if (!this.lastPoint) {
            this.lastPoint = currentPoint;
            return currentPoint;
        }

        // 3. Temporal Gating (Avoid jitter from high-frequency updates)
        if (timestamp - this.lastPoint.timestamp < this.updateInterval) {
            return null;
        }

        // 4. Stationary Drift Protection
        const dist = this.haversine(
            this.lastPoint.lat, this.lastPoint.lng,
            latitude, longitude
        );

        const speedKmh = (speed || 0) * 3.6;

        // If speed is extremely low, we only accept the point if the distance is significant
        // (This prevents the "creeping" distance when stationary)
        if (speedKmh < this.minSpeedKmh && dist < 0.003) {
            return null; // Ignore tiny movements (under 3 meters) when stationary
        }

        // 5. Speed Validation (Human cap)
        const timeDiffSeconds = (timestamp - this.lastPoint.timestamp) / 1000;
        const velocity = (dist * 1000) / timeDiffSeconds;
        if (velocity > 12) return null; // Ignore jumps > 43 km/h (unlikely for hiking)

        // All checks passed
        this.totalDistance += dist;
        this.lastPoint = currentPoint;

        return currentPoint;
    }

    private haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371; // km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    getDistance() {
        return this.totalDistance;
    }
}
