/**
 * @deprecated Import from '../schema' and '../adapters' instead
 */
export { postgresSchema as Schema } from '../schema/index.js';

/**
 * @deprecated Use DatabaseAdapter from '../adapters' instead
 */
export type Drizzle = any;

/**
 * @deprecated Use createAdapter from '../adapters' instead
 */
export const createClient = () => {
  throw new Error(
    'createClient is deprecated. Use createAdapter from @workflow/world-sql/adapters instead'
  );
};
