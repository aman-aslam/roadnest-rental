'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, ShieldCheck, Clock3, Wallet, CheckCircle2, MapPinned, Headphones, Sparkles, ArrowUpRight } from 'lucide-react';
import { SearchPanel } from '@/components/search-panel';
import { VehicleCard } from '@/components/vehicle-card';
import { api } from '@/lib/api';

const heroPhoto = 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1500&q=90';
const carPhoto = 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1200&q=85';
const bikePhoto = 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=1200&q=85';

export default function HomePage() {
  const [vehicles,setVehicles] = useState<any[]>([]);
  const [fleetLoading,setFleetLoading] = useState(true);
  const [fleetError,setFleetError] = useState('');
  const [retryCount,setRetryCount] = useState(0);

  useEffect(()=>{
    let active = true;
    setFleetLoading(true);
    setFleetError('');
    api<any[]>('/vehicles')
      .then(data=>{ if(active) setVehicles(data); })
      .catch(error=>{ if(active) setFleetError(error.message || 'The fleet is temporarily unavailable.'); })
      .finally(()=>{ if(active) setFleetLoading(false); });
    return ()=>{ active = false; };
  },[retryCount]);

  const featuredVehicles = vehicles.filter(v=>v.isFeatured);
  const homeVehicles = (featuredVehicles.length ? featuredVehicles : vehicles).slice(0,3);
  return <main>
    <section className="hero-section"><div className="hero-orb orb-one"/><div className="hero-orb orb-two"/><div className="container hero-grid">
      <div className="hero-copy"><div className="hero-kicker"><span className="kicker-dot"/> YOUR NEXT JOURNEY STARTS HERE</div><h1>Find your ride.<br/>Take the <em>scenic route.</em></h1><p>Thoughtfully maintained cars, bikes and scooters from one trusted local rental shop. Tell us where you’re headed and we’ll help you find the right ride.</p><div className="hero-points"><span><CheckCircle2 size={16}/> Clear, upfront rates</span><span><CheckCircle2 size={16}/> Flexible rental plans</span></div><div className="hero-cta"><Link className="button button-primary" href="/vehicles">Explore the fleet <ArrowRight size={17}/></Link><Link className="hero-ai-link" href="/ai-planner"><Sparkles size={16}/> Plan with AI</Link></div></div>
      <div className="hero-photo-card"><img src={heroPhoto} alt="Premium sports car on an open road"/><div className="hero-photo-overlay"/><div className="hero-photo-top"><span>01 / YOUR NEXT TRIP</span><span className="photo-live"><i/> ROADNEST FLEET</span></div><div className="hero-photo-bottom"><span>Pick a ride.<br/><strong>Make a memory.</strong></span><Link href="/ai-planner" aria-label="Plan your rental with AI"><ArrowUpRight size={20}/></Link></div></div>
    </div><div className="container search-container"><SearchPanel/></div></section>

    <section className="section container category-section"><div className="section-heading"><div><span className="section-kicker">CHOOSE YOUR RIDE</span><h2>Whatever the plan,<br/><em>we have the keys.</em></h2></div><p>From weekday errands to weekend road trips, choose a vehicle that fits your day and your budget.</p></div><div className="category-grid">
      <Link href="/vehicles?type=CAR" className="category-card category-car photo-category"><img src={carPhoto} alt="Modern car on a road"/><div className="category-shade"/><div className="category-copy"><span>COMFORT MEETS FREEDOM</span><h3>Cars for every<br/>kind of journey</h3><p>Hatchbacks, sedans, SUVs and more.</p><strong>Explore cars <ArrowRight size={16}/></strong></div></Link>
      <Link href="/vehicles?type=BIKE" className="category-card category-bike photo-category"><img src={bikePhoto} alt="Motorcycle ready for a weekend ride"/><div className="category-shade"/><div className="category-copy"><span>TAKE THE SCENIC ROUTE</span><h3>Two wheels.<br/>Endless plans.</h3><p>Scooters, motorcycles and electric rides.</p><strong>Explore bikes <ArrowRight size={16}/></strong></div></Link>
    </div></section>

    <section className="section fleet-section"><div className="container"><div className="section-heading"><div><span className="section-kicker">THE ROADNEST FLEET</span><h2>Popular rides, <em>ready to go.</em></h2></div><Link className="arrow-link" href="/vehicles">View all vehicles <ArrowRight size={17}/></Link></div>
      {fleetLoading ? <div className="vehicle-grid" aria-label="Loading vehicle fleet" aria-busy="true">{[1,2,3].map(item=><div className="vehicle-card vehicle-card-skeleton" key={item}><div className="skeleton-block skeleton-photo"/><div className="vehicle-card-body"><div className="skeleton-block skeleton-line short"/><div className="skeleton-block skeleton-line title"/><div className="skeleton-block skeleton-line"/><div className="skeleton-block skeleton-line price"/></div></div>)}</div> : fleetError ? <div className="empty-fleet"><Sparkles size={23}/><strong>Connecting to the RoadNest fleet</strong><span>The server may be waking up. Your page is ready; vehicle data will appear as soon as the connection is available.</span><button className="button button-outline" onClick={()=>setRetryCount(count=>count+1)}>Try again</button></div> : homeVehicles.length ? <div className="vehicle-grid">{homeVehicles.map(v=><VehicleCard key={v.id} vehicle={v}/>)}</div> : <div className="empty-fleet"><Sparkles size={23}/><strong>No published vehicles yet</strong><span>Add and publish your cars and bikes in the shop admin to show them here.</span><Link href="/admin" className="button button-outline">Open shop admin</Link></div>}
    </div></section>

    <section className="ai-home-promo"><div className="container ai-home-inner"><div><span className="section-kicker">A SMARTER WAY TO CHOOSE</span><h2>Your trip, in your words.<br/><em>Your ride, thoughtfully matched.</em></h2><p>Tell the RoadNest assistant your group size, budget and travel plans. It’ll explore the real shop fleet and help you narrow it down.</p><Link className="button button-primary" href="/ai-planner">Build my rental plan <ArrowRight size={16}/></Link></div><div className="ai-home-preview"><div className="preview-top"><span className="preview-dot"/><strong>ROADNEST AI</strong><small>RENTAL PLANNER</small></div><span className="preview-question">“Need a comfortable SUV for a 3-day family trip, under ₹3,000 per day.”</span><div className="preview-answer"><Sparkles size={15}/><span>I'll look through our available fleet options and help you compare the best fit.</span></div><div className="preview-tags"><span>Family trip</span><span>3 days</span><span>Under ₹3,000/day</span></div></div></div></section>

    <section id="how-it-works" className="section container how-section"><div className="section-heading centered"><div><span className="section-kicker">THREE SIMPLE STEPS</span><h2>Less planning.<br/><em>More going.</em></h2></div><p>Booking your next ride should feel as easy as taking the keys.</p></div><div className="steps-grid"><div className="step-card"><span className="step-number">01</span><div className="step-icon"><MapPinned/></div><h3>Choose your ride</h3><p>Compare cars and bikes, check the details, and find the right fit for your trip.</p></div><div className="step-card"><span className="step-number">02</span><div className="step-icon"><Clock3/></div><h3>Pick your dates</h3><p>Choose your pickup and return times. See the rental amount and deposit before you confirm.</p></div><div className="step-card"><span className="step-number">03</span><div className="step-icon"><CheckCircle2/></div><h3>Verify and go</h3><p>Share your documents, complete the booking, and collect your vehicle from the shop.</p></div></div></section>

    <section className="trust-band"><div className="container trust-grid"><div><ShieldCheck/><span><strong>Transparent prices</strong><small>No surprise rental charges</small></span></div><div><Wallet/><span><strong>Flexible payments</strong><small>Advance, UPI or at the shop</small></span></div><div><Headphones/><span><strong>Local support</strong><small>A real team to help you</small></span></div></div></section>
    <section className="bottom-cta container"><div><span className="section-kicker">YOUR NEXT TRIP IS WAITING</span><h2>Find your ride.<br/><em>Own the day.</em></h2><p>Browse the fleet and book directly with your local rental shop.</p></div><Link className="button button-primary" href="/vehicles">Browse all vehicles <ArrowRight size={17}/></Link></section>
  </main>;
}
