import React from 'react'
import type { Metadata } from 'next'
import { AboutClient } from './AboutClient'

export const metadata: Metadata = {
  title: 'About Darpan',
  description:
    'A jewellery try-on guide with category-specific scale references, careful photo storage, and the YouCam API from Perfect Corp.',
}

export default function AboutPage() {
  return <AboutClient />
}
