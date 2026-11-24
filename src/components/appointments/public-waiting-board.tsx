"use client";
import {useEffect,useState} from "react";
type Queue={token:number;status:string|null;doctor:string|undefined;department:string};
export function PublicWaitingBoard(){
 const [queue,setQueue]=useState<Queue[]>([]);const [day,setDay]=useState("");const [error,setError]=useState(false);
 useEffect(()=>{let alive=true;async function refresh(){try{const response=await fetch('/api/waiting-board',{cache:'no-store'});if(!response.ok)throw Error();const data=await response.json();if(alive){setQueue(data.queue);setDay(data.day);setError(false)}}catch{if(alive)setError(true)}}refresh();const timer=setInterval(refresh,10000);return()=>{alive=false;clearInterval(timer)}},[]);
 return <div className="surface-card p-6"><p className="text-muted-foreground text-sm">{day} · Updates every 10 seconds</p>{error&&<p role="status">Queue connection unavailable. Retrying.</p>}<table className="mt-4 w-full text-left"><thead><tr><th>Token</th><th>Doctor</th><th>Department</th><th>Status</th></tr></thead><tbody>{queue.map(row=><tr key={row.token} className="border-t"><td className="py-3 font-bold">{row.token}</td><td>{row.doctor}</td><td>{row.department}</td><td>{row.status==="IN_PROGRESS"?"Called":"Waiting"}</td></tr>)}</tbody></table>{!queue.length&&<p className="mt-4">No tokens waiting.</p>}</div>;
}
