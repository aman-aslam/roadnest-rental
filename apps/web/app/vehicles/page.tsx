import { Suspense } from 'react';
import VehiclesClient from './vehicles-client';

export default function VehiclesPage() {
  return (
    <Suspense fallback={<main className="page-shell container"><div className="loading-state">Loading the fleet…</div></main>}>
      <VehiclesClient />
    </Suspense>
  );
}
