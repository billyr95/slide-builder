export type TheinhardtWeight = 'regular' | 'bold' | 'heavy'
export type Orientation = 'landscape' | 'portrait'
export type ImageMode = 'single' | 'two-stagger'

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

export interface SlideData {
  // Content
  label: string
  labelWeight: TheinhardtWeight
  title: string
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
  imageUrl: string
  imageAlt: string
  imageSize: number
  image2Url: string
  image2Alt: string
  imageOverlap: number  // 0–60, percentage overlap of image2 over image1
  staggerSize: number   // pixels, width of each image in stagger layout
  image1Y: number       // vertical offset for image 1 (px)
  image2Y: number       // vertical offset for image 2 (px)
  image1Scale: number   // individual scale for image 1 (px width)
  image2Scale: number   // individual scale for image 2 (px width)

  // Logos
  logos: LogoItem[]
  logoSize: number

  // Footer
  showSeriesName: boolean
  seriesName: string
  showListeningCredit: boolean
  listeningCredit: string
}