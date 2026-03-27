import { useEffect, useRef } from 'react';
import { STATUS_CONFIG } from '../../lib/constants';
import { escapeHtml } from '../../lib/utils';
import type { Company, HeatmapMode } from './types';

declare const L: any;

interface Props {
  companies: Company[];
  selectedCompanyId: string | null;
  onSelectCompany: (id: string) => void;
  heatmapMode: HeatmapMode;
  onToggleMode: () => void;
}

const STATUS_WEIGHTS: Record<string, number> = {
  new: 1.0,
  contacted: 0.5,
  follow_up: 0.5,
  in_conversation: 0.5,
  partner: 0.1,
  rejected: 0.0,
  not_interested: 0.0,
};

function isOverdue(c: Company): boolean {
  if (!c.follow_up_date) return false;
  if (['partner', 'rejected', 'not_interested'].includes(c.status)) return false;
  return new Date(c.follow_up_date) <= new Date();
}

export default function HeatmapView({ companies, selectedCompanyId, onSelectCompany, heatmapMode, onToggleMode }: Props) {
  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<any>(null);
  const heatRef = useRef<any>(null);

  // Init map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [51.4545, -2.5979],
      zoom: 12,
      zoomControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap',
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

  // Update markers + heat layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove old layers
    if (markersRef.current) map.removeLayer(markersRef.current);
    if (heatRef.current) map.removeLayer(heatRef.current);

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

    const heatPoints: [number, number, number][] = [];
    const mappable = companies.filter((c) => c.lat != null && c.lng != null);

    for (const c of mappable) {
      const statusColor = STATUS_CONFIG[c.status]?.color || '#6b7280';
      const overdue = isOverdue(c);
      const selected = c.id === selectedCompanyId;

      const marker = L.circleMarker([c.lat, c.lng], {
        radius: selected ? 10 : 6,
        fillColor: statusColor,
        fillOpacity: 0.5,
        color: selected ? '#e8eaf4' : statusColor,
        weight: selected ? 3 : 1,
        className: overdue ? 'overdue-pulse' : '',
      });

      marker.bindTooltip(
        `<div style="font-family:'DM Sans',sans-serif;font-size:12px;"><strong>${escapeHtml(c.name)}</strong><br/><span style="color:${statusColor}">${escapeHtml(STATUS_CONFIG[c.status]?.label || c.status)}</span></div>`,
        { direction: 'top', offset: [0, -8] }
      );

      marker.on('click', () => onSelectCompany(c.id));
      cluster.addLayer(marker);

      // Heat point
      const weight = heatmapMode === 'density' ? 1.0 : (STATUS_WEIGHTS[c.status] ?? 0);
      if (weight > 0) {
        heatPoints.push([c.lat!, c.lng!, weight]);
      }
    }

    map.addLayer(cluster);
    markersRef.current = cluster;

    // Heat layer
    if (heatPoints.length > 0 && typeof L.heatLayer === 'function') {
      const heat = L.heatLayer(heatPoints, {
        radius: 25,
        blur: 15,
        maxZoom: 17,
        gradient: heatmapMode === 'activity'
          ? { 0.0: '#10b981', 0.3: '#f59e0b', 0.6: '#f97316', 1.0: '#ef4444' }
          : { 0.0: '#818cf840', 0.5: '#818cf880', 1.0: '#818cf8' },
      });
      heat.addTo(map);
      heatRef.current = heat;
    }
  }, [companies, selectedCompanyId, onSelectCompany, heatmapMode]);

  return (
    <div className="flex-1 relative">
      <div ref={mapContainerRef} className="absolute inset-0" />

      {/* Mode toggle */}
      <div className="absolute top-3 left-3 z-[1000] flex rounded-[6px] overflow-hidden" style={{ border: '1px solid #2a2d42' }}>
        <button
          onClick={() => heatmapMode !== 'density' && onToggleMode()}
          className="px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors"
          style={{
            backgroundColor: heatmapMode === 'density' ? '#818cf8' : '#1a1d2a',
            color: heatmapMode === 'density' ? '#fff' : '#8990b0',
          }}
        >
          Density
        </button>
        <button
          onClick={() => heatmapMode !== 'activity' && onToggleMode()}
          className="px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors"
          style={{
            backgroundColor: heatmapMode === 'activity' ? '#818cf8' : '#1a1d2a',
            color: heatmapMode === 'activity' ? '#fff' : '#8990b0',
          }}
        >
          Activity
        </button>
      </div>

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
