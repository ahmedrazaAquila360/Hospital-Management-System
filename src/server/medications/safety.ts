import { createHash } from "node:crypto";
import { z } from "zod";
const root = "https://rxnav.nlm.nih.gov/REST";
const idsSchema = z.object({idGroup: z.object({rxnormId: z.array(z.string().regex(/^\d+$/)).optional()})});
const ingredientsSchema = z.object({relatedGroup: z.object({conceptGroup: z.array(z.object({conceptProperties: z.array(z.object({rxcui: z.string(), name: z.string()})).optional()})).optional()})});
export type Identity = {name: string; rxcui: string; ingredients: {rxcui: string; name: string}[]};
async function json(url: string) {
  const response = await fetch(url, {signal: AbortSignal.timeout(5000), cache: "no-store"});
  if (!response.ok) throw new Error("Medicine terminology service unavailable.");
  return response.json();
}
export async function resolveMedicine(name: string): Promise<Identity | null> {
  // Exact active vocabulary match only; never accept an approximate guess as verified.
  const ids = idsSchema.parse(await json(`${root}/rxcui.json?name=${encodeURIComponent(name)}&search=0&allsrc=0`)).idGroup.rxnormId;
  if (ids?.length !== 1) return null;
  const groups = ingredientsSchema.parse(await json(`${root}/rxcui/${ids[0]}/related.json?tty=IN`)).relatedGroup.conceptGroup;
  const ingredients = groups?.flatMap(g=>g.conceptProperties ?? []) ?? [];
  return ingredients.length ? {name, rxcui: ids[0], ingredients} : null;
}
const normalized = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
export async function medicationReview(names: string[], allergies: string | null, resolve = resolveMedicine) {
  const warnings: string[] = [];
  const identities: Identity[] = [];
  const seen = new Map<string,string>();
  for (const name of names) {
    let identity: Identity | null = null;
    try { identity = await resolve(name); } catch { /* Never label a failed lookup safe. */ }
    if (!identity) { warnings.push(`${name}: identity or ingredients could not be verified. Confirm the medicine manually.`); continue; }
    identities.push(identity);
    for (const ingredient of identity.ingredients) {
      if (seen.has(ingredient.rxcui)) warnings.push(`${name} and ${seen.get(ingredient.rxcui)} contain ${ingredient.name}; review duplicate therapy.`);
      seen.set(ingredient.rxcui,name);
      if (allergies && (` ${normalized(allergies)} `).includes(` ${normalized(ingredient.name)} `)) warnings.push(`${name}: recorded allergy text mentions ${ingredient.name}. Review before prescribing.`);
    }
  }
  if (allergies) warnings.push("Recorded allergies require clinician review. Free-text matching cannot rule out allergy classes or cross-reactivity.");
  const result = {source: "NLM RxNorm", checkedAt: new Date().toISOString(), identities, warnings,
    limitation: "Ingredient identity and duplicate-ingredient checks only. Interactions, dose suitability and allergy cross-reactivity are not evaluated."};
  // Bind acknowledgement to the complete submitted regimen and current allergy text in the action.
  const fingerprint = createHash("sha256").update(JSON.stringify({names, allergies, identities, warnings})).digest("hex");
  return {result, fingerprint};
}
