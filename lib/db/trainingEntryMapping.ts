import { TrainEntry } from '../trainTypes'
import { trainingEntries } from './schema'

type Row = typeof trainingEntries.$inferSelect
type NewRow = typeof trainingEntries.$inferInsert

// TrainEntry (the app's in-memory/client shape) <-> training_entries row
// (flattened columns, mirroring the existing merge_and_explore.py CSV
// conventions). `userId` is intentionally a separate param, never read off
// the client-supplied entry -- it always comes from the authenticated
// session, never trusted from the request body.
export function trainEntryToRow(entry: Partial<TrainEntry>, userId: string): NewRow {
  const crop = entry.images?.[0] ? undefined : undefined // placeholder, image_1_crop isn't on TrainEntry directly (see comment there)
  return {
    userId,
    source: entry.source ?? 'live',
    screenType: entry.screenType ?? 'projector',
    orientation: entry.orientation ?? 'landscape',
    hasLabel: entry.hasLabel ?? false,
    hasLogos: entry.hasLogos ?? false,
    hasQrCode: entry.hasQrCode ?? false,
    label: entry.label ?? '',
    title: entry.title ?? '',
    titleFont: entry.titleFont ?? null,
    titleItalic: entry.titleItalic ?? false,
    subtitle: entry.subtitle ?? '',
    subtitleWeight: entry.subtitleWeight ?? null,
    subtitle2: entry.subtitle2 ?? '',
    presenters: entry.presenters ?? '',
    presentersFont: entry.presentersFont ?? null,
    presentersItalic: entry.presentersItalic ?? false,
    programTitle: entry.programTitle ?? '',
    programTitleFont: entry.programTitleFont ?? null,
    programTitleItalic: entry.programTitleItalic ?? false,
    seriesName: entry.seriesName ?? '',
    listeningCredit: entry.listeningCredit ?? '',
    backgroundColor: entry.backgroundColor ?? '',
    textColor: entry.textColor ?? '',
    imageCount: entry.imageCount ?? 0,
    image1Type: null, // not classified by this app yet -- see TrainEntry's own comment
    image1PositionX: null,
    image1PositionY: null,
    image1WidthRatio: entry.imageWidthRatio ?? null,
    image1HeightRatio: entry.imageHeightRatio ?? null,
    image1Crop: crop ?? null,
    imagePositionWasOverridden: entry.imagePositionWasOverridden ?? null,
    titleFontSizeSuggestedPx: entry.titleFontSizeSuggestedPx ?? null,
    titleFontSizeFinalPx: entry.titleFontSizePx ?? null,
    titleFontSizeWasOverridden: entry.titleFontSizeWasOverridden ?? null,
    subtitleFontSizeSuggestedPx: entry.subtitleFontSizeSuggestedPx ?? null,
    subtitleFontSizeFinalPx: entry.subtitleFontSizePx ?? null,
    subtitleFontSizeWasOverridden: entry.subtitleFontSizeWasOverridden ?? null,
    subtitle2FontSizeFinalPx: entry.subtitle2FontSizePx ?? null,
    images: entry.images ?? [],
    liveStyle: entry.liveStyle ?? null,
  }
}

export function rowToTrainEntry(row: Row): TrainEntry {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    source: row.source,
    screenType: row.screenType as TrainEntry['screenType'],
    orientation: row.orientation as TrainEntry['orientation'],
    hasLabel: row.hasLabel,
    hasLogos: row.hasLogos,
    hasQrCode: row.hasQrCode,
    label: row.label,
    title: row.title,
    titleFont: (row.titleFont ?? '92NY') as TrainEntry['titleFont'],
    titleItalic: row.titleItalic,
    subtitle: row.subtitle,
    subtitleWeight: (row.subtitleWeight ?? 'regular') as TrainEntry['subtitleWeight'],
    subtitle2: row.subtitle2,
    presenters: row.presenters,
    presentersFont: (row.presentersFont ?? 'Theinhardt') as TrainEntry['presentersFont'],
    presentersItalic: row.presentersItalic,
    programTitle: row.programTitle,
    programTitleFont: (row.programTitleFont ?? 'Theinhardt') as TrainEntry['programTitleFont'],
    programTitleItalic: row.programTitleItalic,
    seriesName: row.seriesName,
    listeningCredit: row.listeningCredit,
    backgroundColor: row.backgroundColor,
    textColor: row.textColor,
    images: (row.images as TrainEntry['images']) ?? [],
    imageCount: row.imageCount,
    titleFontSizePx: row.titleFontSizeFinalPx ?? undefined,
    subtitleFontSizePx: row.subtitleFontSizeFinalPx ?? undefined,
    subtitle2FontSizePx: row.subtitle2FontSizeFinalPx ?? undefined,
    titleFontSizeSuggestedPx: row.titleFontSizeSuggestedPx ?? undefined,
    titleFontSizeWasOverridden: row.titleFontSizeWasOverridden ?? undefined,
    subtitleFontSizeSuggestedPx: row.subtitleFontSizeSuggestedPx ?? undefined,
    subtitleFontSizeWasOverridden: row.subtitleFontSizeWasOverridden ?? undefined,
    imageWidthRatio: row.image1WidthRatio ?? undefined,
    imageHeightRatio: row.image1HeightRatio ?? undefined,
    imagePositionWasOverridden: row.imagePositionWasOverridden ?? undefined,
    liveStyle: (row.liveStyle as Record<string, unknown>) ?? undefined,
  }
}
