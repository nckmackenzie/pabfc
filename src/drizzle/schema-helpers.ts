import { boolean, timestamp, varchar } from 'drizzle-orm/pg-core'
import { nanoid } from 'nanoid'

export const id = varchar('id')
  .primaryKey()
  .$defaultFn(() => nanoid())

export const active = boolean('active').notNull().default(true)
export const createdAt = timestamp('created_at', { withTimezone: true })
  .notNull()
  .defaultNow()
export const updatedAt = timestamp('updated_at', { withTimezone: true })
  .notNull()
  .defaultNow()
  .$onUpdate(() => new Date())
