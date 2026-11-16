import { SiteFrame } from '@/components/SiteChrome';
import { TextLink } from '@/components/ui';

export default function NotFound() {
  return (
    <SiteFrame>
      <div className="mx-auto max-w-xl px-5 py-24 text-center">
        <p className="text-sm uppercase tracking-[0.18em] text-pine">404</p>
        <h1 className="mt-3 font-display text-5xl text-ink">That page is not in the catalog.</h1>
        <p className="mt-4 text-muted">The address may have changed. The course catalog is still here.</p>
        <div className="mt-6 flex justify-center gap-3">
          <TextLink href="/">Go home</TextLink>
          <TextLink href="/courses">Browse courses</TextLink>
        </div>
      </div>
    </SiteFrame>
  );
}
