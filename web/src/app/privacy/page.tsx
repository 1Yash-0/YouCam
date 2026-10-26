import Link from 'next/link'

export default function Privacy() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <h1 className="mb-8 font-display text-5xl">Your photo, your choice.</h1>
      <div className="space-y-6 text-[17px] leading-[1.6] text-[var(--ink)]">
        <p className="max-w-[62ch]">Samples are saved demonstration renders. Exploring them does not upload a photo or start a new render.</p>
        <p className="max-w-[62ch]">When you use your own photo, Darpan prepares it and sends it to YouCam to generate your requested preview. Your photo and results are accessible only through your private browser session for 24 hours. The daily cleanup removes expired Darpan copies, including intermediate renders and fallback upload copies.</p>
        <p className="max-w-[62ch]">Use “Delete my photo and previews” in the studio to remove Darpan’s stored copies. If a render is actively processing, wait for it to finish first. Deletion in Darpan does not delete copies held by YouCam; provider processing follows its own service terms.</p>
        <p className="max-w-[62ch]">Saved choices keep product names and selected dimensions in this browser’s local storage. They do not keep your uploaded photo or result image. Downloaded images remain on your device until you remove them.</p>
        <p className="max-w-[62ch]">This demo uses an anonymous session cookie to protect private images and manage preview limits. Use only photos you own or have permission to upload. The app does not publish your personal previews through share links.</p>
        <Link href="/collection" className="link-draw">Explore the demonstration catalogue</Link>
      </div>
    </main>
  )
}
