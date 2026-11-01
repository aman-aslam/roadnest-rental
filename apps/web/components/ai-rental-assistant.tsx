'use client';
import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Bot, LoaderCircle, Send, Sparkles, X } from 'lucide-react';
import { api, money } from '@/lib/api';
import { VehiclePhoto } from '@/components/vehicle-photo';

type SuggestedVehicle = { id:string; displayName:string; type:string; category:string; fuelType:string; transmission?:string; seats?:number; dailyRatePaise:number; securityDepositPaise:number; image:string|null };
type ChatMessage = { role:'assistant'|'user'; text:string; vehicles?:SuggestedVehicle[] };

export function AiRentalAssistant() {
  const [open,setOpen]=useState(false), [input,setInput]=useState(''), [busy,setBusy]=useState(false);
  const [messages,setMessages]=useState<ChatMessage[]>([{role:'assistant',text:'Hi! Tell me about your next trip. I can help you choose a RoadNest car or bike based on your plans and budget.'}]);
  async function send(value?:string) {
    const text=(value ?? input).trim(); if(!text || busy) return;
    setMessages(items=>[...items,{role:'user',text}]); setInput(''); setBusy(true);
    try { const result=await api<{answer:string;vehicles:SuggestedVehicle[]}>('/ai/assistant/chat',{method:'POST',body:JSON.stringify({message:text})}); setMessages(items=>[...items,{role:'assistant',text:result.answer,vehicles:result.vehicles||[]}]); }
    catch(e:any){setMessages(items=>[...items,{role:'assistant',text:e.message||'I could not reach the rental assistant. Please try again.'}]);}
    finally{setBusy(false);}
  }
  function submit(e:FormEvent){e.preventDefault();void send();}
  return <>
    <button className="ai-launcher" onClick={()=>setOpen(true)} aria-label="Open RoadNest AI rental assistant"><Sparkles size={17}/><span>Plan with AI</span></button>
    {open&&<div className="ai-chat-backdrop" onClick={()=>setOpen(false)}>
      <section className="ai-chat-panel" onClick={e=>e.stopPropagation()} aria-label="RoadNest rental assistant">
        <header className="ai-chat-header"><div className="ai-avatar"><Bot size={19}/></div><div><strong>RoadNest Assistant</strong><small>Rental planning · Powered by AI</small></div><button onClick={()=>setOpen(false)} aria-label="Close assistant"><X size={18}/></button></header>
        <div className="ai-chat-messages">{messages.map((m,i)=><div key={i} className={`ai-message ${m.role}`}><p>{m.text}</p>{m.vehicles?.length? <div className="ai-suggestions">{m.vehicles.map(v=><Link href={`/vehicles/${v.id}`} key={v.id} onClick={()=>setOpen(false)} className="ai-suggestion"><VehiclePhoto src={v.image} type={v.type} category={v.category} alt={v.displayName} className="ai-suggestion-photo"/><span><strong>{v.displayName}</strong><small>{v.category.replaceAll('_',' ')} · {v.fuelType}</small><b>{money(v.dailyRatePaise)} / day</b></span><ArrowRight size={15}/></Link>)}</div>:null}</div>)}
        {busy&&<div className="ai-typing"><LoaderCircle size={15}/> Finding a suitable ride…</div>}
        </div>
        <div className="ai-quick-prompts"><button onClick={()=>void send('Show me cars for a weekend trip')}>Weekend car</button><button onClick={()=>void send('Suggest bikes under ₹1,000 per day')}>Bikes under ₹1,000</button><button onClick={()=>void send('Compare family-friendly SUVs')}>Family SUV</button></div>
        <form className="ai-chat-form" onSubmit={submit}><input value={input} onChange={e=>setInput(e.target.value)} placeholder="Describe your rental plan…" maxLength={1200}/><button disabled={busy||!input.trim()} aria-label="Send message"><Send size={17}/></button></form>
        <small className="ai-disclaimer">Recommendations use RoadNest fleet listings. Availability is confirmed on each vehicle page before booking.</small>
      </section>
    </div>}
  </>;
}
