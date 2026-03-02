import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';

// Define the schema
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS routes (
    id TEXT PRIMARY KEY,
    name TEXT,
    start_time INTEGER,
    end_time INTEGER,
    distance REAL,
    is_synced INTEGER DEFAULT 0
  );
  
  CREATE TABLE IF NOT EXISTS points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    route_id TEXT,
    lat REAL,
    lng REAL,
    alt REAL,
    timestamp INTEGER,
    accuracy REAL,
    speed REAL,
    FOREIGN KEY(route_id) REFERENCES routes(id)
  );
`;

class DatabaseService {
    private sqlite: SQLiteConnection | null = null;
    private db: SQLiteDBConnection | null = null;
    private isNative = Capacitor.isNativePlatform();

    async init() {
        if (!this.isNative) {
            console.log('Running in web mode - using Mock Database');
            return;
        }

        try {
            this.sqlite = new SQLiteConnection(CapacitorSQLite);
            this.db = await this.sqlite.createConnection('capstone_db', false, 'no-encryption', 1, false);
            await this.db.open();
            await this.db.execute(SCHEMA);
            console.log('Database initialized successfully');
        } catch (err) {
            console.error('Error initializing database', err);
        }
    }

    async execute(query: string, params: any[] = []) {
        if (!this.isNative) {
            // Mock execution for web - usually we'd use IndexedDB here but for rapid prototyping 
            // of the core logic, we'll just log and return a successful result.
            console.log('Mock Execute:', query, params);
            return { values: [] };
        }
        return await this.db?.run(query, params);
    }

    async query(query: string, params: any[] = []) {
        if (!this.isNative) {
            console.log('Mock Query:', query, params);
            return { values: [] };
        }
        return await this.db?.query(query, params);
    }

    // High-level methods
    async saveRoute(route: any) {
        const query = `INSERT INTO routes (id, name, start_time, distance) VALUES (?, ?, ?, ?)`;
        await this.execute(query, [route.id, route.name, route.startTime, route.distance]);
    }

    async savePoint(point: any) {
        const query = `INSERT INTO points (route_id, lat, lng, alt, timestamp, accuracy, speed) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        await this.execute(query, [
            point.routeId,
            point.lat,
            point.lng,
            point.alt || 0,
            point.timestamp,
            point.accuracy || 0,
            point.speed || 0
        ]);
    }

    async getRoutes() {
        return await this.query('SELECT * FROM routes ORDER BY start_time DESC');
    }
}

export const dbService = new DatabaseService();
