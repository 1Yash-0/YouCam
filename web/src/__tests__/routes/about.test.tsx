import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import AboutPage, { metadata } from '@/app/about/page'
import { AboutClient } from '@/app/about/AboutClient'

describe('/about route', () => {
  const html = renderToString(React.createElement(AboutClient))

  it('renders a calm About introduction with the honest calibration facts', () => {
    expect(html).toContain('About Darpan')
    expect(html).toContain('Darpan means mirror.')
    expect(html).toContain('Earring scale uses an average adult iris reference of about 11.7 mm.')
    expect(html).toContain('Render checks do not guarantee perceived size on every face or screen.')
    expect(html).toContain('Necklaces, watches, rings and bracelets use different assumptions.')
    expect(html).toContain('Your photo is used only for your try-on.')
    expect(html).toContain('Cached samples cost nothing to browse.')
  })

  it('has each required reading section and plain-language measurement copy', () => {
    expect(html).toContain('Why size is hard online')
    expect(html).toContain('How we measure')
    expect(html).toContain('What we do with your photo')
    expect(html).toContain('Built on the YouCam API')
    expect(html).toContain(
      'uses that population average as a reference when estimating earring scale in a photo.'
    )
    expect(html).toContain('not a measurement of every shopper’s iris.')
  })

  it('renders the requested real images with captions', () => {
    expect(html).toContain('src="/hero/size-2.webp"')
    expect(html).toContain('src="/hero/size-6.webp"')
    expect(html).toContain('src="/sample-face.png"')
    expect(html).toContain('2 cm on our sample face')
    expect(html).toContain('6 cm on the same face')
  })

  it('states the current private photo handling and expiry facts', () => {
    expect(html).toContain('private browser session')
    expect(html).toContain('expires access after 24 hours')
    expect(html).toContain('expired files during daily cleanup')
    expect(html).toContain('your photo and results require your browser session')
    expect(html).toContain('delete your photo and previews after processing')
    expect(html).toContain('Try-on rendered by the YouCam API from Perfect Corp.')
    expect(html).not.toContain('Photos are stored locally in the app')
    expect(html).not.toContain('YouCam signed links expire after 2 hours.')
    expect(html).not.toContain('CRYPTOGRAPHY')
    expect(html).not.toContain('DESTRUCTION')
    expect(html).not.toContain('pxPerCm = irisPx / 1.17')
    expect(html).not.toContain('01 / NORMALIZATION')
  })

  it('keeps the size control accessible and free of index labels', () => {
    expect(html).toContain('aria-label="Jewellery height in centimetres"')
    expect(html).toContain('2.0')
    expect(html).toContain('3.0')
    expect(html).toContain('4.5')
    expect(html).toContain('6.0')
    expect(html).toContain('cm')
    expect(html).toContain('aria-pressed="true"')
  })

  it('renders the full reading page visibly without entrance-animation styles', () => {
    expect(html).not.toContain('opacity:0')
    expect(html).not.toContain('translateY')
    expect(html).toContain('See how a piece might look')
  })

  it('ends with the collection try-on action and breadcrumb', () => {
    expect(html).toContain('Try on me')
    expect(html).toContain('href="/collection"')
    expect(html).toContain('aria-label="Breadcrumb"')
    expect(html).toContain('href="/"')
  })

  it('renders the server page and the requested metadata', () => {
    const pageHtml = renderToString(React.createElement(AboutPage))
    expect(pageHtml).toContain('About Darpan')
    expect(metadata.title).toBe('About Darpan')
    expect(metadata.description).toContain('category-specific scale references')
    expect(metadata.description).toContain('YouCam API from Perfect Corp.')
  })
})
