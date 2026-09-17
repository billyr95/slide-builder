import { TrainEntry } from '../trainTypes'
import { trainingEntries } from './schema'

type Row = typeof trainingEntries.$inferSelect
type NewRow = typeof trainingEntries.$inferInsert

// TrainEntry.imagePlacements is a compacted array (one entry per attached
// image, in order -- same convention already used for the "images" array in
// the batch prompt), but the DB stores it as fixed image1../image4.. columns
// like every other per-image field. These two helpers are the only place
// that shape conversion happens.
function flattenImagePlacements(placements: TrainEntry['imagePlacements']) {
  const slots = [0, 1, 2, 3].map(i => placements?.[i])
  return {
    image1Y: slots[0]?.y ?? null,
    image1Scale: slots[0]?.scale ?? null,
    image1ZIndex: slots[0]?.zIndex ?? null,
    image2Y: slots[1]?.y ?? null,
    image2Scale: slots[1]?.scale ?? null,
    image2ZIndex: slots[1]?.zIndex ?? null,
    image3Y: slots[2]?.y ?? null,
    image3Scale: slots[2]?.scale ?? null,
    image3ZIndex: slots[2]?.zIndex ?? null,
    image4Y: slots[3]?.y ?? null,
    image4Scale: slots[3]?.scale ?? null,
    image4ZIndex: slots[3]?.zIndex ?? null,
  }
}

function unflattenImagePlacements(row: Row): TrainEntry['imagePlacements'] {
  const slots = [
    [row.image1Y, row.image1Scale, row.image1ZIndex],
    [row.image2Y, row.image2Scale, row.image2ZIndex],
    [row.image3Y, row.image3Scale, row.image3ZIndex],
    [row.image4Y, row.image4Scale, row.image4ZIndex],
  ] as const

  const placements: { y: number; scale: number; zIndex?: number }[] = []
  for (const [y, scale, zIndex] of slots) {
    // Slots are filled contiguously from image1 by flattenImagePlacements
    // above, so a missing y/scale means every slot after it is empty too.
    if (y === null || scale === null) break
    placements.push({ y, scale, zIndex: zIndex ?? undefined })
  }
  return placements.length > 0 ? placements : undefined
}

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
    imageSide: entry.imageSide ?? 'left',
    textAlign: entry.textAlign ?? null,
    imagesLinkedSize: entry.imagesLinkedSize ?? null,
    presentersMatchTitleSize: entry.presentersMatchTitleSize ?? null,
    programTitleMatchTitleSize: entry.programTitleMatchTitleSize ?? null,
    ...flattenImagePlacements(entry.imagePlacements),
    // Not yet populated by any code path -- see schema.ts's own comment on
    // these columns. Written as null here so a future results-parsing step
    // has a clear "not yet estimated" state to overwrite.
    inferredImageSide: null,
    inferredTextAlign: null,
    inferredSizesAppearMatched: null,
    inferredPresentersSizeMatchesTitle: null,
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
    image1FaceDetected: entry.faceDetected ?? null,
    image1FaceCropSuggested: entry.faceCropSuggested ?? null,
    image1FaceCropFinal: entry.faceCropFinal ?? null,
    image1FaceCropWasOverridden: entry.faceCropWasOverridden ?? null,
    // Not yet populated -- see schema.ts's own comment on this column.
    image1FaceDetectionMismatch: null,
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
    titleFont: (row.titleFont ?? '92NY Text') as TrainEntry['titleFont'],
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
    imageSide: (row.imageSide ?? 'left') as TrainEntry['imageSide'],
    textAlign: (row.textAlign ?? undefined) as TrainEntry['textAlign'],
    imagesLinkedSize: row.imagesLinkedSize ?? undefined,
    presentersMatchTitleSize: row.presentersMatchTitleSize ?? undefined,
    programTitleMatchTitleSize: row.programTitleMatchTitleSize ?? undefined,
    imagePlacements: unflattenImagePlacements(row),
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
    faceDetected: row.image1FaceDetected ?? undefined,
    faceCropSuggested: (row.image1FaceCropSuggested as TrainEntry['faceCropSuggested']) ?? undefined,
    faceCropFinal: (row.image1FaceCropFinal as TrainEntry['faceCropFinal']) ?? undefined,
    faceCropWasOverridden: row.image1FaceCropWasOverridden ?? undefined,
    faceDetectionMismatch: row.image1FaceDetectionMismatch ?? undefined,
    liveStyle: (row.liveStyle as Record<string, unknown>) ?? undefined,
  }
}
