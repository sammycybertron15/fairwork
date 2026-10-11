import { DevTimeControls } from "./DevTimeControls";

export function SiteFooter() {
  return (
    <footer className="border-t border-stone-soft">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-6 text-caption text-muted-on-light">
        <p>@ 2026 Fairwork. Flower Incorporerated. </p>
        <DevTimeControls />
      </div>
    </footer>
  );
}
