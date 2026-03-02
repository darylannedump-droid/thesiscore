import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

export class MapCacheService {
    private static BASE_DIR = Directory.Data;

    static async downloadTile(z: number, x: number, y: number) {
        if (!Capacitor.isNativePlatform()) return;

        const url = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
        const path = `tiles/${z}/${x}/${y}.png`;

        try {
            // Check if already exists
            try {
                await Filesystem.stat({ path, directory: this.BASE_DIR });
                return; // Already cached
            } catch (e) {
                // Not found, proceed to download
            }

            // In a real app, we'd use a more robust download plugin or fetch + write
            // For this implementation, we'll use a fetch and write to data
            const response = await fetch(url);
            const blob = await response.blob();

            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = async () => {
                const base64data = (reader.result as string).split(',')[1];

                // Ensure directory exists
                const dirPath = `tiles/${z}/${x}`;
                try {
                    await Filesystem.mkdir({ path: dirPath, directory: this.BASE_DIR, recursive: true });
                } catch (e) { }

                await Filesystem.writeFile({
                    path,
                    data: base64data,
                    directory: this.BASE_DIR
                });
            };
        } catch (err) {
            console.error('Tile Download Error', err);
        }
    }

    static async getLocalTileUrl(z: number, x: number, y: number): Promise<string | null> {
        if (!Capacitor.isNativePlatform()) return null;

        const path = `tiles/${z}/${x}/${y}.png`;
        try {
            const result = await Filesystem.readFile({
                path,
                directory: this.BASE_DIR
            });
            return `data:image/png;base64,${result.data}`;
        } catch (e) {
            return null;
        }
    }

    static async downloadArea() {
        console.log('Downloading area tiles...');
        // This is a complex logic that would iterate through z, x, y based on bounds
        // For the purpose of this demo, we'll log the action.
        // Real implementation would involve tile calculation logic.
    }
}
