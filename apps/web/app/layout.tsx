import type { Metadata } from 'next';
import './globals.css';
import { SiteNav } from '@/components/site-nav';
import { AiRentalAssistant } from '@/components/ai-rental-assistant';

export const metadata: Metadata = {
  title: `${process.env.NEXT_PUBLIC_SHOP_NAME || 'RoadNest Rentals'} | Car & Bike Rentals`,
  description: 'Plan your next trip with RoadNest. Discover cars, bikes and scooters from your local rental shop.',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><SiteNav/>{children}<AiRentalAssistant/><footer className="site-footer"><div className="footer-inner"><div><div className="brand footer-brand"><span className="brand-mark">RN</span><span>{process.env.NEXT_PUBLIC_SHOP_NAME || 'RoadNest Rentals'}<small>YOUR JOURNEY, YOUR WAY</small></span></div><p>Simple, dependable rentals from your local vehicle rental team.</p></div><div><strong>Explore</strong><a href="/vehicles?type=CAR">Cars</a><a href="/vehicles?type=BIKE">Bikes</a><a href="/ai-planner">AI rental planner</a><a href="/account">My bookings</a></div><div><strong>Contact</strong><span>{process.env.NEXT_PUBLIC_SHOP_CITY || 'Your City'}</span><span>{process.env.NEXT_PUBLIC_SHOP_PHONE || '+91 90000 00000'}</span><span>Daily support</span></div></div><div className="copyright">© {new Date().getFullYear()} {process.env.NEXT_PUBLIC_SHOP_NAME || 'RoadNest Rentals'}. All rights reserved.</div></footer></body></html>
}