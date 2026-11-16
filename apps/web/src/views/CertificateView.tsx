'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { SiteFrame } from '@/components/SiteChrome';
import { ErrorNote, LoadingBlock, buttonClass, fieldClass } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useSettings } from '@/lib/settings';
import type { Certificate } from '@/lib/types';

export function CertificateLookup() {
  const [code, setCode] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    const next = code.trim().toUpperCase();
    if (next) window.location.href = `/certificates/${encodeURIComponent(next)}`;
  }

  return (
    <SiteFrame>
      <div className="mx-auto max-w-xl px-5 py-16">
        <h1 className="font-display text-5xl text-ink">Verify a certificate</h1>
        <p className="mt-3 text-muted">Enter the code printed on a completion certificate. No account is required.</p>
        <form className="mt-8 flex flex-col gap-3 sm:flex-row" onSubmit={submit}>
          <input className={fieldClass} value={code} onChange={(event) => setCode(event.target.value)} placeholder="OL-XXXXXXXX" aria-label="Certificate code" />
          <button className={buttonClass('primary')} type="submit">Verify</button>
        </form>
      </div>
    </SiteFrame>
  );
}

export function CertificateView({ code }: { code: string }) {
  const { settings } = useSettings();
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ certificate: Certificate }>(`/api/certificates/${encodeURIComponent(code)}`)
      .then((result) => setCertificate(result.certificate))
      .catch((reason) => setError(errorMessage(reason)))
      .finally(() => setLoading(false));
  }, [code]);

  return (
    <SiteFrame>
      <div className="mx-auto max-w-3xl px-5 py-12">
        {loading ? <LoadingBlock label="Checking certificate" /> : null}
        {error ? <ErrorNote message={error} /> : null}
        {certificate ? (
          <article className="rounded-[28px] border border-line bg-cream px-8 py-12 text-center shadow-card">
            <p className="text-xs uppercase tracking-[0.22em] text-pine">{settings.site_name}</p>
            <h1 className="mt-4 font-display text-5xl text-ink">Certificate of completion</h1>
            <p className="mt-6 text-muted">This certifies that</p>
            <p className="mt-2 font-display text-4xl text-ink">{certificate.studentName}</p>
            <p className="mt-6 text-muted">completed</p>
            <p className="mt-2 font-display text-3xl text-ink">{certificate.courseTitle}</p>
            <p className="mt-6 text-sm text-muted">Issued {formatDate(certificate.issuedAt)}</p>
            <p className="mt-2 font-mono text-sm tracking-wide text-ink">{certificate.code}</p>
            <div className="no-print mt-8 flex justify-center gap-3">
              <button className={buttonClass('secondary')} type="button" onClick={() => window.print()}>Print</button>
              <Link href="/certificates" className={buttonClass('ghost')}>Check another code</Link>
            </div>
          </article>
        ) : null}
      </div>
    </SiteFrame>
  );
}
