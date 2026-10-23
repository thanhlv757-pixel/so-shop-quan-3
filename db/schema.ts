import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
export const shopState = sqliteTable('shop_state', {
  owner: text('owner').primaryKey(),
  revision: integer('revision').notNull().default(0),
  payload: text('payload').notNull(),
  updatedAt: text('updated_at').notNull(),
});
