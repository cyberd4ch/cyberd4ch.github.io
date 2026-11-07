export default function Footer() {
  return (
    <footer className="mt-16 pt-6 border-t border-[var(--border)] flex items-baseline justify-between gap-4">
      <p className="text-xs text-[var(--muted)]">
        © {new Date().getFullYear()} | cyber.dach
      </p>
      <a
        href="https://github.com/sponsors/cyberd4ch"
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs underline-link text-[var(--muted)]"
      >
        sponsor
      </a>
    </footer>
  )
}
