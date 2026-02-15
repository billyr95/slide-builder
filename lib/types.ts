export type TheinhardtWeight = 'regular' | 'bold' | 'heavy'
export type Orientation = 'landscape' | 'portrait'

export interface SlideTemplate {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  data: SlideData
}

export interface LogoItem {
  id: string
  url: string   // base64 data URL
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

  // Image
  imageUrl: string
  imageAlt: string
  imageSize: number

  // Logos (between content and footer)
  logos: LogoItem[]
  logoSize: number

  // Footer
  showSeriesName: boolean
  seriesName: string
  showListeningCredit: boolean
  listeningCredit: string
}