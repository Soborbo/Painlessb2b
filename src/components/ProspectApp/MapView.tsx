import { useEffect, useRef, useMemo } from 'react';
import { STATUS_CONFIG } from '../../lib/constants';
import { escapeHtml } from '../../lib/utils';
import type { Company } from './types';

// Leaflet types
declare const L: any;

interface Props {
  companies: Company[];
  selectedCompanyId: string | null;
  onSelectCompany: (id: string) => void;
}

function isOverdue(c: Company): boolean {
  if (!c.follow_up_date) return false;
  if (['partner', 'rejected', 'not_interested'].includes(c.status)) return false;
  return new Date(c.follow_up_date) <= new Date();
}

export default function MapView({ companies, selectedCompanyId, onSelectCompany }: Props) {
  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<any>(null);
  const markerMapRef = useRef<Map<string, any>>(new Map());

  // Init map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [51.4545, -2.5979],
      zoom: 12,
      zoomControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove old markers
    if (markersRef.current) {
      map.removeLayer(markersRef.current);
    }
    markerMapRef.current.clear();

    const cluster = L.markerClusterGroup({
      maxClusterRadius: 40,
      iconCreateFunction: (clusterObj: any) => {
        const count = clusterObj.getChildCount();
        return L.divIcon({
          html: `<div style="background:#1a1d2a;border:2px solid #818cf8;color:#e8eaf4;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:600;">${count}</div>`,
          className: '',
          iconSize: [36, 36],
        });
      },
    });

    const mappable = companies.filter((c) => c.lat != null && c.lng != null);

    for (const c of mappable) {
      const statusColor = STATUS_CONFIG[c.status]?.color || '#6b7280';
      const overdue = isOverdue(c);
      const selected = c.id === selectedCompanyId;

      const marker = L.circleMarker([c.lat, c.lng], {
        radius: selected ? 10 : 7,
        fillColor: statusColor,
        fillOpacity: 0.9,
        color: selected ? '#e8eaf4' : overdue ? '#f97316' : statusColor,
        weight: selected ? 3 : overdue ? 2 : 1.5,
        className: overdue ? 'overdue-pulse' : '',
      });

      marker.bindTooltip(
        `<div style="font-family:'DM Sans',sans-serif;font-size:12px;"><strong>${escapeHtml(c.name)}</strong><br/><span style="color:${statusColor}">${escapeHtml(STATUS_CONFIG[c.status]?.label || c.status)}</span></div>`,
        { direction: 'top', offset: [0, -8] }
      );

      marker.on('click', () => onSelectCompany(c.id));
      cluster.addLayer(marker);
      markerMapRef.current.set(c.id, marker);
    }

    map.addLayer(cluster);
    markersRef.current = cluster;
  }, [companies, selectedCompanyId, onSelectCompany]);

  // Center on selected
  useEffect(() => {
    if (!selectedCompanyId || !mapRef.current) return;
    const company = companies.find((c) => c.id === selectedCompanyId);
    if (company?.lat && company?.lng) {
      mapRef.current.setView([company.lat, company.lng], 14, { animate: true });
    }
  }, [selectedCompanyId, companies]);

  return (
    <div className="flex-1 relative">
      <div ref={mapContainerRef} className="absolute inset-0" />
      <style>{`
        .overdue-pulse {
          animation: pulse-ring 2s ease-out infinite;
        }
        @keyframes pulse-ring {
          0% { opacity: 1; }
          50% { opacity: 0.6; }
          100% { opacity: 1; }
        }
        .leaflet-control-zoom a {
          background-color: #1a1d2a !important;
          color: #e8eaf4 !important;
          border-color: #2a2d42 !important;
        }
        .leaflet-control-zoom a:hover {
          background-color: #2a2d42 !important;
        }
        .leaflet-tooltip {
          background-color: #13151e !important;
          border: 1px solid #2a2d42 !important;
          color: #e8eaf4 !important;
          border-radius: 6px !important;
          padding: 6px 10px !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.4) !important;
        }
        .leaflet-tooltip-top:before {
          border-top-color: #2a2d42 !important;
        }
      `}</style>
    </div>
  );
}
