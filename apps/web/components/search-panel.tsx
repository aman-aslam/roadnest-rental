'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, MapPin, Search } from 'lucide-react';

function toLocalInput(date: Date) { const offset = date.getTimezoneOffset(); return new Date(date.getTime()-offset*60000).toISOString().slice(0,16); }
export function SearchPanel() {
  const router = useRouter(); const [type,setType] = useState('CAR');
  const [pickup,setPickup] = useState(toLocalInput(new Date(Date.now()+2*3600000)));
  const [ret,setRet] = useState(toLocalInput(new Date(Date.now()+26*3600000)));
  const [location,setLocation] = useState(process.env.NEXT_PUBLIC_SHOP_CITY || 'Your shop location');
  function search(e: React.FormEvent) { e.preventDefault(); router.push(`/vehicles?type=${type}&pickupAt=${encodeURIComponent(new Date(pickup).toISOString())}&returnAt=${encodeURIComponent(new Date(ret).toISOString())}&location=${encodeURIComponent(location)}`); }
  return <form className="search-panel" onSubmit={search}>
    <div className="search-tabs"><button type="button" onClick={()=>setType('CAR')} className={type==='CAR'?'selected':''}>🚘 Rent a car</button><button type="button" onClick={()=>setType('BIKE')} className={type==='BIKE'?'selected':''}>🏍️ Rent a bike</button></div>
    <div className="search-fields">
      <label className="search-field"><span><MapPin size={15}/> Pickup location</span><input value={location} onChange={e=>setLocation(e.target.value)} placeholder="Enter pickup location" required/></label>
      <label className="search-field"><span><CalendarDays size={15}/> Pick-up date & time</span><input type="datetime-local" value={pickup} onChange={e=>setPickup(e.target.value)} required/></label>
      <label className="search-field"><span><CalendarDays size={15}/> Return date & time</span><input type="datetime-local" value={ret} onChange={e=>setRet(e.target.value)} min={pickup} required/></label>
      <button className="button button-primary search-submit"><Search size={17}/> Find a vehicle</button>
    </div>
    <p className="search-footnote">Clear pricing · Verified vehicles · Local support</p>
  </form>;
}
