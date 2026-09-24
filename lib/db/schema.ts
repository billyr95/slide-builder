import { pgTable, uuid, text, timestamp, jsonb, boolean, integer, doublePrecision, pgEnum, index, AnyPgColumn } from 'drizzle-orm/pg-core'

export const roleEnum = pgEnum('role', ['admin', 'member'])
export const orientationEnum = pgEnum('orientation', ['landscape', 'portrait'])

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: roleEnum('role').notNull().default('member'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// A file-system-style tree for organizing shared slides. Exactly one row
// has parentFolderId null -- the seeded "All Slides" root every browsing
// path starts from (see the migration that seeds it and backfills every
// pre-existing slide into it, so nothing becomes orphaned/invisible).
// Folders are shared/org-wide same as slides: any logged-in user can
// create one or move a slide into one, consistent with the rest of the
// access model -- there's no per-user ownership check anywhere on this
// table, createdBy is metadata only.
export const folders = pgTable('folders', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  // Self-referencing FK -- typed via a lazy callback (AnyPgColumn) since
  // `folders` isn't done being defined yet at the point this column
  // literal is evaluated. onDelete cascade matches ordinary file-system
  // behavior (deleting a folder takes its subfolders with it); there's no
  // delete-folder UI yet, so this only matters for a future one or a
  // manual DB edit.
  parentFolderId: uuid('parent_folder_id').references((): AnyPgColumn => folders.id, { onDelete: 'cascade' }),
  createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  parentFolderIdIdx: index('folders_parent_folder_id_idx').on(table.parentFolderId),
}))

export const slides = pgTable('slides', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Slides are shared/org-wide -- every logged-in user can view and edit
  // every slide, this column is no longer an access-control boundary.
  // Kept purely as "who originally created this" metadata (shown as
  // "Created by ..." in the dashboard/editor).
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // Nullable at the DB level as a safety net (onDelete set null -- moving
  // or deleting a folder never destroys a slide), but application code
  // always resolves a concrete folder on create (falling back to the root
  // "All Slides" folder), so this is effectively always populated.
  folderId: uuid('folder_id').references(() => folders.id, { onDelete: 'set null' }),
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
  // Lightweight "someone has this open" heartbeat -- who last pinged the
  // editor's heartbeat endpoint for this slide, and when. Refreshed every
  // autosave tick while a user has the editor open; treated as stale (see
  // lib/activeEditorTracking.ts's ACTIVE_EDITOR_WINDOW_MS) after a couple
  // minutes of no refresh. Advisory only -- never blocks a save, just
  // powers the "X is currently editing this" banner for a second opener.
  activeEditorId: uuid('active_editor_id').references(() => users.id, { onDelete: 'set null' }),
  activeEditorAt: timestamp('active_editor_at', { withTimezone: true }),
}, (table) => ({
  userIdIdx: index('slides_user_id_idx').on(table.userId),
  folderIdIdx: index('slides_folder_id_idx').on(table.folderId),
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

  // Slide-level layout ground truth, populated only for 'live' entries (the
  // editor is the only place these are ever actually set) -- null for
  // 'upload' entries. See inferred_image_side/inferred_text_align etc. below
  // for the vision-estimated counterpart for those.
  textAlign: text('text_align'),
  imagesLinkedSize: boolean('images_linked_size'),
  presentersMatchTitleSize: boolean('presenters_match_title_size'),
  programTitleMatchTitleSize: boolean('program_title_match_title_size'),
  // Vertical render order of the text blocks (SlideData.blockOrder) -- an
  // ordered array of a handful of known block-key strings, e.g.
  // ["label","title","programTitle","presenters"]. 'live' only, same as the
  // three booleans above.
  blockOrder: jsonb('block_order'),

  seriesName: text('series_name').notNull().default(''),
  listeningCredit: text('listening_credit').notNull().default(''),
  backgroundColor: text('background_color').notNull().default(''),
  // Legacy single "all text" color -- superseded by the per-field columns
  // below for 'live' entries (always populated there). See TrainEntry's own
  // comment.
  textColor: text('text_color').notNull().default(''),
  labelColor: text('label_color'),
  titleColor: text('title_color'),
  subtitleColor: text('subtitle_color'),
  subtitle2Color: text('subtitle2_color'),
  presentersColor: text('presenters_color'),
  programTitleColor: text('program_title_color'),
  seriesNameColor: text('series_name_color'),
  listeningCreditColor: text('listening_credit_color'),

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

  // Client-side face-detection results (lib/faceDetect.ts), scoped to image
  // 1 -- same convention as image1WidthRatio/image1HeightRatio above.
  // Populated for BOTH sources (unlike inferred_image_side etc. below,
  // which need a full batch round-trip, this app runs real detection
  // directly at upload time in either flow).
  image1FaceDetected: boolean('image_1_face_detected'),
  // 'live' only: {top,bottom,left,right} ratio boxes, same shape as
  // image1Crop above -- the auto-computed suggestion, and whatever the user
  // ultimately ended up with (equal to suggested until manually re-cropped).
  image1FaceCropSuggested: jsonb('image_1_face_crop_suggested'),
  image1FaceCropFinal: jsonb('image_1_face_crop_final'),
  image1FaceCropWasOverridden: boolean('image_1_face_crop_was_overridden'),
  // Not yet populated by any code path -- needs the model's own image_type
  // from its batch response, which nothing here parses back in yet (same
  // not-yet-wired state as inferred_image_side below). Reserved for a
  // future step that flags entries where image1FaceDetected and the
  // model's "face" classification disagree.
  image1FaceDetectionMismatch: boolean('image_1_face_detection_mismatch'),

  // Per-stagger-image placement ground truth ('live' only, up to 4 slots --
  // single-image mode has no equivalent, see image1WidthRatio/HeightRatio
  // above instead). Unbottled from the old liveStyle.staggerImagePlacements
  // JSON blob into individually queryable columns, matching every other
  // structured field instead of relying on a model (or a query) to read
  // values back out of a stringified blob.
  image1Y: integer('image_1_y'),
  image1Scale: integer('image_1_scale'),
  image1ZIndex: integer('image_1_z_index'),
  image2Y: integer('image_2_y'),
  image2Scale: integer('image_2_scale'),
  image2ZIndex: integer('image_2_z_index'),
  image3Y: integer('image_3_y'),
  image3Scale: integer('image_3_scale'),
  image3ZIndex: integer('image_3_z_index'),
  image4Y: integer('image_4_y'),
  image4Scale: integer('image_4_scale'),
  image4ZIndex: integer('image_4_z_index'),

  // Vision-model-estimated counterparts of textAlign/imagesLinkedSize/
  // presentersMatchTitleSize/imageSide, for 'upload' entries -- old slides
  // have no ground truth for these, so the model infers them from the
  // rendered image instead (see trainExport.ts's buildEstimatePrompt).
  // Columns exist so a future results-parsing step has somewhere to write;
  // nothing currently populates them, same not-yet-wired state as
  // image1Type/image1PositionX/image1PositionY above.
  inferredImageSide: text('inferred_image_side'),
  inferredTextAlign: text('inferred_text_align'),
  inferredSizesAppearMatched: boolean('inferred_sizes_appear_matched'),
  inferredPresentersSizeMatchesTitle: boolean('inferred_presenters_size_matches_title'),

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
