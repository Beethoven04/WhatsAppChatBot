import { z } from 'zod';

export const productSchema = z.object({
  product_id: z.string(),
  name: z.string(),
  gender: z.string(),
  category: z.string(),
  price: z.number(),
  currency: z.string(),
  material: z.string(),
  stock_quantity: z.number().int(),
  care_instructions: z.string(),
  color_options: z.array(z.string()),
  size_options: z.array(z.string()),
  description: z.string(),
  style_tags: z.array(z.string())
});

export type Product = z.infer<typeof productSchema>;

export interface ProductRepository {
  search(query: string): Promise<Product[]>;
  getById(id: string): Promise<Product | null>;
  getAll(): Promise<Product[]>;
  getByCategory(category: string): Promise<Product[]>;
}
