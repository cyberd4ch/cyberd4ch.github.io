export default function Footer() {
  return (
    <footer className="mt-16 pt-6 border-t border-[var(--border)]">
      <p className="text-xs text-[var(--muted)]">
        © {new Date().getFullYear()} | cyber.dach
      </p>
    </footer>
  )
}
