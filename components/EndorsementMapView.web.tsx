import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { ListEntry, PlaceListEntry, BusinessListEntry, BrandListEntry } from '@/types/library';

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

// Helper function to calculate zoom level based on entries spread
function calculateZoomLevel(entries: MapEntry[], userLocation?: { latitude: number; longitude: number } | null): number {
  if (entries.length === 0) return 12;

  let minLat = entries[0].location.lat;
  let maxLat = entries[0].location.lat;
  let minLng = entries[0].location.lng;
  let maxLng = entries[0].location.lng;

  entries.forEach(entry => {
    minLat = Math.min(minLat, entry.location.lat);
    maxLat = Math.max(maxLat, entry.location.lat);
    minLng = Math.min(minLng, entry.location.lng);
    maxLng = Math.max(maxLng, entry.location.lng);
  });

  if (userLocation) {
    minLat = Math.min(minLat, userLocation.latitude);
    maxLat = Math.max(maxLat, userLocation.latitude);
    minLng = Math.min(minLng, userLocation.longitude);
    maxLng = Math.max(maxLng, userLocation.longitude);
  }

  const latDiff = maxLat - minLat;
  const lngDiff = maxLng - minLng;
  const maxDiff = Math.max(latDiff, lngDiff);

  // Approximate zoom levels based on coordinate spread
  if (maxDiff < 0.01) return 15;
  if (maxDiff < 0.05) return 13;
  if (maxDiff < 0.1) return 12;
  if (maxDiff < 0.5) return 10;
  if (maxDiff < 1) return 9;
  if (maxDiff < 5) return 7;
  return 5;
}

// Calculate center point
function calculateCenter(entries: MapEntry[], userLocation?: { latitude: number; longitude: number } | null): { lat: number; lng: number } {
  if (entries.length === 0 && userLocation) {
    return { lat: userLocation.latitude, lng: userLocation.longitude };
  }

  if (entries.length === 0) {
    return { lat: 37.7749, lng: -122.4194 }; // Default to SF
  }

  let totalLat = 0;
  let totalLng = 0;
  let count = entries.length;

  entries.forEach(entry => {
    totalLat += entry.location.lat;
    totalLng += entry.location.lng;
  });

  if (userLocation) {
    totalLat += userLocation.latitude;
    totalLng += userLocation.longitude;
    count++;
  }

  return { lat: totalLat / count, lng: totalLng / count };
}

export default function EndorsementMapView({ entries, userLocation, onEntryPress, mapId = 'endorsement-map' }: Props) {
  const center = calculateCenter(entries, userLocation);
  const zoomLevel = calculateZoomLevel(entries, userLocation);

  useEffect(() => {
    // Load Leaflet CSS
    if (!document.querySelector('link[data-leaflet-css]')) {
      const link = document.createElement('link');
      link.setAttribute('rel', 'stylesheet');
      link.setAttribute('href', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
      link.setAttribute('data-leaflet-css', 'true');
      document.head.appendChild(link);
    }

    // Load Leaflet library
    if (!(window as any).L) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.onload = () => initializeMap();
      document.body.appendChild(script);
    } else {
      initializeMap();
    }

    function initializeMap() {
      const L = (window as any).L;
      if (!L) return;

      // Remove existing map if any
      const existingMap = document.getElementById(mapId);
      if (existingMap && (existingMap as any)._leaflet_id) {
        (existingMap as any)._leaflet_map?.remove();
      }

      // Initialize map
      const map = L.map(mapId).setView([center.lat, center.lng], zoomLevel);

      // Add tile layer with CartoDB Voyager (clean, readable style)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO',
        maxZoom: 19,
        subdomains: 'abcd',
      }).addTo(map);

      // Add user location marker (blue dot) if available
      if (userLocation) {
        L.marker([userLocation.latitude, userLocation.longitude], {
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

      // Add entry markers
      entries.forEach((entry, index) => {
        const color = '#00aaff'; // iEndorse blue for all markers
        const logoHtml = entry.logoUrl
          ? `<img src="${entry.logoUrl}" style="width: 40px; height: 40px; border-radius: 8px; object-fit: cover; margin-bottom: 8px;" onerror="this.style.display='none'" />`
          : '';

        L.marker([entry.location.lat, entry.location.lng], {
          icon: L.divIcon({
            className: 'endorsement-marker',
            html: `<svg width="24" height="32" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 20 12 20s12-11 12-20c0-6.63-5.37-12-12-12z" fill="${color}"/>
              <path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 20 12 20s12-11 12-20c0-6.63-5.37-12-12-12z" stroke="white" stroke-width="2"/>
              <circle cx="12" cy="12" r="5" fill="white"/>
              <text x="12" y="15" text-anchor="middle" fill="${color}" font-size="8" font-weight="bold">${index + 1}</text>
            </svg>`,
            iconSize: [24, 32],
            iconAnchor: [12, 32],
          }),
        })
          .addTo(map)
          .bindPopup(`
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
          `, {
            maxWidth: 280,
            className: 'endorsement-popup'
          });
      });

      // Fit bounds to show all markers
      if (entries.length > 0) {
        const allPoints = entries.map(e => [e.location.lat, e.location.lng]);
        if (userLocation) {
          allPoints.push([userLocation.latitude, userLocation.longitude]);
        }
        if (allPoints.length > 1) {
          map.fitBounds(allPoints, { padding: [50, 50] });
        }
      }

      // Store map reference
      (existingMap as any)._leaflet_map = map;
    }

    // Listen for navigation events
    const handleNavigate = (event: any) => {
      if (onEntryPress) {
        const [id, type] = event.detail.split('__');
        const entry = entries.find(e => e.id === id && e.type === type);
        if (entry) {
          onEntryPress(entry);
        }
      }
    };

    window.addEventListener('navigate-to-entry', handleNavigate);

    return () => {
      const existingMap = document.getElementById(mapId);
      if (existingMap && (existingMap as any)._leaflet_map) {
        (existingMap as any)._leaflet_map.remove();
      }
      window.removeEventListener('navigate-to-entry', handleNavigate);
    };
  }, [entries, userLocation, mapId, center.lat, center.lng, zoomLevel]);

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
