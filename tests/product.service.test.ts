import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { JsonProductRepository } from '../src/services/product.service';

describe('JsonProductRepository', () => {
  const repository = new JsonProductRepository(path.resolve(process.cwd(), 'data/products.json'));

  it('loads all products', async () => {
    const all = await repository.getAll();
    expect(all.length).toBeGreaterThan(80);
  });

  it('searches products by query', async () => {
    const results = await repository.search('jacket');
    expect(results.length).toBeGreaterThan(0);
  });
});
