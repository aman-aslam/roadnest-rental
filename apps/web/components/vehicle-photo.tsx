'use client';

import { useState } from 'react';
import { assetUrl, fallbackVehicleImage } from '@/lib/api';

type VehiclePhotoProps = {
  src?: string | null;
  type?: string;
  category?: string;
  alt: string;
  className?: string;
};

export function VehiclePhoto({ src, type, category, alt, className = '' }: VehiclePhotoProps) {
  const [showSample, setShowSample] = useState(!src);
  const [sampleFailed, setSampleFailed] = useState(false);
  const sampleUrl = fallbackVehicleImage(type, category);

  function handleImageError() {
    if (!showSample) {
      setShowSample(true);
      return;
    }
    setSampleFailed(true);
  }

  return (
    <div className={`vehicle-photo-visual ${className}`}>
      {sampleFailed ? (
        <div className="vehicle-photo-visual-placeholder" role="img" aria-label={`No photo available for ${alt}`}>
          <span>{type?.toUpperCase() === 'BIKE' ? '🏍️' : '🚘'}</span>
        </div>
      ) : (
        <img
          src={showSample ? sampleUrl : assetUrl(src || undefined)}
          alt={showSample ? `Sample reference photo, not the actual ${alt}` : alt}
          loading="lazy"
          onError={handleImageError}
        />
      )}
      {showSample && (
        <span className="vehicle-photo-disclaimer">
          Sample photo · Actual vehicle photo not uploaded
        </span>
      )}
    </div>
  );
}
