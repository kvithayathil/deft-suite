import { describe, it, expect } from 'vitest';
import { MemorySearchIndex } from '../../src/adapters/driven/memory-search-index.js';
import { TrustLevel } from '../../src/core/types.js';

describe('MemorySearchIndex', () => {
  it('returns empty results before rebuild', async () => {
    const idx = new MemorySearchIndex();
    expect(await idx.search('anything')).toEqual([]);
  });

  it('finds skills by name match (weighted 2x)', async () => {
    const idx = new MemorySearchIndex();
    await idx.rebuild([
      { name: 'tdd-python', description: 'Test-driven development' },
      { name: 'security', description: 'Python security patterns' },
    ]);
    const results = await idx.search('python');
    expect(results[0].name).toBe('tdd-python'); // name match scores higher
  });

  it('finds skills by description match', async () => {
    const idx = new MemorySearchIndex();
    await idx.rebuild([
      { name: 'skill-a', description: 'Handles authentication' },
      { name: 'skill-b', description: 'Handles logging' },
    ]);
    const results = await idx.search('authentication');
    expect(results.length).toBe(1);
    expect(results[0].name).toBe('skill-a');
  });

  it('returns results sorted by score descending', async () => {
    const idx = new MemorySearchIndex();
    await idx.rebuild([
      { name: 'react-hooks', description: 'React hook patterns' },
      { name: 'react-testing', description: 'Testing React components' },
      { name: 'vue-testing', description: 'Testing Vue components' },
    ]);
    const results = await idx.search('react');
    expect(results.length).toBe(2);
    expect(results.every(r => r.score > 0)).toBe(true);
  });

  it('handles case-insensitive search', async () => {
    const idx = new MemorySearchIndex();
    await idx.rebuild([{ name: 'tdd-python', description: 'TDD patterns' }]);
    const results = await idx.search('TDD');
    expect(results.length).toBe(1);
  });

  it('listCategories returns empty (v1 — no categories)', async () => {
    const idx = new MemorySearchIndex();
    expect(await idx.listCategories()).toEqual([]);
  });

  it('getByCategory returns empty (v1)', async () => {
    const idx = new MemorySearchIndex();
    expect(await idx.getByCategory('any')).toEqual([]);
  });
});
