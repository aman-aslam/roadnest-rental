'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { SlidersHorizontal, Search, CarFront, Bike, ArrowUpDown } from 'lucide-react';
import { api } from '@/lib/api';
import { VehicleCard } from '@/components/vehicle-card';

export default function VehiclesPage() {
  const params = useSearchParams();
  const [vehicles,setVehicles]=useState<any[]>([]),[brands,setBrands]=useState<string[]>([]),[loading,setLoading]=useState(true),[type,setType]=useState(params.get('type')||''),[category,setCategory]=useState(''),[search,setSearch]=useState(''),[fuel,setFuel]=useState(''),[transmission,setTransmission]=useState(''),[brand,setBrand]=useState(''),[maxRate,setMaxRate]=useState(''),[sort,setSort]=useState('featured'),[error,setError]=useState('');
  const pickupAt=params.get('pickupAt')||'',returnAt=params.get('returnAt')||'',location=params.get('location')||'';
  useEffect(()=>{setType(params.get('type')||'');},[params]);
  useEffect(()=>{api<any[]>('/vehicles').then(v=>setBrands([...new Set(v.map(x=>x.brand).filter(Boolean))].sort()));},[]);
  useEffect(()=>{
    setLoading(true);const q=new URLSearchParams();if(type)q.set('type',type);if(category)q.set('category',category);if(search)q.set('search',search);if(fuel)q.set('fuelType',fuel);if(transmission)q.set('transmission',transmission);if(brand)q.set('brand',brand);if(maxRate)q.set('maxPricePaise',maxRate);if(location)q.set('pickupLocation',location);if(pickupAt)q.set('pickupAt',pickupAt);if(returnAt)q.set('returnAt',returnAt);
    api<any[]>(`/vehicles?${q.toString()}`).then(data=>{setVehicles(data);setError('');}).catch(e=>setError(e.message)).finally(()=>setLoading(false));
  },[type,category,search,fuel,transmission,brand,maxRate,pickupAt,returnAt,location]);
  const list=[...vehicles].sort((a,b)=>sort==='price-low'?a.dailyRatePaise-b.dailyRatePaise:sort==='price-high'?b.dailyRatePaise-a.dailyRatePaise:sort==='newest'?(b.year||0)-(a.year||0):Number(b.isFeatured)-Number(a.isFeatured));
  const categories=type==='CAR'?['HATCHBACK','SEDAN','SUV','MPV','LUXURY']:type==='BIKE'?['SPORTS_BIKE','SCOOTER','MOTORCYCLE','ELECTRIC_BIKE']:['HATCHBACK','SEDAN','SUV','MPV','LUXURY','SPORTS_BIKE','SCOOTER','MOTORCYCLE','ELECTRIC_BIKE'];
  function clear(){setType('');setCategory('');setFuel('');setTransmission('');setBrand('');setMaxRate('');setSearch('');}
  return <main className="page-shell"><section className="page-hero container"><div><span className="section-kicker">OUR VEHICLE COLLECTION</span><h1>Find your <em>next ride.</em></h1><p>Explore the vehicles in our local fleet, compare rates, and book the one that fits your plan.</p></div><div className="page-hero-art">🚘 <span>＋</span> 🏍️</div></section>
    <section className="container listing-layout"><aside className="filter-panel"><div className="filter-heading"><SlidersHorizontal size={17}/><strong>Filters</strong></div>
      <label className="filter-label">Vehicle type</label><div className="filter-pills"><button onClick={()=>{setType('');setCategory('');}} className={!type?'active':''}>All</button><button onClick={()=>{setType('CAR');setCategory('');}} className={type==='CAR'?'active':''}><CarFront size={14}/> Cars</button><button onClick={()=>{setType('BIKE');setCategory('');}} className={type==='BIKE'?'active':''}><Bike size={14}/> Bikes</button></div>
      <label className="filter-label">Category</label><select value={category} onChange={e=>setCategory(e.target.value)}><option value="">All categories</option>{categories.map(x=><option key={x} value={x}>{x.replaceAll('_',' ')}</option>)}</select>
      <label className="filter-label" htmlFor="brand">Brand</label><select id="brand" value={brand} onChange={e=>setBrand(e.target.value)}><option value="">All brands</option>{brands.map(x=><option key={x}>{x}</option>)}</select>
      <label className="filter-label" htmlFor="fuel">Fuel type</label><select id="fuel" value={fuel} onChange={e=>setFuel(e.target.value)}><option value="">All fuel types</option><option value="PETROL">Petrol</option><option value="DIESEL">Diesel</option><option value="ELECTRIC">Electric</option><option value="HYBRID">Hybrid</option><option value="CNG">CNG</option></select>
      <label className="filter-label" htmlFor="transmission">Transmission</label><select id="transmission" value={transmission} onChange={e=>setTransmission(e.target.value)}><option value="">Any transmission</option><option value="MANUAL">Manual</option><option value="AUTOMATIC">Automatic</option></select>
      <label className="filter-label" htmlFor="max-rate">Daily price up to</label><select id="max-rate" value={maxRate} onChange={e=>setMaxRate(e.target.value)}><option value="">Any price</option><option value="100000">₹1,000</option><option value="200000">₹2,000</option><option value="300000">₹3,000</option><option value="500000">₹5,000</option></select>
      <div className="filter-note"><strong>Transparent pricing</strong><span>Rental charges, deposits and kilometre limits are shown before you confirm.</span><button onClick={clear}>Clear all filters</button></div>
    </aside>
    <div className="listing-main"><div className="listing-toolbar"><div><strong>{list.length} vehicles</strong><span>{pickupAt&&returnAt?'Matching your selected rental dates':'Available in our shop fleet'}</span></div><div className="listing-controls"><label className="search-mini"><Search size={15}/><input placeholder="Search brand or model" value={search} onChange={e=>setSearch(e.target.value)}/></label><label className="sort-select"><ArrowUpDown size={14}/><select value={sort} onChange={e=>setSort(e.target.value)}><option value="featured">Featured</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="newest">Newest first</option></select></label></div></div>
      {loading?<div className="loading-state">Loading the fleet…</div>:error?<div className="notice error">{error}</div>:list.length?<div className="vehicle-grid listing-grid">{list.map(v=><VehicleCard key={v.id} vehicle={v}/>)}</div>:<div className="empty-state"><span>🚗</span><h3>No matching vehicles just yet</h3><p>Try another filter or change your rental dates to see more options.</p><button className="button button-outline" onClick={clear}>Clear filters</button></div>}
    </div></section>
  </main>;
}
