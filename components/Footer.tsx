export default function Footer() {
  return (
    <footer className="pt-6 border-t border-[var(--border)] flex items-center justify-between gap-4">
      <p className="text-xs text-[var(--muted)]">
        © {new Date().getFullYear()} cyber.dach
        <span className="mx-2" aria-hidden="true">·</span>
        <span className="inline-flex items-center gap-1.5">
          status
          <span
            className="beacon inline-block h-1.5 w-1.5 rounded-full bg-[var(--navy)]"
            aria-hidden="true"
          />
          nominal
        </span>
      </p>
      <iframe
        src="https://github.com/sponsors/cyberd4ch/button"
        title="Sponsor cyberd4ch"
        height={32}
        width={114}
        loading="lazy"
        style={{ border: 0, borderRadius: 6 }}
      />
    </footer>
  )
}
