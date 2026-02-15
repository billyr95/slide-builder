export type FontFamily = 'serif' | 'sans'
export type Orientation = 'landscape' | 'portrait'

export interface SlideTemplate {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  data: SlideData
}

export interface SlideData {
  // Content
  label: string           // e.g. "TONIGHT"
  title: string           // e.g. "Wuthering Heights through the Ages"
  titleItalic: boolean    // render title in italic
  subtitle: string        // e.g. "with"
  presenters: string      // e.g. "Vinson Cunningham,\nNaomi Fry\n& Alexandra Schwartz"

  // Style
  backgroundColor: string
  textColor: string
  accentColor: string     // for title / label
  fontFamily: FontFamily

  // Image
  imageUrl: string        // base64 or URL
  imageAlt: string
}
