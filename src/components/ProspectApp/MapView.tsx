import { useEffect, useRef, useMemo } from 'react';
import { STATUS_CONFIG } from '../../lib/constants';
import { escapeHtml } from '../../lib/utils';
import { THEME, SITE_CONFIG } from '../../lib/site-config';
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
      center: SITE_CONFIG.map.center,
      zoom: SITE_CONFIG.map.zoom,
      zoomControl: false,
    });

    L.tileLayer(SITE_CONFIG.mapTileUrl, {
      attribution: SITE_CONFIG.mapTileAttribution,
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
          html: `<div style="background:${THEME.elevated};border:2px solid ${THEME.accent};color:${THEME.textPrimary};border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:600;">${count}</div>`,
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
        color: selected ? THEME.textPrimary : overdue ? '#f97316' : statusColor,
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
    <div className="flex-1 relative" style={{ zIndex: 0 }}>
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
          background-color: ${THEME.elevated} !important;
          color: ${THEME.textPrimary} !important;
          border-color: ${THEME.border} !important;
        }
        .leaflet-control-zoom a:hover {
          background-color: ${THEME.border} !important;
        }
        .leaflet-tooltip {
          background-color: ${THEME.surface} !important;
          border: 1px solid ${THEME.border} !important;
          color: ${THEME.textPrimary} !important;
          border-radius: 6px !important;
          padding: 6px 10px !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.4) !important;
        }
        .leaflet-tooltip-top:before {
          border-top-color: ${THEME.border} !important;
        }
      `}</style>
    </div>
  );
}
