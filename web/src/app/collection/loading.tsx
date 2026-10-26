import { Skeleton } from '@/components/Skeleton'

export default function CollectionLoading() {
  return (
    <main className="min-h-screen bg-[var(--bg)] pb-16 text-[var(--ink)]" aria-label="Loading collection">
      <header className="mx-auto max-w-7xl px-4 pb-2 pt-16 sm:px-6 lg:px-8">
        <Skeleton className="h-14 w-64 sm:h-16 sm:w-80" />
      </header>
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-16 sm:grid-cols-2 sm:px-6 md:gap-8 lg:grid-cols-3 lg:px-8 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="flex flex-col gap-4 rounded-2xl border border-[var(--line)] p-4 sm:p-5">
            <Skeleton className="aspect-[4/5] rounded-xl" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    </main>
  )
}
