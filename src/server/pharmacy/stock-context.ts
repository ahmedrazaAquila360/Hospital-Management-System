import 'server-only';
import type {Prisma} from '@/generated/prisma/client';
export async function stockContext(tx:Prisma.TransactionClient,actorId:string,kind:'RECEIVE'|'DISPENSE'|'SALE_RETURN'|'PURCHASE_RETURN'|'ADJUST',sourceId='',reason=''){
 await tx.$queryRaw`SELECT set_config('hospital.stock_actor',${actorId},true),set_config('hospital.stock_kind',${kind},true),set_config('hospital.stock_source',${sourceId},true),set_config('hospital.stock_reason',${reason},true)`;
}
