'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';

export default function LoginPage(){const router=useRouter();const [identifier,setIdentifier]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{await api('/auth/login',{method:'POST',body:JSON.stringify({identifier,password})});const next = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('next') : null;router.push(next||'/account');}catch(e:any){setError(e.message);}finally{setBusy(false);}}
return <main className="auth-page"><div className="auth-card"><div className="auth-mark">RN</div><span className="section-kicker">WELCOME BACK</span><h1>Good to see you <em>again.</em></h1><p>Sign in to manage your rentals and keep your next trip moving.</p><form onSubmit={submit} className="stack-form"><label className="form-label">Email or mobile number<input type="text" value={identifier} onChange={e=>setIdentifier(e.target.value)} placeholder="you@example.com or +91 98765 43210" required/></label><label className="form-label">Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password" required/></label>{error&&<div className="notice error">{error}</div>}<button className="button button-primary button-block" disabled={busy}>{busy?'Signing in…':'Sign in'}</button></form><div className="auth-switch">New to RoadNest? <Link href="/register">Create an account</Link></div><div className="auth-help">Need help? Contact the rental shop directly.</div></div></main>}
