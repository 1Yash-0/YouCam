import { Skeleton } from '@/components/Skeleton'

export default function ProductLoading() {
  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 pb-32 pt-32 sm:px-10" aria-label="Loading product">
      <Skeleton className="mb-8 h-4 w-56" />
      <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="flex flex-col gap-4 lg:col-span-7">
          <Skeleton className="aspect-[4/5] w-full rounded-2xl" />
          <div className="flex gap-3">
            <Skeleton className="h-20 w-20 rounded-xl" />
            <Skeleton className="h-20 w-20 rounded-xl" />
          </div>
        </div>
        <div className="flex flex-col gap-8 lg:col-span-5">
          <div>
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="mt-4 h-7 w-32" />
          </div>
          <Skeleton className="h-12 w-full rounded-full" />
          <Skeleton className="h-14 w-full rounded-xl" />
          <div className="flex flex-col gap-4 border-t border-[var(--line)] pt-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
