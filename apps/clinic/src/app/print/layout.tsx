/** Printable pages: no app shell, a grey desk on screen, plain white on paper. */
export default function PrintLayout({ children }: LayoutProps<"/print">) {
  return (
    <main className="min-h-screen bg-slate-100 py-6 print:min-h-0 print:bg-white print:py-0">
      {children}
    </main>
  )
}
