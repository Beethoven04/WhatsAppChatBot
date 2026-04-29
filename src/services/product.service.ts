import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { productSchema, type Product, type ProductRepository } from '../types/product.types';

export class JsonProductRepository implements ProductRepository {
  private cache: Product[] | null = null;

  constructor(private readonly filePath: string) {}

  private async loadProducts(): Promise<Product[]> {
    if (this.cache) return this.cache;
    const raw = await readFile(this.filePath, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    const products = productSchema.array().parse(parsed);
    this.cache = products;
    return products;
  }

  public async search(query: string): Promise<Product[]> {
    const products = await this.loadProducts();
    const q = query.toLowerCase();
    return products
      .filter((p) =>
        [p.name, p.category, p.description, p.gender, p.material, ...p.style_tags, ...p.color_options]
          .join(' ')
          .toLowerCase()
          .includes(q)
      )
      .slice(0, 8);
  }

  public async getById(id: string): Promise<Product | null> {
    const products = await this.loadProducts();
    return products.find((p) => p.product_id === id) ?? null;
  }

  public async getAll(): Promise<Product[]> {
    return this.loadProducts();
  }

  public async getByCategory(category: string): Promise<Product[]> {
    const products = await this.loadProducts();
    const c = category.toLowerCase();
    return products.filter((p) => p.category.toLowerCase() === c);
  }
}

/**
 * Factory for active repository implementation.
 * Swap data source by changing this single function.
 *
 * Shopify drop-in guide:
 * 1) Create `ShopifyProductRepository implements ProductRepository`.
 * 2) Query Shopify Admin API endpoint: `/admin/api/2024-01/products.json`.
 * 3) Authenticate with `X-Shopify-Access-Token` and your shop domain.
 * 4) Map Shopify fields to `Product`:
 *    - `id` -> `product_id`
 *    - `title` -> `name`
 *    - `product_type` -> `category`
 *    - `variants[0].price` -> `price`
 *    - `variants[0].inventory_quantity` -> `stock_quantity`
 *    - `body_html` sanitized to plain text -> `description`
 *    - `options`/metafields -> `size_options`/`color_options`/`style_tags`
 * 5) Return normalized `Product[]` so handlers/services stay unchanged.
 */
export const createProductRepository = (): ProductRepository =>
  new JsonProductRepository(path.resolve(process.cwd(), 'data/products.json'));
