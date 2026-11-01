'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bike, Menu, UserRound, Gauge, Sparkles, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { RoadNestMark } from '@/components/roadnest-mark';

export function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const name = process.env.NEXT_PUBLIC_SHOP_NAME || 'RoadNest Rentals';

  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className="site-header">
      <div className="nav-wrap">
        <Link href="/" className="brand" aria-label="RoadNest Rentals home">
          <span className="brand-mark"><RoadNestMark /></span>
          <span>{name}<small>MOVE YOUR WAY</small></span>
        </Link>
        <button
          className="mobile-menu"
          type="button"
          onClick={() => setOpen(value => !value)}
          aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={open}
          aria-controls="primary-navigation"
        >
          {open ? <X size={19}/> : <Menu size={19}/>}
        </button>
        <nav id="primary-navigation" className={open ? 'nav-links open' : 'nav-links'} aria-label="Main navigation">
          <Link className={pathname === '/vehicles' ? 'active' : ''} href="/vehicles?type=CAR">Cars</Link>
          <Link href="/vehicles?type=BIKE"><Bike size={16}/> Bikes</Link>
          <Link className={pathname === '/ai-planner' ? 'active' : ''} href="/ai-planner"><Sparkles size={15}/> AI planner</Link>
          <Link href="/#how-it-works">How it works</Link>
          <Link href="/account"><UserRound size={16}/> My bookings</Link>
        </nav>
        <div className="nav-actions">
          <Link className="text-link" href="/login">Sign in</Link>
          <Link className="button button-dark button-small" href="/admin"><Gauge size={15}/> Shop admin</Link>
        </div>
      </div>
    </header>
  );
}
