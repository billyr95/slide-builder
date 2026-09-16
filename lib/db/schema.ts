import { pgTable, uuid, text, timestamp, jsonb, boolean, integer, doublePrecision, pgEnum, index } from 'drizzle-orm/pg-core'

export const roleEnum = pgEnum('role', ['admin', 'member'])
export const orientationEnum = pgEnum('orientation', ['landscape', 'portrait'])

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: roleEnum('role').notNull().default('member'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const slides = pgTable('slides', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull().default('Untitled Slide'),
  // Which canvas shape this slide was last being edited/previewed in --
  // a single slide's content can be exported as either, this is just a
  // remembered preference so reopening a portrait slide doesn't silently
  // default back to the landscape preview.
  orientation: orientationEnum('orientation').notNull().default('landscape'),
  // Full editor state (SlideData) -- text fields, image data URLs, every
  // font/size/position setting. One JSONB blob rather than a flattened
  // column-per-field schema, since SlideData's shape evolves often (new
  // style fields have been added repeatedly) and every read/write already
  // goes through the same TS type either way.
  data: jsonb('data').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index('slides_user_id_idx').on(table.userId),
}))

export const trainingSourceEnum = pgEnum('training_source', ['upload', 'live'])

// Flattened to mirror TrainEntry / the existing merge_and_explore.py CSV
// columns directly (image_1_type, title_font_size_px, etc.) rather than one
// JSONB blob, since this table is meant to be queried/exported for training
// analysis, not just round-tripped through the app's own UI.
export const trainingEntries = pgTable('training_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  source: trainingSourceEnum('source').notNull(),

  screenType: text('screen_type').notNull(),
  orientation: text('orientation').notNull(),
  hasLabel: boolean('has_label').notNull().default(false),
  hasLogos: boolean('has_logos').notNull().default(false),
  hasQrCode: boolean('has_qr_code').notNull().default(false),

  label: text('label').notNull().default(''),
  title: text('title').notNull().default(''),
  titleFont: text('title_font'),
  titleItalic: boolean('title_italic').notNull().default(false),
  subtitle: text('subtitle').notNull().default(''),
  subtitleWeight: text('subtitle_weight'),
  subtitle2: text('subtitle2').notNull().default(''),
  presenters: text('presenters').notNull().default(''),
  presentersFont: text('presenters_font'),
  presentersItalic: boolean('presenters_italic').notNull().default(false),
  programTitle: text('program_title').notNull().default(''),
  programTitleFont: text('program_title_font'),
  programTitleItalic: boolean('program_title_italic').notNull().default(false),

  // Which side the image sits on vs. the text block -- see SlideData.imageSide.
  imageSide: text('image_side').notNull().default('left'),

  seriesName: text('series_name').notNull().default(''),
  listeningCredit: text('listening_credit').notNull().default(''),
  backgroundColor: text('background_color').notNull().default(''),
  textColor: text('text_color').notNull().default(''),

  imageCount: integer('image_count').notNull().default(0),
  image1Type: text('image_1_type'),
  image1PositionX: doublePrecision('image_1_position_x'),
  image1PositionY: doublePrecision('image_1_position_y'),
  image1WidthRatio: doublePrecision('image_1_width_ratio'),
  image1HeightRatio: doublePrecision('image_1_height_ratio'),
  // "none" or {top,bottom,left,right} -- see TrainEntry's own comment on why
  // x/y and crop usually can't be populated for 'live' entries.
  image1Crop: jsonb('image_1_crop'),
  // Did the user manually move the size slider away from the heuristic's
  // suggestion for this image? (single boolean, not a full suggested-vs-
  // final position pair -- the suggestion is a whole {x,y,width,height,crop}
  // object, not one comparable number like the font sizes below.)
  imagePositionWasOverridden: boolean('image_position_was_overridden'),

  // Suggested (from suggestTitleFontSize/suggestSubtitleFontSize), final
  // (the real slider value at export time), and whether the user manually
  // overrode the suggestion -- lets future analysis see exactly where the
  // heuristic was wrong without re-deriving it. Null suggested/wasOverridden
  // for 'upload' entries (no heuristic runs there) or when no heuristic
  // value was ever computed for this field (e.g. no subtitle present).
  titleFontSizeSuggestedPx: integer('title_font_size_suggested_px'),
  titleFontSizeFinalPx: integer('title_font_size_final_px'),
  titleFontSizeWasOverridden: boolean('title_font_size_was_overridden'),
  subtitleFontSizeSuggestedPx: integer('subtitle_font_size_suggested_px'),
  subtitleFontSizeFinalPx: integer('subtitle_font_size_final_px'),
  subtitleFontSizeWasOverridden: boolean('subtitle_font_size_was_overridden'),
  subtitle2FontSizeFinalPx: integer('subtitle2_font_size_final_px'),

  // Attached image files (base64 data URLs) for 'upload' entries, and any
  // other fields with no fixed column above (matches TrainEntry.liveStyle).
  images: jsonb('images').notNull().default([]),
  liveStyle: jsonb('live_style'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index('training_entries_user_id_idx').on(table.userId),
}))
