import React from 'react'
import type { Metadata } from 'next'
import { AboutClient } from './AboutClient'

export const metadata: Metadata = {
  title: 'About Darpan · Kaari Studio',
  description:
    'Editorial true-size jewellery try-on powered by 11.7 mm iris calibration, zero photo retention privacy architecture, and CyberLink YouCam API integration.',
}

export default function AboutPage() {
  return <AboutClient />
}
