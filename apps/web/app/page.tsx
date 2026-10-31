'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, ShieldCheck, Clock3, Wallet, CheckCircle2, MapPinned, Headphones, Sparkles } from 'lucide-react';
import { SearchPanel } from '@/components/search-panel';
import { VehicleCard } from '@/components/vehicle-card';
import { api } from '@/lib/api';

export default function HomePage() {
  const [vehicles,setVehicles] = useState<any[]>([]);
  useEffect(()=>{ api<any[]>('/vehicles').then(setVehicles).catch(()=>setVehicles([])); },[]);
  const cars = vehicles.filter(v=>v.type==='CAR').slice(0,3), bikes = vehicles.filter(v=>v.type==='BIKE').slice(0,3);
  return <main>
    <section className="hero-section"><div className="hero-orb orb-one"/><div className="hero-orb orb-two"/><div className="container hero-grid">
      <div className="hero-copy"><div className="hero-kicker"><span className="kicker-dot"/> YOUR LOCAL RENTAL PARTNER</div><h1>Good journeys<br/>start with the <em>right ride.</em></h1><p>Find a car for the long road or a bike for the quick escape. Easy booking, transparent rates, and a real local team behind every ride.</p><div className="hero-points"><span><CheckCircle2 size={16}/> Well-maintained vehicles</span><span><CheckCircle2 size={16}/> Flexible rental plans</span></div><div className="hero-cta"><Link className="button button-primary" href="/vehicles?type=CAR">Explore our fleet <ArrowRight size={17}/></Link><span className="hero-caption">Cars, bikes & scooters in one place</span></div></div>
      <div className="hero-visual"><div className="hero-visual-top"><span>READY WHEN YOU ARE</span><span className="live-dot"/> LOCAL FLEET</div><div className="hero-vehicle-scene"><div className="road-line"/><div className="scene-glow"/><div className="hero-car-emoji">🚙</div><div className="hero-bike-emoji">🏍️</div><div className="scene-label"><span>01 / YOUR NEXT TRIP</span><strong>Pick a ride.<br/>Make a memory.</strong></div></div><div className="hero-visual-bottom"><div><strong>OWN FLEET</strong><small>Managed by our local shop</small></div><div className="visual-divider"/><div><strong>24/7</strong><small>Booking access</small></div></div></div>
    </div><div className="container search-container"><SearchPanel/></div></section>

    <section className="section container category-section"><div className="section-heading"><div><span className="section-kicker">CHOOSE YOUR RIDE</span><h2>Whatever the plan,<br/><em>we have the keys.</em></h2></div><p>From weekday errands to weekend road trips, choose a vehicle that fits your day and your budget.</p></div><div className="category-grid">
      <Link href="/vehicles?type=CAR" className="category-card category-car"><div className="category-icon">🚘</div><div><span>COMFORT MEETS FREEDOM</span><h3>Cars for every<br/>kind of journey</h3><p>Hatchbacks, sedans, SUVs and more.</p><strong>Explore cars <ArrowRight size={16}/></strong></div><div className="category-art">🚙</div></Link>
      <Link href="/vehicles?type=BIKE" className="category-card category-bike"><div className="category-icon">🏍️</div><div><span>TAKE THE SCENIC ROUTE</span><h3>Two wheels.<br/>Endless plans.</h3><p>Scooters, motorcycles and electric rides.</p><strong>Explore bikes <ArrowRight size={16}/></strong></div><div className="category-art">🏍️</div></Link>
    </div></section>

    <section className="section fleet-section"><div className="container"><div className="section-heading"><div><span className="section-kicker">THE ROADNEST FLEET</span><h2>Popular rides, <em>ready to go.</em></h2></div><Link className="arrow-link" href="/vehicles">View all vehicles <ArrowRight size={17}/></Link></div>
      {vehicles.length ? <div className="vehicle-grid">{vehicles.filter(v=>v.isFeatured).slice(0,3).map(v=><VehicleCard key={v.id} vehicle={v}/>)}</div> : <div className="empty-fleet"><Sparkles size={23}/><strong>Your fleet will show up here</strong><span>Add your cars and bikes in the shop admin to publish them online.</span><Link href="/admin" className="button button-outline">Open shop admin</Link></div>}
    </div></section>

    <section id="how-it-works" className="section container how-section"><div className="section-heading centered"><div><span className="section-kicker">THREE SIMPLE STEPS</span><h2>Less planning.<br/><em>More going.</em></h2></div><p>Booking your next ride should feel as easy as taking the keys.</p></div><div className="steps-grid"><div className="step-card"><span className="step-number">01</span><div className="step-icon"><MapPinned/></div><h3>Choose your ride</h3><p>Compare cars and bikes, check the details, and find the right fit for your trip.</p></div><div className="step-card"><span className="step-number">02</span><div className="step-icon"><Clock3/></div><h3>Pick your dates</h3><p>Choose your pickup and return times. See the rental amount and deposit before you confirm.</p></div><div className="step-card"><span className="step-number">03</span><div className="step-icon"><CheckCircle2/></div><h3>Verify and go</h3><p>Share your documents, complete the booking, and collect your vehicle from the shop.</p></div></div></section>

    <section className="trust-band"><div className="container trust-grid"><div><ShieldCheck/><span><strong>Transparent prices</strong><small>No surprise rental charges</small></span></div><div><Wallet/><span><strong>Flexible payments</strong><small>Advance, UPI or at the shop</small></span></div><div><Headphones/><span><strong>Local support</strong><small>A real team to help you</small></span></div></div></section>
    <section className="bottom-cta container"><div><span className="section-kicker">YOUR NEXT TRIP IS WAITING</span><h2>Find your ride.<br/><em>Own the day.</em></h2><p>Browse the fleet and book directly with your local rental shop.</p></div><Link className="button button-primary" href="/vehicles">Browse all vehicles <ArrowRight size={17}/></Link></section>
  </main>;
}
