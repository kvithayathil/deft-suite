import type { CatalogSearchResult, CatalogSkill } from './types.js';

const NAME_WEIGHT = 2;
const DESCRIPTION_WEIGHT = 1;
const TAG_WEIGHT = 1.5;

export function searchCatalog(
  skills: CatalogSkill[],
  query: string,
  catalogName: string,
): CatalogSearchResult[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) {
    return [];
  }

  return skills
    .map((skill) => {
      let score = 0;
      const nameLower = skill.name.toLowerCase();
      const descriptionLower = skill.description.toLowerCase();
      const tagsLower = (skill.tags ?? []).map((tag) => tag.toLowerCase());

      for (const term of terms) {
        if (nameLower.includes(term)) {
          score += NAME_WEIGHT;
        }
        if (descriptionLower.includes(term)) {
          score += DESCRIPTION_WEIGHT;
        }
        if (tagsLower.some((tag) => tag.includes(term))) {
          score += TAG_WEIGHT;
        }
      }

      return {
        name: skill.name,
        description: skill.description,
        source: skill.source,
        catalogName,
        score,
      } satisfies CatalogSearchResult;
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.name.localeCompare(b.name);
    });
}
