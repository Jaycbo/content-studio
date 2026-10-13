import { sqliteTable, text, integer, primaryKey, index } from 'drizzle-orm/sqlite-core';
export const references = sqliteTable('reference_library', {
 id: text('id').primaryKey(), url: text('url').notNull(), creator: text('creator').notNull(),
 caption: text('caption').notNull(), note: text('note').notNull(), reason: text('reason').notNull(),
 audio: text('audio').notNull(), savedAt: integer('saved_at').notNull(), expiresAt: integer('expires_at').notNull(),
 savedBy: text('saved_by').notNull()
}, table=>[index('reference_expiry').on(table.expiresAt)]);
export const assignments = sqliteTable('reference_assignments', {
 referenceId: text('reference_id').notNull().references(()=>references.id,{onDelete:'cascade'}),
 modelId: text('model_id').notNull(), modelName: text('model_name').notNull(), used: integer('used').notNull().default(0)
}, table=>[primaryKey({columns:[table.referenceId,table.modelId]}),index('assignment_model').on(table.modelId)]);
