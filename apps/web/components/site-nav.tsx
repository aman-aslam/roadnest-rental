'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CarFront, Bike, Menu, UserRound, Gauge } from 'lucide-react';
import { useState } from 'react';

export function SiteNav() {
  const pathname = usePathname(); const [open,setOpen] = useState(false);
  const name = process.env.NEXT_PUBLIC_SHOP_NAME || 'RoadNest Rentals';
  return <header className="site-header"><div className="nav-wrap">
    <Link href="/" className="brand"><span className="brand-mark"><CarFront size={21}/></span><span>{name}<small>MOVE YOUR WAY</small></span></Link>
    <button className="mobile-menu" onClick={()=>setOpen(!open)} aria-label="Toggle menu"><Menu/></button>
    <nav className={open?'nav-links open':'nav-links'}>
      <Link className={pathname==='/vehicles'?'active':''} href="/vehicles?type=CAR"><CarFront size={16}/> Cars</Link>
      <Link href="/vehicles?type=BIKE"><Bike size={16}/> Bikes</Link>
      <Link href="/#how-it-works">How it works</Link>
      <Link href="/account"><UserRound size={16}/> My bookings</Link>
    </nav>
    <div className="nav-actions"><Link className="text-link" href="/login">Sign in</Link><Link className="button button-dark button-small" href="/admin"><Gauge size={15}/> Shop admin</Link></div>
  </div></header>;
}
