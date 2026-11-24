import { AsyncLocalStorage } from "node:async_hooks";
import { basePrisma } from "./prisma-base";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";

// Branch isolation is enforced by PostgreSQL, including nested relations and raw SQL.
// Only authentication and branch membership management may use prisma-base directly.
const branchContext = new AsyncLocalStorage<string>();
export function withBranch<T>(branchId: string, work: () => T): T {
  return branchContext.run(branchId, work);
}
export async function requestBranch(): Promise<string> {
  const explicit = branchContext.getStore();
  if (explicit) return explicit;
  let token: string | undefined;
  try {
    const { cookies } = await import("next/headers");
    token = (await cookies()).get("hospital_session")?.value;
  } catch (error) {
    // CLI scripts and tests have no request; their scope is the original branch.
    if (!String(error).includes("outside a request scope")) throw error;
  }
  if (!token) return "branch-main"; // Existing public booking uses the original branch.
  const session = await basePrisma.session.findUnique({where: {sessionToken: token}, include: {user: {select: {status: true}}}});
  if (!session || session.expires <= new Date() || session.user.status !== "ACTIVE") throw new Error("Session expired.");
  const membership = await basePrisma.branchMembership.findUnique({where: {userId_branchId: {userId: session.userId, branchId: session.activeBranchId}}});
  if (!membership?.active) throw new Error("Active branch access has been revoked. Sign in again.");
  return session.activeBranchId;
}
async function scoped<T>(work: (tx: Prisma.TransactionClient) => Promise<T>, options?: {maxWait?: number; timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel}) {
  const branch = await requestBranch();
  return basePrisma.$transaction(async tx => {
    await tx.$executeRawUnsafe("SET LOCAL ROLE hospital_branch_runtime");
    await tx.$queryRaw`SELECT set_config('hospital.branch_id', ${branch}, true)`;
    return work(tx);
  }, {maxWait: 10000, timeout: 20000, ...options});
}
type Operation = (tx: Prisma.TransactionClient) => Promise<unknown>;
const operation = Symbol("branch-operation");
// Defer execution so the existing $transaction([query, ...]) calls stay atomic.
function deferred(run: Operation) {
  let promise: Promise<unknown> | undefined;
  const execute = () => promise ??= scoped(run);
  return {
    [operation]: run,
    then: (resolve: (value: unknown) => unknown, reject?: (error: unknown) => unknown) => execute().then(resolve,reject),
    catch: (reject: (error: unknown) => unknown) => execute().catch(reject),
    finally: (done: () => void) => execute().finally(done),
    [Symbol.toStringTag]: "PrismaPromise",
  };
}
function invoke(target: unknown, method: PropertyKey, args: unknown[]): Promise<unknown> {
  const fn = Reflect.get(target as object, method) as (...args: unknown[]) => Promise<unknown>;
  return fn.apply(target,args);
}
export const prisma = new Proxy(basePrisma, {
  get(target, key) {
    if (key === "$transaction") return (input: Operation | ReturnType<typeof deferred>[], options?: Parameters<typeof scoped>[1]) => scoped(async tx => {
      if (typeof input === "function") return input(tx);
      const results = [];
      for (const item of input) {
        if (!item[operation]) throw new Error("Only unexecuted branch queries can be batched.");
        results.push(await item[operation](tx));
      }
      return results;
    },options);
    if (typeof key === "string" && ["$queryRaw","$executeRaw","$queryRawUnsafe","$executeRawUnsafe"].includes(key)) {
      return (...args: unknown[]) => deferred(tx => invoke(tx,key,args));
    }
    const value = Reflect.get(target,key);
    if (typeof key === "string" && !key.startsWith("$") && !key.startsWith("_") && value && typeof value === "object") {
      return new Proxy(value, {get(_model, method) {
        return (...args: unknown[]) => deferred(tx => invoke(Reflect.get(tx,key),method,args));
      }});
    }
    return typeof value === "function" ? value.bind(target) : value;
  },
}) as PrismaClient;
