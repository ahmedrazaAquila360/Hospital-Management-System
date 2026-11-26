import {requirePermission} from '@/lib/auth/guard';
import {requestBranch,prisma} from '@/lib/prisma';
import {boardToken} from '@/server/waiting-board/token';
export const metadata={title:'Waiting board display'};
export default async function DisplaySettings(){
 await requirePermission('settings.edit');const branchId=await requestBranch();const branch=await prisma.branch.findUniqueOrThrow({where:{id:branchId}});
 let url:string|undefined;try{url='/waiting-board?display='+encodeURIComponent(boardToken(branchId));}catch{}
 return <div className="space-y-5"><h1 className="font-heading text-2xl font-semibold">Waiting board · {branch.name}</h1><div className="surface-card space-y-3 p-5"><p>Open this display on the lobby device. It shows tokens, doctors and departments and refreshes every 10 seconds. Switch your active branch to configure another display.</p>{url?<a className="text-primary underline break-all" href={url} target="_blank" rel="noreferrer">Open branch display</a>:<p role="status">Configure HOSPITAL_WAITING_BOARD_KEY to enable branch display links.</p>}<p className="text-sm text-muted-foreground">Treat the display link as a shared access link. Rotating the display key revokes all branch links. Verify readability and refresh on the actual lobby device before use.</p></div></div>;
}
