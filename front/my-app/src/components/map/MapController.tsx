import React from 'react';
import { useMapEvents } from 'react-leaflet';

interface MapControllerProps {
  onMapClick: (lat: number, lng: number) => void;
}

export const MapClickHandler: React.FC<MapControllerProps> = ({ onMapClick }) => {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};
