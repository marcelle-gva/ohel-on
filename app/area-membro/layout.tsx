import { AccessShell } from "@/components/layout/AccessShell";

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  return <AccessShell membro>{children}</AccessShell>;
}
