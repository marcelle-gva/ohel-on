import { AccessShell } from "@/components/layout/AccessShell";

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  return <AccessShell>{children}</AccessShell>;
}
