import { NextRequest, NextResponse } from 'next/server'
import { getAllProducts, Product } from '@/lib/products'
import { estimateSkinTone } from '@/lib/skin-tone'
import { styleFromSkin, recommendMetal, recommendLipstick } from '@/lib/style'
import { defaultStorage } from '@/lib/storage'
import { formatPrice } from '@/lib/format'

export const runtime = 'nodejs'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface AssistantRequestBody {
  messages: Message[]
  photoBase64?: string
  photoId?: string
  isSampleFace?: boolean
  selectedMetal?: 'gold' | 'silver' | 'rose gold'
}

export async function POST(request: NextRequest) {
  try {
    const body: AssistantRequestBody = await request.json()
    const { messages, photoBase64, photoId, isSampleFace, selectedMetal } = body

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages are required' }, { status: 400 })
    }

    const latestMessage = messages[messages.length - 1].content.trim()
    const lower = latestMessage.toLowerCase()
    const allProducts = await getAllProducts()

    // 1. Analyze Skin Tone & Complexion
    let detectedSkin: {
      hex: string
      undertone: 'warm' | 'cool' | 'neutral'
      metal: 'gold' | 'silver' | 'rose gold'
      metalReason: string
      lipstick: { id: string; name: string; hex: string; texture: string }
    } | null = null

    if (isSampleFace) {
      const sampleStyle = styleFromSkin('#E8B896')
      detectedSkin = {
        hex: '#E8B896',
        undertone: sampleStyle.undertone,
        metal: sampleStyle.metal,
        metalReason: 'Fair-warm peach complexion (CIELAB hue 64°). Warm yellow gold harmonizes with your natural pigments.',
        lipstick: sampleStyle.lipstick,
      }
    } else if (photoId && photoId !== 'sample') {
      try {
        const photoBuffer = await defaultStorage.getFile(defaultStorage.photoPath(photoId))
        if (photoBuffer) {
          const skin = await estimateSkinTone(photoBuffer)
          if (skin) {
            const style = styleFromSkin(skin.hex)
            detectedSkin = {
              hex: skin.hex,
              undertone: style.undertone,
              metal: style.metal,
              metalReason: style.metalReason,
              lipstick: style.lipstick,
            }
          }
        }
      } catch (err) {
        console.warn('Could not read photoId for skin estimation:', err)
      }
    } else if (photoBase64) {
      try {
        const cleanBase64 = photoBase64.replace(/^data:image\/\w+;base64,/, '')
        const photoBuffer = Buffer.from(cleanBase64, 'base64')
        const skin = await estimateSkinTone(photoBuffer)
        if (skin) {
          const style = styleFromSkin(skin.hex)
          detectedSkin = {
            hex: skin.hex,
            undertone: style.undertone,
            metal: style.metal,
            metalReason: style.metalReason,
            lipstick: style.lipstick,
          }
        }
      } catch (err) {
        console.warn('Could not parse photoBase64 for skin estimation:', err)
      }
    }

    const targetMetal = selectedMetal || detectedSkin?.metal

    // 2. Comprehensive Domain Expert Intelligence Engine with Database Grounding
    let responseText = ''
    let matchedProducts: Product[] = []
    let customFollowUps: string[] = []

    // Build catalogue grounding context for LLM
    const catalogSummary = allProducts.map(p => {
      const dim = 'heightCm' in p ? `${p.heightCm} cm drop` : 'lengthCm' in p ? `${p.lengthCm} cm chain` : 'caseMm' in p ? `${p.caseMm} mm case` : ''
      return `- ${p.name} (${p.brand}): ${p.type}, ${formatPrice(p.priceUsd)}, ${'metal' in p ? p.metal : 'N/A'}, ${dim}`
    }).join('\n')

    const skinContext = detectedSkin
      ? `Shopper Complexion: ${detectedSkin.undertone} undertone (${detectedSkin.hex}), Recommended metal: ${detectedSkin.metal}, Matching lip shade: ${detectedSkin.lipstick.name} (${detectedSkin.lipstick.hex})`
      : 'Shopper Complexion: Not yet analyzed'

    // Check if an external LLM key is configured (Gemini or OpenAI)
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
    const openaiKey = process.env.OPENAI_API_KEY
    const groqKey = process.env.GROQ_API_KEY
    let llmResponse: string | null = null

    if (geminiKey && geminiKey.trim().length > 5) {
      try {
        const sysPrompt = `You are Darpan's Master Fine Jewellery Stylist & AI Concierge.
Darpan physical catalogue database:
${catalogSummary}

${skinContext}

Key Directives:
1. Ground sizing recommendations in physical metrics (e.g., 11.7 mm human iris reference, 3 cm vs 6 cm drops, 40 cm collar drape, 60 mm average wrist width).
2. Recommend specific products from the database above by name.
3. Suggest complementary lipstick shades and hairstyles (e.g. high bun, loose curls) when appropriate.
4. Format in clean Markdown with headers (###), bullet points (-), and bold key terms (**). Keep advice luxurious, concise, and expert.`

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: `${sysPrompt}\n\nUser Question: ${latestMessage}` }] }],
          }),
        })
        if (res.ok) {
          const d = await res.json()
          const text = d?.candidates?.[0]?.content?.parts?.[0]?.text
          if (text && text.trim()) llmResponse = text.trim()
        }
      } catch (e) {
        console.warn('Gemini AI assistant call failed:', e)
      }
    } else if (groqKey && groqKey.trim().length > 5) {
      try {
        const sysPrompt = `You are Darpan's Master Fine Jewellery Stylist & AI Concierge.
Darpan physical catalogue database:
${catalogSummary}

${skinContext}

Key Directives:
1. Ground sizing recommendations in physical metrics (e.g., 11.7 mm human iris reference, 3 cm vs 6 cm drops, 40 cm collar drape, 60 mm average wrist width).
2. Recommend specific products from the database above by name.
3. Suggest complementary lipstick shades and hairstyles when appropriate.
4. Format in clean Markdown with headers (###), bullet points (-), and bold key terms (**).`

        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: sysPrompt },
              ...messages.slice(-4).map((m) => ({ role: m.role, content: m.content })),
              { role: 'user', content: latestMessage },
            ],
            temperature: 0.6,
          }),
        })
        if (res.ok) {
          const d = await res.json()
          const text = d?.choices?.[0]?.message?.content
          if (text && text.trim()) llmResponse = text.trim()
        }
      } catch (e) {
        console.warn('Groq assistant call failed:', e)
      }
    } else if (openaiKey && openaiKey.trim().length > 5) {
      try {
        const sysPrompt = `You are Darpan's Master Fine Jewellery Stylist & AI Concierge.
Darpan physical catalogue database:
${catalogSummary}

${skinContext}

Key Directives:
1. Ground sizing recommendations in physical metrics (e.g., 11.7 mm human iris reference, 3 cm vs 6 cm drops, 40 cm collar drape, 60 mm average wrist width).
2. Recommend specific products from the database above by name.
3. Format in clean Markdown with headers (###), bullet points (-), and bold key terms (**).`

        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: sysPrompt },
              ...messages.slice(-4).map((m) => ({ role: m.role, content: m.content })),
              { role: 'user', content: latestMessage },
            ],
            temperature: 0.7,
          }),
        })
        if (res.ok) {
          const d = await res.json()
          const text = d?.choices?.[0]?.message?.content
          if (text && text.trim()) llmResponse = text.trim()
        }
      } catch (e) {
        console.warn('OpenAI assistant call failed:', e)
      }
    }

    if (llmResponse) {
      responseText = llmResponse
    }

    // Topic detection for database product matching and follow-ups
    const isAskingFaceShape = /round|oval|square|heart|jaw|cheek|face shape|flatter/i.test(lower)
    const isAskingScale = /iris|11\.7|scale|caliper|how (do you|we) measure|true[- ]?size|accurate|accuracy/i.test(lower)
    const isAskingDropLength = /3\s*cm|6\s*cm|drop|length|size|cm|mm|long|short/i.test(lower) && /earring/i.test(lower)
    const isAskingZariOrSaree = /zari|saree|sari|lehenga|wedding|bride|bridal|fabric/i.test(lower)
    const isAskingWatch = /watch|wrist|strap|case|lug|timepiece|dial/i.test(lower)
    const isAskingNecklace = /necklace|chain|pendant|choker|collar|neckline/i.test(lower)
    const isAskingRing = /ring|finger|carat|stone|band|us size/i.test(lower)
    const isAskingBracelet = /bracelet|bangle|cuff|snake/i.test(lower)
    const isAskingEarrings = /earring|teardrop|drop|stud/i.test(lower)
    const isAskingLipstick = /lipstick|lip|shade|berry|ruby|plum|makeup|colour/i.test(lower)
    const isAskingHistory = /museum|metropolitan|met|ancient|roman|hellenistic|history|provenance/i.test(lower)

    // Skin Tone Analysis Banner (only prepend if not already generated by LLM)
    if (detectedSkin && !responseText) {
      responseText += `### ✦ Complexion & Metal Harmonization\n`
      responseText += `Our optical sensor analyzed your skin pigments: **${detectedSkin.undertone.toUpperCase()} undertone** (CIELAB sampled hex \`${detectedSkin.hex}\`).\n`
      responseText += `> **Metal Recommendation:** ${detectedSkin.metalReason}\n`
      responseText += `> **Contrasting Lip Shade:** **${detectedSkin.lipstick.name}** (\`${detectedSkin.lipstick.hex}\`, ${detectedSkin.lipstick.texture}) selected to balance your natural lip saturation.\n\n`
    }

    // Dynamic Editorial Response Logic if no LLM response was generated
    if (!responseText) {
      if (isAskingFaceShape) {
      responseText += `### ✦ Face Shape & Proportional Balance\n`
      if (/round/i.test(lower)) {
        responseText += `For a **round face shape**, the goal is to draw the eye downward with clean verticality:\n`
        responseText += `- **Elongated Drops (4.0–6.0 cm):** Pieces like our **Gilded Teardrop (6 cm variant)** or **The Met Hellenistic Gold Earring** create a graceful slimming line below the jawline.\n`
        responseText += `- **V-Shaped Necklaces:** The **Orb Chain (40 cm)** creates an angular dip that balances softer facial curves.\n`
        responseText += `- **What to avoid:** Wide circular studs or chunky disc hoops that repeat round contours.\n\n`
      } else if (/heart|triangle/i.test(lower)) {
        responseText += `For a **heart face shape** (wider forehead, delicate chin):\n`
        responseText += `- **Teardrop & Chandelier Silhouettes:** Earrings that widen at the base—like our **Gilded Teardrop (3 cm)**—provide visual fullness beside the chin.\n`
        responseText += `- **Soft Curves:** Avoid sharp triangular drops that taper at the bottom.\n\n`
      } else if (/square|angular/i.test(lower)) {
        responseText += `For a **square or angular face shape** with defined jaw angles:\n`
        responseText += `- **Curved, Organic Shapes:** The soft spheres of the **Orb Chain** and fluid teardrop curves soften structured cheekbones.\n`
        responseText += `- **Avoid:** Geometric rectangles or sharp cubic designs.\n\n`
      } else {
        responseText += `An **oval face shape** is naturally balanced and versatile:\n`
        responseText += `- You can effortlessly style both minimalist studs like the **0.6 cm Dot Stud** and dramatic **6.0 cm statement drops**.\n`
        responseText += `- For evening events, pair a 3 cm drop with an off-shoulder neckline for effortless poise.\n\n`
      }
      matchedProducts = allProducts.filter(p => p.type === 'single' || p.type === 'stud' || p.type === 'necklace')
      customFollowUps = [
        'How does the 11.7 mm iris measurement work?',
        'Show me 3 cm vs 6 cm earring drops',
        'Recommend jewellery for a wedding saree',
        'Which watch case size fits a slender wrist?',
      ]
    } else if (isAskingScale) {
      responseText += `### 🔬 How Darpan Calibrates True Physical Scale\n`
      responseText += `In standard online shopping, virtual try-on items are arbitrarily scaled overlays. Darpan guarantees **genuine millimeter scale**:\n\n`
      responseText += `1. **The Biological Anchor (11.7 mm Iris):** Peer-reviewed biometric research confirms the horizontal iris diameter of healthy adults averages **11.7 mm (±0.5 mm)** across diverse demographics.\n`
      responseText += `2. **Digital Calipers:** By locating the user's iris in the uploaded photo, our engine calculates the exact physical pixel-to-millimeter ratio (` + '`pxPerMm`' + `).\n`
      responseText += `3. **Closed-Loop Sizing Verification:** After YouCam neural placement, Darpan measures the rendered bounding box against the catalog height (e.g. 3.0 cm) and validates within **±10% strict physical tolerance**.\n\n`
      responseText += `Try any product below to see the interactive digital caliper and measurement overlay:`
      matchedProducts = allProducts.filter(p => p.type === 'single' || p.type === 'watch' || p.type === 'necklace')
      customFollowUps = [
        'Compare 3 cm vs 6 cm drop earrings',
        'What jewellery suits warm undertones?',
        'How do wrist measurements work for watches?',
      ]
    } else if (isAskingDropLength) {
      responseText += `### 📏 Earring Drop Length Guide (3 cm vs 6 cm)\n`
      responseText += `Earring scale changes the entire balance of your silhouette:\n\n`
      responseText += `- **3.0 cm Drop (The Gilded Teardrop):**\n`
      responseText += `  - Suspends midway between lobe and jawline.\n`
      responseText += `  - Weighs only 4.8 g; perfect for all-day professional and cocktail elegance.\n`
      responseText += `  - Clear of collared blouses and scarves.\n\n`
      responseText += `- **6.0 cm Drop (Heritage Length):**\n`
      responseText += `  - Reaches past the jawline, sweeping towards the collarbone.\n`
      responseText += `  - Creates dramatic presence for weddings, black-tie galas, and festive sarees.\n`
      responseText += `  - Accentuates high updos and bare necklines.\n\n`
      responseText += `You can test both sizes side-by-side using the size toggle on the Gilded Teardrop try-on studio:`
      matchedProducts = allProducts.filter(p => p.type === 'single')
      customFollowUps = [
        'Try Gilded Teardrop at 3 cm and 6 cm',
        'What lipstick shade goes with gold earrings?',
        'How does face shape affect earring length?',
      ]
    } else if (isAskingZariOrSaree) {
      responseText += `### 🥻 Styling Fine Jewellery with Festive & Bridal Attire\n`
      responseText += `When pairing jewellery with silk sarees, lehengas, or evening wear, follow the **Zari Priority Principle**:\n\n`
      responseText += `- **Gold Zari Border:** Always pairs with **Yellow Gold jewellery**, overriding cool undertones to maintain regal continuity with the garment's weave.\n`
      responseText += `- **Silver / Platinum Zari:** Harmonizes with **Silver or White Gold**.\n`
      responseText += `- **High Blouse Necklines:** Opt for statement drop earrings (like the **The Met Gold Earring**) and skip high necklaces to avoid visual crowding.\n`
      responseText += `- **Deep / Sweetheart Necklines:** Pair a **40 cm Orb Chain** with delicate stud stacks.\n\n`
      matchedProducts = allProducts.filter(p => p.type === 'single' || p.type === 'necklace' || p.type === 'bracelet')
      customFollowUps = [
        'Recommend a lipstick for a red wedding outfit',
        'Show me 6 cm statement heritage earrings',
        'How do I stack studs with drop earrings?',
      ]
    } else if (isAskingHistory) {
      responseText += `### 🏛️ Metropolitan Museum of Art CC0 Open Heritage Collection\n`
      responseText += `Darpan features authentic historical pieces sourced from The Met's open collections, digitized with precise museum archive dimensions:\n\n`
      responseText += `- **The Met Hellenistic Gold Earring (c. 300–200 BCE):** Intricate filigree granulation, 6.0 cm drop, representing Greek classical goldsmithing.\n`
      responseText += `- **The Met Snake Bracelet (1st c. CE):** Coiled gold serpent symbolizing rebirth and eternal protection, calibrated to a 60 mm wrist diameter.\n`
      responseText += `- **The Met Carnelian & Plasma Rings (Roman, 1st–2nd c. CE):** Hand-engraved intaglios mounted in solid gold bands, sized to standard US rings.\n\n`
      matchedProducts = allProducts.filter(p => p.id.includes('met'))
      customFollowUps = [
        'Try on The Met Hellenistic Gold Earring',
        'Try on The Met Snake Bracelet',
        'How are historical pieces scaled accurately?',
      ]
    } else if (isAskingWatch) {
      responseText += `### ⌚ Calibrated Watch Proportions & Wrist Anatomy\n`
      responseText += `Wristwatches look balanced when the case lugs do not extend beyond the wrist silhouette (standard average adult wrist: 60 mm width):\n\n`
      responseText += `- **28 mm Case (Marshal Petite):** Classical mid-century proportions with leather strap; sits perfectly flush on slender to medium wrists.\n`
      responseText += `- **35 mm Case (Atlantic 17 Jewels):** Vintage collector's sweet spot; prominent presence with zero unsightly strap overhang.\n\n`
      matchedProducts = allProducts.filter(p => p.type === 'watch')
      customFollowUps = [
        'Try Atlantic 17 Jewels on wrist',
        'Try Marshal Petite on wrist',
        'Can I wear a vintage watch with gold bracelets?',
      ]
    } else if (isAskingNecklace) {
      responseText += `### ✨ Necklace Chain Geometry & Collarbone Placement\n`
      responseText += `- **40 cm Choker / Collar Drop:** Rests along the hollow of the clavicle; ideal for open shoulders, boatnecks, and saree blouses.\n`
      responseText += `- **45 cm Princess Drape:** Falls gracefully past the collarbone, creating a flattering V-line for V-necks and button-downs.\n\n`
      matchedProducts = allProducts.filter(p => p.type === 'necklace')
      customFollowUps = [
        'Try Orb Chain at 40 cm calibrated scale',
        'What earrings pair best with the Orb Chain?',
        'Recommend a lipstick for gold jewellery',
      ]
    } else if (isAskingLipstick) {
      responseText += `### 💄 Makeup VTO & Lip-to-Metal Contrast\n`
      responseText += `In the YouCam styling engine, lip shade is calibrated to create balanced contrast with metal reflections:\n\n`
      responseText += `- **Yellow Gold Jewellery:** Harmonizes with warm **Ruby Satin (` + '`#B22222`' + `)**, rich **Berry (` + '`#9B1B30`' + `)**, and earthy Terracotta.\n`
      responseText += `- **Silver & Platinum:** Pops against cool Berry, crisp Crimson, and Rose Nude.\n`
      responseText += `- **Finish Selection:**\n`
      responseText += `  - **Satin:** Natural, luminous reflection for daily wear.\n`
      responseText += `  - **Gloss:** Specular micro-highlights that reflect light alongside polished gold.\n`
      responseText += `  - **Matte:** Bold, non-reflective velvety drama for evening galas.\n\n`
      matchedProducts = allProducts.filter(p => p.type === 'single' || p.type === 'necklace')
      customFollowUps = [
        'Style Gilded Teardrop with Ruby Satin',
        'How does hair styling affect jewellery visibility?',
        'Show me true-scale gold necklaces',
      ]
    } else {
      // General Inquiry
      responseText += `### ✦ Curated True-Scale Jewellery Collection\n`
      responseText += `Welcome to Darpan. Every piece below is calibrated to true physical scale:\n`
      responseText += `- Earrings measured against the **11.7 mm biological iris**\n`
      responseText += `- Watches fitted to the **60 mm average wrist contour**\n`
      responseText += `- Chains scaled to exact **40 cm collar drape**\n\n`
      responseText += `Select any piece to start an instant 0-unit true-scale try-on:`

      if (targetMetal) {
        matchedProducts = allProducts.filter(p => 'metal' in p && p.metal.toLowerCase() === targetMetal.toLowerCase())
      }
      if (matchedProducts.length === 0) {
        matchedProducts = allProducts.slice(0, 4)
      }
        customFollowUps = [
          'What earrings flatter my face shape?',
          'How does the 11.7 mm iris measurement work?',
          'Compare 3 cm vs 6 cm drop earrings',
          'Which watch fits a slender wrist?',
        ]
      }
    }

    // Ensure matchedProducts are populated for the interactive cards
    if (matchedProducts.length === 0) {
      if (/earring|drop|stud/i.test(lower)) {
        matchedProducts = allProducts.filter(p => p.type === 'single' || p.type === 'stud')
      } else if (/necklace|chain|choker/i.test(lower)) {
        matchedProducts = allProducts.filter(p => p.type === 'necklace')
      } else if (/watch|wrist|timepiece/i.test(lower)) {
        matchedProducts = allProducts.filter(p => p.type === 'watch')
      } else if (/ring/i.test(lower)) {
        matchedProducts = allProducts.filter(p => p.type === 'ring')
      } else if (/met|museum|history|vintage/i.test(lower)) {
        matchedProducts = allProducts.filter(p => p.id.includes('met'))
      } else if (targetMetal) {
        matchedProducts = allProducts.filter(p => 'metal' in p && p.metal?.toLowerCase() === targetMetal.toLowerCase())
      }
      if (matchedProducts.length === 0) {
        matchedProducts = allProducts.slice(0, 4)
      }
    }

    if (customFollowUps.length === 0) {
      customFollowUps = [
        'What earrings flatter my face shape?',
        'How does the 11.7 mm iris measurement work?',
        'Compare 3 cm vs 6 cm drop earrings',
        'Which vintage watch fits a slender wrist?',
      ]
    }

    const topRecommendations = matchedProducts.slice(0, 4)

    return NextResponse.json({
      reply: responseText,
      detectedSkin,
      products: topRecommendations.map(p => ({
        id: p.id,
        name: p.name,
        brand: p.brand,
        type: p.type,
        priceUsd: p.priceUsd,
        imagePath: p.imagePath,
        metal: 'metal' in p ? p.metal : undefined,
        heightCm: 'heightCm' in p ? p.heightCm : undefined,
        lengthCm: 'lengthCm' in p ? p.lengthCm : undefined,
        caseMm: 'caseMm' in p ? p.caseMm : undefined,
        diameterMm: 'diameterMm' in p ? p.diameterMm : undefined,
        tryOnUrl: `/try-on/${p.id}?sample=1`,
      })),
      followUpSuggestions: customFollowUps,
    })
  } catch (error) {
    console.error('Assistant API error:', error)
    return NextResponse.json(
      { error: 'Failed to process assistant request', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
