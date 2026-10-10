import Link from "next/link";
import { ConnectWalletButton } from "./ConnectWalletButton";

const NAV_ITEMS = [
  { href: "/", label: "Storefronts" },
  { href: "/agreements/new", label: "New agreement" },
  { href: "/dashboard", label: "Dashboard" },
] as const;

export function SiteHeader() {
  return (
    <header className="border-b border-stone-soft">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-4 px-6 py-4">
        <div className="flex flex-wrap items-center gap-x-10 gap-y-2">
          <Link href="/" className="font-heading text-lead font-semibold">
            Fairwork
          </Link>
          <nav aria-label="Primary">
            <ul className="flex items-center gap-6 text-caption">
              {NAV_ITEMS.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="underline-offset-4 hover:underline">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <ConnectWalletButton />
      </div>
    </header>
  );
}
