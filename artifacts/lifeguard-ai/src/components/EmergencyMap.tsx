import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix leaflet's default icon path issue with bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface EmergencyMapProps {
  latitude: number;
  longitude: number;
  /** Height of the map container (default: 180px) */
  height?: number | string;
  /** Zoom level (default: 15) */
  zoom?: number;
  /** Show a pulsing ring around the pin */
  pulse?: boolean;
}

export default function EmergencyMap({
  latitude,
  longitude,
  height = 180,
  zoom = 15,
  pulse = true,
}: EmergencyMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const pulseRef = useRef<L.CircleMarker | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialise map only once
    if (!mapRef.current) {
      mapRef.current = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        touchZoom: false,
      }).setView([latitude, longitude], zoom);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(mapRef.current);

      // Pulsing circle marker beneath the pin
      if (pulse) {
        pulseRef.current = L.circleMarker([latitude, longitude], {
          radius: 18,
          color: '#ef4444',
          fillColor: '#ef4444',
          fillOpacity: 0.15,
          weight: 2,
          opacity: 0.6,
          className: 'emergency-pulse-ring',
        }).addTo(mapRef.current);
      }

      // Standard pin
      markerRef.current = L.marker([latitude, longitude]).addTo(mapRef.current);
    } else {
      // Update position if coords changed
      const latlng: L.LatLngExpression = [latitude, longitude];
      mapRef.current.setView(latlng, zoom);
      markerRef.current?.setLatLng(latlng);
      pulseRef.current?.setLatLng(latlng);
    }

    return () => {
      // Only remove on component unmount (not on every re-render)
    };
  }, [latitude, longitude, zoom, pulse]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ height, width: '100%' }}
      className="rounded-xl overflow-hidden ring-1 ring-white/10"
    />
  );
}
