"use client"

import React, { useEffect, useState, useRef } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { Employee, LocationHistory } from "./admin-location-management"
import { AlertCircle, Clock, Battery, MapPin, Settings2, ArrowRight } from "lucide-react"
import L from "leaflet"
import { MapContainer as LeafletMapContainer, TileLayer, Marker, Popup, useMap, Tooltip, Polyline, Circle } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import useSWR from 'swr';
// Import MarkerClusterGroup for clustering
import MarkerClusterGroup from 'react-leaflet-cluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { getAvatarImage, getAvatarInitials } from "@/lib/avatar-utils"

// Fix Leaflet default marker icon issue
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'

let DefaultIcon = L.icon({
  iconUrl: icon.src,
  shadowUrl: iconShadow.src,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Custom arrow component for showing direction
function DirectionalArrow({ 
  start, 
  end,
  color = "#3b82f6",
  opacity = 0.8
}: { 
  start: [number, number]; 
  end: [number, number];
  color?: string;
  opacity?: number;
}) {
  if (!start || !end) return null;
  
  // Calculate the midpoint for placing the arrow
  const midPoint: [number, number] = [
    (start[0] + end[0]) / 2,
    (start[1] + end[1]) / 2
  ];
  
  // Calculate the angle between the two points (in degrees)
  const angle = Math.atan2(end[0] - start[0], end[1] - start[1]) * 180 / Math.PI;
  
  // Create a custom divIcon with an arrow SVG
  const arrowIcon = L.divIcon({
    className: 'direction-arrow',
    html: `<div style="transform: rotate(${angle}deg); width: 20px; height: 20px;">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" style="opacity: ${opacity};">
              <path d="M13.025 1l-2.847 2.828 6.176 6.176h-16.354v3.992h16.354l-6.176 6.176 2.847 2.828 10.975-11z"/>
            </svg>
           </div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
  
  return (
    <Marker position={midPoint} icon={arrowIcon} interactive={false} />
  );
}

// ArrowMarker component to show the direction of travel
function ArrowMarker({
  position,
  color = "#2563eb",
  isSelected = false,
  onClick,
  children
}: {
  position: [number, number];
  color?: string;
  isSelected?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
}) {
  const iconSize = isSelected ? 40 : 32;
  const markerIcon = L.divIcon({
    className: isSelected ? 'selected-marker' : '',
    html: `<svg width="${iconSize}" height="${iconSize}" viewBox="0 0 ${iconSize} ${iconSize}" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${iconSize/2}" cy="${iconSize/2}" r="${iconSize*0.375}" fill="${color}" stroke="#fff" stroke-width="${iconSize*0.125}"/>
      <circle cx="${iconSize/2}" cy="${iconSize/2}" r="${iconSize*0.1875}" fill="#fff"/>
    </svg>`,
    iconSize: [iconSize, iconSize],
    iconAnchor: [iconSize/2, iconSize],
  });
  
  return (
    <Marker
      position={position}
      icon={markerIcon}
      eventHandlers={{ click: onClick }}
    >
      {children}
    </Marker>
  );
}

interface MapContainerProps {
  employees: Employee[]
  selectedEmployee: Employee | null
  locationHistory: LocationHistory[]
  isLoading: boolean
  isMobileView?: boolean
  selectedCity?: string
  isFullscreen?: boolean
  onRequestFullscreen?: () => void
  onRequestExitFullscreen?: () => void
  selectedHistoryIndex?: number | null
  onSelectHistoryIndex?: (idx: number) => void
}

// This component handles map updates
function MapUpdater({ 
  employees, 
  selectedEmployee, 
  locationHistory,
  selectedHistoryIndex,
  onUpdateStart,
  onUpdateEnd
}: { 
  employees: Employee[]
  selectedEmployee: Employee | null
  locationHistory: LocationHistory[]
  selectedHistoryIndex?: number | null
  onUpdateStart: () => void
  onUpdateEnd: () => void
}) {
  const map = useMap()

  useEffect(() => {
    if (!map) return

    onUpdateStart();

    // Calculate bounds from all points
    const points = [
      ...employees.map(emp => [emp.location?.latitude || 0, emp.location?.longitude || 0]),
      ...locationHistory.map(loc => [loc.latitude || 0, loc.longitude || 0])
    ]

    // Filter out invalid points (0,0)
    const validPoints = points.filter(
      p => p[0] !== 0 && p[1] !== 0 && 
      Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180
    );

    if (validPoints.length > 0) {
      const bounds = L.latLngBounds(validPoints.map(p => L.latLng(p[0], p[1])))
      map.fitBounds(bounds, { padding: [50, 50] })
    }

    // Center on selected history point if available
    if (selectedHistoryIndex !== null && selectedHistoryIndex !== undefined && locationHistory[selectedHistoryIndex]) {
      const selectedPoint = locationHistory[selectedHistoryIndex];
      map.setView([selectedPoint.latitude, selectedPoint.longitude], 15, {
        animate: true,
        duration: 0.5
      });
    }
    // Otherwise center on selected employee if available
    else if (selectedEmployee?.location) {
      const { latitude, longitude } = selectedEmployee.location
      map.setView([latitude, longitude], 14, {
        animate: true,
        duration: 1
      })
    }

    // Delay the end of update slightly to show the animation
    setTimeout(onUpdateEnd, 1000);
  }, [map, employees, selectedEmployee, locationHistory, selectedHistoryIndex, onUpdateStart, onUpdateEnd])

  return null
}

const MAP_STYLES = [
  {
    name: "Standard",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  {
    name: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: 'Tiles &copy; Esri',
  },
];

const CITY_COORDS: Record<string, [number, number]> = {
  Jakarta: [-6.2, 106.8],
  Surabaya: [-7.25, 112.75],
  Bandung: [-6.917, 107.619],
  Medan: [3.595, 98.672],
  Semarang: [-6.966, 110.417],
};

export function MapContainer({
  employees: employeesProp,
  selectedEmployee,
  locationHistory,
  isLoading: isLoadingProp,
  isMobileView = false,
  selectedCity,
  isFullscreen = false,
  onRequestFullscreen,
  onRequestExitFullscreen,
  selectedHistoryIndex = null,
  onSelectHistoryIndex,
}: MapContainerProps) {
  // All hooks at the top, before any early returns
  const employees = employeesProp;
  const isLoading = isLoadingProp;
  const [isUpdating, setIsUpdating] = useState(false);
  const [mapStyle, setMapStyle] = useState(MAP_STYLES[0]);
  const mapRef = useRef<any>(null);
  const [manualMapMove, setManualMapMove] = useState(false);
  const [autoFitEnabled, setAutoFitEnabled] = useState(true);
  const [mapReady, setMapReady] = useState(false);

  // When entering fullscreen, force map to resize
  useEffect(() => {
    if (isFullscreen && mapReady && mapRef.current && mapRef.current.invalidateSize) {
      try {
        mapRef.current.invalidateSize();
      } catch {}
    }
  }, [isFullscreen, mapReady]);

  // Get the bounds of all employee locations
  const points = employees.map(emp => [emp.location?.latitude || 0, emp.location?.longitude || 0])
  const center = points.length > 0 
    ? [points[0][0], points[0][1]] 
    : [51.505, -0.09]

  // Remove old spinner effects and add this new effect:
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    // Show spinner when city or style changes
    setIsUpdating(true);

    const map = mapRef.current;
    const handleDone = () => setIsUpdating(false);

    // Listen for map events that indicate the map is done updating
    map.on('moveend', handleDone);
    map.on('layeradd', handleDone);
    map.on('tileload', handleDone);

    // Fallback: hide spinner after 2 seconds in case events don't fire
    const fallback = setTimeout(() => setIsUpdating(false), 2000);

    return () => {
      map.off('moveend', handleDone);
      map.off('layeradd', handleDone);
      map.off('tileload', handleDone);
      clearTimeout(fallback);
    };
  }, [selectedCity, mapStyle, mapReady]);

  // Auto-fit only on initial mount or when employees change and auto-fit is enabled
  useEffect(() => {
    if (autoFitEnabled && mapRef.current) {
      const bounds = L.latLngBounds(points.map(p => L.latLng(p[0], p[1])));
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFitEnabled, employees.length]);

  // --- Helper to fit map to all employees ---
  function fitToAllEmployees() {
    if (!mapReady || !mapRef.current || points.length === 0 || !mapRef.current.fitBounds) return;
    setAutoFitEnabled(true);
    setManualMapMove(false);
    const bounds = L.latLngBounds(points.map(p => L.latLng(p[0], p[1])));
    mapRef.current.fitBounds(bounds, { padding: [50, 50] });
  }

  // Robustly fix map resizing issues
  useEffect(() => {
    if (mapReady && mapRef.current && mapRef.current.invalidateSize) {
      mapRef.current.invalidateSize();
    }
  }, [employees.length, isFullscreen, mapReady]);

  // Center map on selected employee when they have valid coordinates
  useEffect(() => {
    if (mapReady && mapRef.current && selectedEmployee) {
      const lat = parseFloat(selectedEmployee.latitude || '0');
      const lng = parseFloat(selectedEmployee.longitude || '0');
      const isValidLat = !isNaN(lat) && lat !== 0;
      const isValidLng = !isNaN(lng) && lng !== 0;
      
      if (isValidLat && isValidLng) {
        mapRef.current.setView([lat, lng], 14, { animate: true });
      }
    }
  }, [selectedEmployee, mapReady]);

  // --- Robust history mode rendering ---
  // If locationHistory is present, draw polyline and markers
  const isHistoryMode = locationHistory && locationHistory.length > 0;

  // Polyline positions for history
  const polylinePositions = isHistoryMode
    ? locationHistory.map(loc => [loc.latitude, loc.longitude])
    : [];
    
  // Time-based color gradient for polyline segments
  const getSegmentColor = (idx: number, total: number) => {
    if (idx === selectedHistoryIndex) return "#FF5722"; // Highlight selected segment
    // Generate a color gradient from blue to green based on timestamp
    const ratio = idx / Math.max(total - 1, 1);
    return `rgba(37, 99, 235, ${1 - ratio * 0.7})`; // Blue with fading opacity
  };

  // Sort history by timestamp to ensure correct path
  const sortedHistory = isHistoryMode 
    ? [...locationHistory].sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    : [];

  // Early returns come AFTER all hooks
  if (isLoading) {
    return <Skeleton className="h-full w-full" />
  }

  if (employees.length === 0) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center text-center text-muted-foreground p-8 bg-gray-100">
        <span className="text-5xl mb-4">🗺️</span>
        <div className="text-xl font-semibold mb-2">No employee locations to display</div>
        <div className="text-base">Try selecting a different city or check your filters.</div>
      </div>
    );
  }

  // Modern SVG marker icons
  const svgMarker = L.divIcon({
    className: '',
    html: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="12" fill="#2563eb" stroke="#fff" stroke-width="4"/>
      <circle cx="16" cy="16" r="6" fill="#fff"/>
    </svg>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });

  const selectedSvgMarker = L.divIcon({
    className: 'selected-svg-marker',
    html: `<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="16" fill="#2563eb" stroke="#fff" stroke-width="6"/>
      <circle cx="20" cy="20" r="8" fill="#fff"/>
    </svg>`,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
  });

  return (
    <div className={`relative ${isFullscreen ? 'fixed inset-0 z-[40] bg-white w-screen h-screen' : 'h-full w-full'}`}>
      {/* Add updating overlay */}
      {isUpdating && employees.length > 0 && (
        <div className="absolute inset-0 bg-black/10 z-10 flex items-center justify-center">
          <div className="bg-white p-4 rounded-lg shadow-lg flex items-center gap-2">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <span>Updating location...</span>
          </div>
        </div>
      )}

      {/* Map controls overlay */}
      <div className={`absolute right-4 top-4 z-[20] flex flex-row items-center gap-x-2 mt-2`}>
        {isFullscreen ? (
          <>
            <button
              className="bg-white/90 rounded-full shadow p-2 hover:bg-gray-100 border border-gray-200 flex items-center justify-center"
              onClick={onRequestExitFullscreen}
              title="Close Fullscreen Map"
            >
              <span className="text-xl leading-none">×</span>
            </button>
            <Popover>
              <PopoverTrigger asChild>
                <button className="bg-white/90 rounded-full shadow p-2 hover:bg-gray-100 border border-gray-200">
                  <Settings2 className="h-5 w-5 text-gray-700" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-4 z-[25]">
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1">Map Style</label>
                    <select
                      className="border rounded px-2 py-1 text-sm w-full"
                      value={mapStyle.name}
                      onChange={e => setMapStyle(MAP_STYLES.find(s => s.name === e.target.value) || MAP_STYLES[0])}
                    >
                      {MAP_STYLES.map(style => (
                        <option key={style.name} value={style.name}>{style.name}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    className="bg-black text-white px-3 py-1 rounded shadow hover:bg-gray-800 text-xs"
                    onClick={() => { if (mapReady && mapRef.current && mapRef.current.fitBounds) fitToAllEmployees(); }}
                  >
                    Reset View
                  </button>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(CITY_COORDS).map(([city, coords]) => (
                      <button
                        key={city}
                        type="button"
                        className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs hover:bg-blue-200"
                        onClick={e => {
                          e.preventDefault();
                          e.stopPropagation();
                          setManualMapMove(true);
                          setAutoFitEnabled(false);
                          if (mapReady && mapRef.current && mapRef.current.setView) mapRef.current.setView(coords, 13, { animate: true });
                        }}
                      >
                        {city}
                      </button>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </>
        ) : (
          onRequestFullscreen && (
            <>
              <button
                className="bg-white/90 rounded-full shadow p-2 hover:bg-gray-100 border border-gray-200"
                onClick={onRequestFullscreen}
                title="Enlarge Map"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V6a2 2 0 012-2h2m8 0h2a2 2 0 012 2v2m0 8v2a2 2 0 01-2 2h-2m-8 0H6a2 2 0 01-2-2v-2" /></svg>
              </button>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="bg-white/90 rounded-full shadow p-2 hover:bg-gray-100 border border-gray-200">
                    <Settings2 className="h-5 w-5 text-gray-700" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-64 p-4 z-[25]">
                  <div className="flex flex-col gap-3">
                    <div>
                      <label className="text-xs font-medium mb-1">Map Style</label>
                      <select
                        className="border rounded px-2 py-1 text-sm w-full"
                        value={mapStyle.name}
                        onChange={e => setMapStyle(MAP_STYLES.find(s => s.name === e.target.value) || MAP_STYLES[0])}
                      >
                        {MAP_STYLES.map(style => (
                          <option key={style.name} value={style.name}>{style.name}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      className="bg-black text-white px-3 py-1 rounded shadow hover:bg-gray-800 text-xs"
                      onClick={() => { if (mapReady && mapRef.current && mapRef.current.fitBounds) fitToAllEmployees(); }}
                    >
                      Reset View
                    </button>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(CITY_COORDS).map(([city, coords]) => (
                        <button
                          key={city}
                          type="button"
                          className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs hover:bg-blue-200"
                          onClick={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            setManualMapMove(true);
                            setAutoFitEnabled(false);
                            if (mapReady && mapRef.current && mapRef.current.setView) mapRef.current.setView(coords, 13, { animate: true });
                          }}
                        >
                          {city}
                        </button>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </>
          )
        )}
      </div>

      <LeafletMapContainer
        center={center as [number, number]}
        zoom={13}
        className="h-full w-full"
        style={{ zIndex: 0 }}
        ref={(instance) => { mapRef.current = instance; }}
        whenReady={() => { setMapReady(true); fitToAllEmployees(); }}
        scrollWheelZoom={true}
        doubleClickZoom={true}
        dragging={true}
        touchZoom={true}
      >
        <TileLayer
          url={mapStyle.url}
          attribution={mapStyle.attribution}
        />
        {/* --- Enhanced history mode: polyline segments, directional arrows, and markers --- */}
        {isHistoryMode && sortedHistory.length > 0 && (
          <>
            {/* Polyline segments with individual colors */}
            {sortedHistory.map((loc, idx) => {
              // Skip the first point as we need pairs for segments
              if (idx === 0) return null;
              
              const prevLoc = sortedHistory[idx - 1];
              const positions: [number, number][] = [
                [prevLoc.latitude, prevLoc.longitude],
                [loc.latitude, loc.longitude]
              ];
              
              const segmentColor = getSegmentColor(idx - 1, sortedHistory.length - 1);
              
              return (
                <React.Fragment key={`segment-${idx}`}>
                  {/* Line segment */}
                  <Polyline 
                    positions={positions} 
                    color={segmentColor} 
                    weight={4} 
                    opacity={idx === selectedHistoryIndex || (idx - 1) === selectedHistoryIndex ? 1 : 0.7} 
                  />
                  
                  {/* Directional arrow */}
                  <DirectionalArrow 
                    start={positions[0]} 
                    end={positions[1]} 
                    color={segmentColor}
                    opacity={idx === selectedHistoryIndex || (idx - 1) === selectedHistoryIndex ? 1 : 0.7}
                  />
                </React.Fragment>
              );
            })}
            
            {/* Start and end indicators */}
            {sortedHistory.length > 0 && (
              <>
                <Circle 
                  center={[sortedHistory[0].latitude, sortedHistory[0].longitude]} 
                  radius={8} 
                  pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 1 }} 
                >
                  <Tooltip permanent direction="top" offset={[0, -10]}>Start</Tooltip>
                </Circle>
                <Circle 
                  center={[sortedHistory[sortedHistory.length-1].latitude, sortedHistory[sortedHistory.length-1].longitude]} 
                  radius={8} 
                  pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 1 }} 
                >
                  <Tooltip permanent direction="top" offset={[0, -10]}>End</Tooltip>
                </Circle>
              </>
            )}
            
            {/* Markers for each history point with enhanced selection */}
            {sortedHistory.map((loc, idx) => (
              <ArrowMarker
                key={loc.id || loc.timestamp || idx}
                position={[loc.latitude, loc.longitude]}
                isSelected={idx === selectedHistoryIndex}
                onClick={() => onSelectHistoryIndex && onSelectHistoryIndex(idx)}
              >
                <Popup>
                  <div className="text-sm">
                    <div className="font-bold mb-1">{new Date(loc.timestamp).toLocaleString()}</div>
                    <div className="grid grid-cols-[auto,1fr] gap-x-2">
                      <span>Point:</span><span>#{idx + 1} of {sortedHistory.length}</span>
                      <span>Latitude:</span><span>{loc.latitude.toFixed(6)}</span>
                      <span>Longitude:</span><span>{loc.longitude.toFixed(6)}</span>
                      <span>Battery:</span><span>{loc.batteryLevel ?? 'N/A'}</span>
                      {loc.address && (
                        <>
                          <span>Address:</span><span>{loc.address}</span>
                        </>
                      )}
                    </div>
                  </div>
                </Popup>
                <Tooltip 
                  direction="top" 
                  offset={[0, -20]} 
                  className={idx === selectedHistoryIndex ? "font-bold" : ""}
                >
                  Point #{idx + 1} - {new Date(loc.timestamp).toLocaleTimeString()}
                </Tooltip>
              </ArrowMarker>
            ))}
          </>
        )}
        {/* --- Real-time mode: show employee markers with clustering --- */}
        {!isHistoryMode && (
          <MarkerClusterGroup
            chunkedLoading
            disableClusteringAtZoom={16}
            spiderfyOnMaxZoom={true}
            polygonOptions={{
              fillColor: '#2563eb',
              color: '#2563eb',
              weight: 0.5,
              opacity: 1,
              fillOpacity: 0.2
            }}
          >
            {employees.map((emp, idx) => (
              emp.location && (
                <Marker
                  key={emp.id}
                  position={[emp.location.latitude, emp.location.longitude]}
                  icon={selectedEmployee && emp.id === selectedEmployee.id ? selectedSvgMarker : svgMarker}
                >
                  <Popup>
                    <div>
                      <b>{emp.name}</b><br />
                      Lat: {emp.location.latitude}, Lng: {emp.location.longitude}<br />
                      Battery: {emp.batteryLevel ?? '-'}
                    </div>
                  </Popup>
                </Marker>
              )
            ))}
          </MarkerClusterGroup>
        )}

        <MapUpdater 
          employees={employees} 
          selectedEmployee={selectedEmployee} 
          locationHistory={locationHistory}
          selectedHistoryIndex={selectedHistoryIndex}
          onUpdateStart={() => setIsUpdating(true)}
          onUpdateEnd={() => setIsUpdating(false)}
        />
      </LeafletMapContainer>

      {/* Add selected employee info overlay */}
      {selectedEmployee && (
        <div className="absolute bottom-4 left-4 bg-white p-4 rounded-lg shadow-lg max-w-sm">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage
                src={getAvatarImage({ 
                  image: selectedEmployee.user?.image, 
                  pictureUrl: selectedEmployee.pictureUrl 
                })}
                alt={selectedEmployee.name || ""}
              />
              <AvatarFallback>
                {getAvatarInitials(selectedEmployee.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-bold">{selectedEmployee.name || "-"}</h3>
              <p className="text-sm text-muted-foreground">{selectedEmployee.city || 'Location updating...'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
