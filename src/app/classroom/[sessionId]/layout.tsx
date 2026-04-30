export default function ClassroomLayout({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-0 flex flex-col bg-ink text-paper">{children}</div>;
}
