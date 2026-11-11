import type { ReactNode } from 'react'

/**
 * The opaque paper column every page's content sits on. The fixed paint
 * canvas lives behind the app layer, so this column (680px, `--bg`) hides the
 * snake under text while the blueprint margins and full-bleed bands show it.
 */
export default function PageCol({ children }: { children: ReactNode }) {
  return (
    <div className="page-col mx-auto min-h-full w-full max-w-[680px] px-6 pt-7 pb-12">
      {children}
    </div>
  )
}
