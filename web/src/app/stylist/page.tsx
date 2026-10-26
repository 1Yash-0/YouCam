import { redirect } from 'next/navigation'

// The standalone stylist now lives in the try-on result as "Style it".
export default function StylistPage() {
  redirect('/try-on/gilded-teardrop?sample=1')
}
