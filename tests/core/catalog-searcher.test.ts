import { describe, expect, it } from 'vitest';
import { searchCatalog } from '../../src/core/catalog-searcher.js';
import type { CatalogSkill } from '../../src/core/types.js';

describe('searchCatalog', () => {
  const catalogName = 'community';

  const skills: CatalogSkill[] = [
    {
      name: 'alpha-toolkit',
      description: 'Build reliable integrations quickly',
      tags: ['integration', 'backend'],
      source: { type: 'github', repo: 'acme/alpha' },
    },
    {
      name: 'beta-checks',
      description: 'Integration quality checks for backend reliability',
      tags: ['testing', 'quality'],
      source: { type: 'url', url: 'https://example.com/beta' },
    },
    {
      name: 'gamma-ops',
      description: 'Operational runbooks and incident helpers',
      tags: ['operations', 'incident'],
      source: { type: 'path', path: '/tmp/gamma' },
    },
  ];

  it('scores matches in name, description, and tags with expected weighting', () => {
    const results = searchCatalog(skills, 'alpha integration', catalogName);

    expect(results).toHaveLength(2);
    expect(results[0].name).toBe('alpha-toolkit');
    expect(results[0].score).toBe(4.5);
    expect(results[1].name).toBe('beta-checks');
    expect(results[1].score).toBe(1);
  });

  it('supports multi-term scoring and deterministic tie sort order', () => {
    const tieSkills: CatalogSkill[] = [
      {
        name: 'zeta',
        description: 'alpha beta helper',
        source: { type: 'github', repo: 'acme/zeta' },
      },
      {
        name: 'delta',
        description: 'alpha beta helper',
        source: { type: 'github', repo: 'acme/delta' },
      },
    ];

    const results = searchCatalog(tieSkills, 'alpha beta', catalogName);
    expect(results).toHaveLength(2);
    expect(results[0].score).toBe(2);
    expect(results[1].score).toBe(2);
    expect(results.map((r) => r.name)).toEqual(['delta', 'zeta']);
  });

  it('returns empty for empty query', () => {
    expect(searchCatalog(skills, '   ', catalogName)).toEqual([]);
  });

  it('returns empty for no-match query', () => {
    expect(searchCatalog(skills, 'nonexistent', catalogName)).toEqual([]);
  });

  it('maps catalog name and source in results', () => {
    const results = searchCatalog(skills, 'incident', catalogName);

    expect(results).toHaveLength(1);
    expect(results[0].catalogName).toBe(catalogName);
    expect(results[0].source).toEqual({ type: 'path', path: '/tmp/gamma' });
  });
});
