export type TheinhardtWeight = 'regular' | 'bold' | 'heavy'
export type Orientation = 'landscape' | 'portrait'
export type ImageMode =
  | 'single'
  | 'two-stagger'
  | 'three-stagger'
  | 'three-triangle'
  | 'four-stagger'
  | 'four-squared'
  | 'none'
export type TitleFont = '92NY' | 'Theinhardt Heavy'

export interface SlideTemplate {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  data: SlideData
}

export interface LogoItem {
  id: string
  url: string
  alt: string
}

export interface StaggerImage {
  id: string
  url: string
  alt: string
  y: number      // vertical offset (px)
  scale: number  // width override (px); 0 means use staggerSize
}

// Number of images used by a given stagger mode (0 for non-stagger modes).
export function staggerCount(mode: ImageMode): number {
  if (mode === 'two-stagger') return 2
  if (mode === 'three-stagger' || mode === 'three-triangle') return 3
  if (mode === 'four-stagger' || mode === 'four-squared') return 4
  return 0
}

export interface SlideData {
  // Content
  label: string
  labelWeight: TheinhardtWeight
  title: string
  titleFont: TitleFont
  titleItalic: boolean
  titleSize: number
  subtitle: string
  subtitleWeight: TheinhardtWeight
  subtitleSize: number
  subtitleInline: boolean
  subtitle2: string
  subtitle2Weight: TheinhardtWeight
  subtitle2Size: number
  presenters: string
  presentersWeight: TheinhardtWeight
  presentersSize: number

  // Style
  backgroundColor: string
  textColor: string
  accentColor: string

  // Images
  imageMode: ImageMode
  imageUrl: string       // single-image mode only
  imageAlt: string
  imageSize: number
  staggerImages: StaggerImage[]  // used by all multi-image modes (stagger, triangle, squared)
  imageOverlap: number  // 0–60, percentage overlap between consecutive stagger images
  staggerSize: number   // pixels, default width of each image in stagger layout

  // Logos
  logos: LogoItem[]
  logoSize: number

  // Footer
  showSeriesName: boolean
  seriesName: string
  showListeningCredit: boolean
  listeningCredit: string
}