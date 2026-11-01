import Link from 'next/link';
import { ArrowUpRight, Fuel, Gauge, Users, Zap } from 'lucide-react';
import { money } from '@/lib/api';
import { VehiclePhoto } from '@/components/vehicle-photo';

export function VehicleCard({ vehicle }: { vehicle: any }) {
  return <article className="vehicle-card">
    <Link href={`/vehicles/${vehicle.id}`} className="vehicle-photo">
      <VehiclePhoto src={vehicle.images?.[0]?.url} type={vehicle.type} category={vehicle.category} alt={vehicle.displayName} className="vehicle-card-photo" />
      {vehicle.isFeatured && <span className="photo-tag">Popular choice</span>}
      <span className="photo-arrow"><ArrowUpRight size={17}/></span>
    </Link>
    <div className="vehicle-card-body">
      <div className="eyebrow">{vehicle.brand} · {vehicle.category?.replaceAll('_',' ')}</div>
      <Link href={`/vehicles/${vehicle.id}`} className="vehicle-title">{vehicle.displayName}</Link>
      <div className="vehicle-specs"><span><Fuel size={14}/>{vehicle.fuelType}</span>{vehicle.transmission&&<span><Gauge size={14}/>{vehicle.transmission}</span>}{vehicle.seats&&<span><Users size={14}/>{vehicle.seats} seats</span>}{vehicle.isElectric&&<span><Zap size={14}/>Electric</span>}</div>
      <div className="vehicle-card-foot"><div><strong>{money(vehicle.dailyRatePaise)}</strong><small> / day</small></div><Link href={`/vehicles/${vehicle.id}`} className="button button-outline button-small">View details</Link></div>
    </div>
  </article>;
}
