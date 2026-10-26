import { Skeleton } from '@/components/Skeleton'

export default function LooksLoading() {
  return (
    <main className="min-h-screen bg-[var(--bg)] px-4 pb-24 pt-16 text-[var(--ink)] sm:px-6 lg:px-8" aria-label="Loading looks">
      <div className="mx-auto max-w-7xl">
        <Skeleton className="mb-3 h-14 w-48 sm:h-16 sm:w-56" />
        <Skeleton className="mb-10 h-5 w-80 max-w-full" />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index}>
              <Skeleton className="aspect-[4/5]" />
              <Skeleton className="mt-3 h-5 w-2/3" />
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
