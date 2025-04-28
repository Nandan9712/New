// src/components/LocationPicker.jsx
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';

function LocationMarker({ position, setPosition, setAddress }) {
  // When user clicks on the map, update position
  useMapEvents({
    click(e) {
      setPosition(e.latlng);
      // reverse-geocode via Nominatim
      fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${e.latlng.lat}&lon=${e.latlng.lng}&format=json`
      )
        .then((res) => res.json())
        .then((data) => {
          setAddress(data.display_name || `${e.latlng.lat}, ${e.latlng.lng}`);
        })
        .catch(() => {
          setAddress(`${e.latlng.lat}, ${e.latlng.lng}`);
        });
    },
  });

  return position === null ? null : (
    <Marker position={position} />
  );
}

export default function LocationPicker({ address, setAddress }) {
  const [position, setPosition] = useState(null);

  // Keep address in sync with position if user sets initial address
  useEffect(() => {
    if (!address && position) {
      setAddress(`${position.lat}, ${position.lng}`);
    }
  }, [position, address, setAddress]);

  return (
    <div>
      <MapContainer
        center={[51.505, -0.09]}
        zoom={13}
        style={{ height: '300px', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://osm.org/">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LocationMarker
          position={position}
          setPosition={setPosition}
          setAddress={setAddress}
        />
      </MapContainer>
      <div className="mt-2 text-sm text-gray-600">
        {position
          ? `Picked: ${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`
          : 'Click on the map to pick a location'}
      </div>
    </div>
  );
}
