import type { ReactNode } from 'react'

/*
  Phone-only bottom sheet. Slides over the lower part of the screen so the map
  above stays visible — you can still see the pin you are editing. No backdrop
  on purpose: the sheet's own Cancel / ✕ is the way out.
*/
export function Sheet({ children }: { children: ReactNode }) {
  return (
    <div className="animate-sheet-in fixed inset-x-0 bottom-0 z-50 max-h-[72dvh] overflow-y-auto rounded-t-xl bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_40px_-8px_rgb(0_0_0/0.8)] ring-1 ring-line">
      <div className="prism-rule h-px opacity-60" />
      <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line" />
      {/* Children are desktop panels; inside the sheet the sheet is the panel. */}
      <div className="px-1 pb-2 [&>*]:rounded-none [&>*]:bg-transparent [&>*]:ring-0">
        {children}
      </div>
    </div>
  )
}
