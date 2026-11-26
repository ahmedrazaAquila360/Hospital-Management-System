import {PublicWaitingBoard} from "@/components/appointments/public-waiting-board";
export const metadata={title:"Waiting board"};
export default async function WaitingBoard({searchParams}:{searchParams:Promise<{display?:string}>}){const {display}=await searchParams;return <main className="mx-auto max-w-5xl space-y-5 p-6"><h1 className="font-heading text-3xl font-semibold">Waiting board</h1><PublicWaitingBoard display={display}/></main>}
