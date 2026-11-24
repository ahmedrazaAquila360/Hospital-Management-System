import "server-only";
import {prisma,requestBranch} from "@/lib/prisma";
import {effectivePermissions} from "@/lib/permissions";

export async function guardianReviewers(){
 const branchId=await requestBranch();
 const users=await prisma.user.findMany({where:{status:"ACTIVE",branchMemberships:{some:{branchId,active:true}}},select:{id:true,name:true,role:{select:{name:true,permissions:{select:{permission:{select:{key:true}}}}}},permissionOverrides:{select:{granted:true,permission:{select:{key:true}}}}},orderBy:{name:"asc"}});
 return users.filter(u=>effectivePermissions(u.role.name,u.role.permissions.map(p=>p.permission.key),u.permissionOverrides.map(p=>({key:p.permission.key,granted:p.granted}))).includes("billing.guardian")).map(u=>({id:u.id,name:u.name}));
}
