'use client'

interface UpdateBannerProps {
  visible: boolean
}

export function UpdateBanner({ visible }: UpdateBannerProps) {
  if (!visible) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-60 bg-zinc-800 border-b border-zinc-700 text-zinc-100 px-4 py-2 flex items-center justify-between text-sm">
      <span>A new version is available.</span>
      <button
        onClick={() => window.location.reload()}
        className="font-semibold underline ml-4"
      >
        Reload
      </button>
    </div>
  )
}
