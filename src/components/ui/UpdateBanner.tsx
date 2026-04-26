'use client'

interface UpdateBannerProps {
  visible: boolean
}

export function UpdateBanner({ visible }: UpdateBannerProps) {
  if (!visible) return null

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-8 mx-6 max-w-sm w-full text-center shadow-2xl">
        <div className="text-4xl mb-4">🔄</div>
        <h2 className="text-xl font-bold text-zinc-100 mb-2">Update Available</h2>
        <p className="text-zinc-400 text-sm mb-6">A new version of the app is ready. Reload to get the latest.</p>
        <button
          onClick={() => window.location.reload()}
          className="w-full bg-zinc-100 text-zinc-900 font-semibold py-3 rounded-xl text-sm hover:bg-white transition-colors"
        >
          Reload Now
        </button>
      </div>
    </div>
  )
}
