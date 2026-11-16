import { CertificateView } from '@/views/CertificateView';

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <CertificateView code={decodeURIComponent(code)} />;
}
