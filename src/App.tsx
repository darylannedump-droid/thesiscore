import { useState, useEffect } from 'react'
import { Map as MapIcon, Library, Settings as SettingsIcon, Zap, Activity } from 'lucide-react'
import MapComponent from './components/MapComponent'
import { trackingService } from './utils/tracking'
import { dbService } from './utils/database'
import './App.css'

type Tab = 'map' | 'routes' | 'stats' | 'settings';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('map');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isTracking, setIsTracking] = useState(false);
  const [distance, setDistance] = useState(0);
  const [currentPoint, setCurrentPoint] = useState<any>(null);

  useEffect(() => {
    // Initialize DB
    dbService.init();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    const handleTrackingUpdate = (e: any) => {
      setDistance(e.detail.totalDistance);
      setCurrentPoint(e.detail.point);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('trackingUpdate', handleTrackingUpdate);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('trackingUpdate', handleTrackingUpdate);
    };
  }, []);

  const toggleTracking = async () => {
    if (isTracking) {
      await trackingService.stopTracking();
    } else {
      await trackingService.startTracking(`Route ${new Date().toLocaleTimeString()}`);
    }
    setIsTracking(!isTracking);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'map':
        const mapCenter: [number, number] = currentPoint ? [currentPoint.lat, currentPoint.lng] : [16.5916, 120.8986];

        return (
          <div className="content-area">
            <MapComponent center={mapCenter} />

            <div className="status-overlay glass">
              <div className="tracking-dashboard">
                <div className="distance-display">
                  <span className="label">Total Distance</span>
                  <div className="value-group" style={{ display: 'flex', alignItems: 'baseline' }}>
                    <span className="value vibrant-green">{distance.toFixed(2)}</span>
                    <span className="unit">KM</span>
                  </div>
                </div>
                <div className="status-item" style={{ alignItems: 'flex-end' }}>
                  <span className="label">System Status</span>
                  <span className={isOnline ? 'value vibrant-green' : 'value'}>
                    {isOnline ? 'LIVE' : 'OFFLINE'}
                  </span>
                </div>
              </div>

              {isTracking && (
                <div className="secondary-stats">
                  <div className="status-item">
                    <span className="label">Speed</span>
                    <span className="value">{((currentPoint?.speed || 0) * 3.6).toFixed(1)} km/h</span>
                  </div>
                  <div className="status-item">
                    <span className="label">GPS Accuracy</span>
                    <span className="value">±{currentPoint?.accuracy?.toFixed(0) || 0}m</span>
                  </div>
                </div>
              )}
            </div>

            <div className="action-bar">
              <button
                className={isTracking ? 'tracking-btn stop' : 'primary tracking-btn'}
                onClick={toggleTracking}
              >
                {isTracking ? 'STOP TRACKING' : 'START TRACKING'}
              </button>
            </div>
          </div>
        );
      case 'routes':
        return (
          <div className="content-area scrollable">
            <div className="section-header">
              <h2>Saved Routes</h2>
              <div className="header-action"><Library size={20} /></div>
            </div>
            <div className="routes-list">
              <p className="empty-msg">No offline routes yet.</p>
            </div>
          </div>
        );
      case 'stats':
        return (
          <div className="content-area scrollable">
            <div className="section-header">
              <h2>Total Activity</h2>
              <div className="header-action"><Activity size={20} /></div>
            </div>
            <div className="stats-grid">
              <div className="stat-card glass">
                <span className="label">Total Distance</span>
                <span className="value vibrant-green">0.00 km</span>
              </div>
              <div className="stat-card glass">
                <span className="label">Activities</span>
                <span className="value">0</span>
              </div>
            </div>
          </div>
        );
      case 'settings':
        return (
          <div className="content-area scrollable">
            <div className="section-header">
              <h2>Settings</h2>
              <div className="header-action"><SettingsIcon size={20} /></div>
            </div>
            <div className="settings-list">
              <div className="settings-item glass">
                <span>Offline Maps Management</span>
                <button className="small-btn">Manage</button>
              </div>
              <div className="settings-item glass">
                <span>Unit System</span>
                <span>Metric (km)</span>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="app-container">
      <header className="app-header glass">
        <h1 className="brand-font vibrant-green">CAPSTONE</h1>
        <div className="battery-status">
          <Zap size={16} className="vibrant-green" />
          <span>98%</span>
        </div>
      </header>

      <main className="main-content">
        {renderContent()}
      </main>

      <nav className="bottom-nav glass">
        <button
          className={activeTab === 'map' ? 'nav-item active' : 'nav-item'}
          onClick={() => setActiveTab('map')}
        >
          <MapIcon size={24} />
          <span>Explore</span>
        </button>
        <button
          className={activeTab === 'routes' ? 'nav-item active' : 'nav-item'}
          onClick={() => setActiveTab('routes')}
        >
          <Library size={24} />
          <span>Routes</span>
        </button>
        <button
          className={activeTab === 'stats' ? 'nav-item active' : 'nav-item'}
          onClick={() => setActiveTab('stats')}
        >
          <Activity size={24} />
          <span>Stats</span>
        </button>
        <button
          className={activeTab === 'settings' ? 'nav-item active' : 'nav-item'}
          onClick={() => setActiveTab('settings')}
        >
          <SettingsIcon size={24} />
          <span>Menu</span>
        </button>
      </nav>
    </div>
  )
}

export default App
