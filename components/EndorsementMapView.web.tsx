import React, { useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { ListEntry } from '@/types/library';

export interface MapEntry {
  id: string;
  name: string;
  category?: string;
  address?: string;
  logoUrl?: string;
  location: {
    lat: number;
    lng: number;
  };
  type: 'place' | 'business' | 'brand';
  originalEntry: ListEntry;
}

type Props = {
  entries: MapEntry[];
  userLocation?: { latitude: number; longitude: number } | null;
  onEntryPress?: (entry: MapEntry) => void;
  mapId?: string; // Unique ID for the map container
};

export default function EndorsementMapView({ entries, userLocation, onEntryPress, mapId = 'endorsement-map' }: Props) {
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const userMarkerRef = useRef<any>(null);
  const isInitializedRef = useRef(false);
  const fitBoundsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const entriesRef = useRef(entries);

  // Keep entriesRef updated for event handlers
  entriesRef.current = entries;

  // Load Leaflet CSS once
  useEffect(() => {
    if (!document.querySelector('link[data-leaflet-css]')) {
      const link = document.createElement('link');
      link.setAttribute('rel', 'stylesheet');
      link.setAttribute('href', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
      link.setAttribute('data-leaflet-css', 'true');
      document.head.appendChild(link);
    }
  }, []);

  // Create marker HTML
  const createMarkerIcon = useCallback((L: any, index: number) => {
    const color = '#00aaff';
    return L.divIcon({
      className: 'endorsement-marker',
      html: `<svg width="24" height="32" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 20 12 20s12-11 12-20c0-6.63-5.37-12-12-12z" fill="${color}"/>
        <path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 20 12 20s12-11 12-20c0-6.63-5.37-12-12-12z" stroke="white" stroke-width="2"/>
        <circle cx="12" cy="12" r="5" fill="white"/>
        <text x="12" y="15" text-anchor="middle" fill="${color}" font-size="8" font-weight="bold">${index + 1}</text>
      </svg>`,
      iconSize: [24, 32],
      iconAnchor: [12, 32],
    });
  }, []);

  // Create popup content
  const createPopupContent = useCallback((entry: MapEntry) => {
    const logoHtml = entry.logoUrl
      ? `<img src="${entry.logoUrl}" style="width: 40px; height: 40px; border-radius: 8px; object-fit: cover; margin-bottom: 8px;" onerror="this.style.display='none'" />`
      : '';

    return `
      <div style="min-width: 200px; padding: 12px;">
        ${logoHtml}
        <div style="font-size: 16px; font-weight: bold; margin-bottom: 4px; color: #1f2937;">
          ${entry.name}
        </div>
        ${entry.category ? `
          <div style="font-size: 12px; color: #00aaff; margin-bottom: 8px; text-transform: capitalize;">
            ${entry.category.replace(/_/g, ' ')}
          </div>
        ` : ''}
        ${entry.address ? `
          <div style="font-size: 12px; color: #6b7280; margin-bottom: 10px; line-height: 1.4;">
            📍 ${entry.address}
          </div>
        ` : ''}
        <button
          onclick="window.dispatchEvent(new CustomEvent('navigate-to-entry', { detail: '${entry.id}__${entry.type}' }))"
          style="
            width: 100%;
            background-color: #00aaff;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: background-color 0.2s;
          "
          onmouseover="this.style.backgroundColor='#0099ee'"
          onmouseout="this.style.backgroundColor='#00aaff'"
        >
          View Details
        </button>
      </div>
    `;
  }, []);

  // Debounced fit bounds
  const debouncedFitBounds = useCallback(() => {
    if (fitBoundsTimeoutRef.current) {
      clearTimeout(fitBoundsTimeoutRef.current);
    }

    fitBoundsTimeoutRef.current = setTimeout(() => {
      if (!mapRef.current || entriesRef.current.length === 0) return;

      const allPoints: [number, number][] = entriesRef.current.map(e => [e.location.lat, e.location.lng]);
      if (userLocation) {
        allPoints.push([userLocation.latitude, userLocation.longitude]);
      }

      if (allPoints.length > 1) {
        try {
          mapRef.current.fitBounds(allPoints, { padding: [50, 50], animate: false });
        } catch (error) {
          console.warn('[Map] fitBounds error:', error);
        }
      } else if (allPoints.length === 1) {
        try {
          mapRef.current.setView(allPoints[0], 14, { animate: false });
        } catch (error) {
          console.warn('[Map] setView error:', error);
        }
      }
    }, 300); // Wait 300ms after last entry change before fitting
  }, [userLocation]);

  // Initialize map
  useEffect(() => {
    const L = (window as any).L;

    const initializeMap = () => {
      const L = (window as any).L;
      if (!L || isInitializedRef.current) return;

      const container = document.getElementById(mapId);
      if (!container) return;

      // Default center (SF) if no entries
      const defaultCenter: [number, number] = entries.length > 0
        ? [entries[0].location.lat, entries[0].location.lng]
        : userLocation
          ? [userLocation.latitude, userLocation.longitude]
          : [37.7749, -122.4194];

      try {
        // Initialize map
        const map = L.map(mapId, {
          zoomControl: true,
          attributionControl: true,
        }).setView(defaultCenter, 12);

        // Add tile layer
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
          attribution: '© OpenStreetMap contributors © CARTO',
          maxZoom: 19,
          subdomains: 'abcd',
        }).addTo(map);

        mapRef.current = map;
        isInitializedRef.current = true;

        // Add user location marker if available
        if (userLocation) {
          userMarkerRef.current = L.marker([userLocation.latitude, userLocation.longitude], {
            icon: L.divIcon({
              className: 'user-marker',
              html: `<svg width="24" height="32" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 20 12 20s12-11 12-20c0-6.63-5.37-12-12-12z" fill="#3B82F6"/>
                <path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 20 12 20s12-11 12-20c0-6.63-5.37-12-12-12z" stroke="white" stroke-width="2"/>
                <circle cx="12" cy="12" r="4" fill="white"/>
              </svg>`,
              iconSize: [24, 32],
              iconAnchor: [12, 32],
            }),
          }).addTo(map).bindPopup('You are here');
        }
      } catch (error) {
        console.error('[Map] Initialization error:', error);
      }
    };

    // Load Leaflet if not available
    if (!L) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.onload = initializeMap;
      document.body.appendChild(script);
    } else {
      initializeMap();
    }

    // Cleanup
    return () => {
      if (fitBoundsTimeoutRef.current) {
        clearTimeout(fitBoundsTimeoutRef.current);
      }
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (error) {
          // Ignore cleanup errors
        }
        mapRef.current = null;
        isInitializedRef.current = false;
        markersRef.current.clear();
        userMarkerRef.current = null;
      }
    };
  }, [mapId]); // Only re-run if mapId changes

  // Update markers when entries change
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapRef.current || !isInitializedRef.current) return;

    const currentEntryIds = new Set(entries.map(e => `${e.id}__${e.type}`));
    const existingMarkerIds = new Set(markersRef.current.keys());

    // Remove markers that are no longer in entries
    existingMarkerIds.forEach(markerId => {
      if (!currentEntryIds.has(markerId)) {
        const marker = markersRef.current.get(markerId);
        if (marker) {
          try {
            marker.remove();
          } catch (error) {
            // Ignore removal errors
          }
          markersRef.current.delete(markerId);
        }
      }
    });

    // Add or update markers
    entries.forEach((entry, index) => {
      const markerId = `${entry.id}__${entry.type}`;

      if (!markersRef.current.has(markerId)) {
        // Add new marker
        try {
          const marker = L.marker([entry.location.lat, entry.location.lng], {
            icon: createMarkerIcon(L, index),
          })
            .addTo(mapRef.current)
            .bindPopup(createPopupContent(entry), {
              maxWidth: 280,
              className: 'endorsement-popup'
            });

          markersRef.current.set(markerId, marker);
        } catch (error) {
          console.warn('[Map] Error adding marker:', error);
        }
      } else {
        // Update existing marker's icon (for index number)
        const marker = markersRef.current.get(markerId);
        if (marker) {
          try {
            marker.setIcon(createMarkerIcon(L, index));
          } catch (error) {
            // Ignore icon update errors
          }
        }
      }
    });

    // Fit bounds after markers are updated (debounced)
    debouncedFitBounds();
  }, [entries, createMarkerIcon, createPopupContent, debouncedFitBounds]);

  // Handle navigation events
  useEffect(() => {
    const handleNavigate = (event: any) => {
      if (onEntryPress) {
        const [id, type] = event.detail.split('__');
        const entry = entriesRef.current.find(e => e.id === id && e.type === type);
        if (entry) {
          onEntryPress(entry);
        }
      }
    };

    window.addEventListener('navigate-to-entry', handleNavigate);
    return () => {
      window.removeEventListener('navigate-to-entry', handleNavigate);
    };
  }, [onEntryPress]);

  return (
    <View style={styles.container}>
      <div id={mapId} style={{ width: '100%', height: '100%' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});
