export function LessonMedia({ url, title }: { url: string; title: string }) {
  const youtube = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/);
  if (youtube) {
    return (
      <iframe
        className="aspect-video w-full rounded-2xl bg-black"
        src={`https://www.youtube.com/embed/${youtube[1]}`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) {
    return (
      <iframe
        className="aspect-video w-full rounded-2xl bg-black"
        src={`https://player.vimeo.com/video/${vimeo[1]}`}
        title={title}
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
      />
    );
  }
  if (/\.(mp4|webm|ogg)(\?|$)/i.test(url)) {
    return <video className="aspect-video w-full rounded-2xl bg-black" src={url} controls preload="metadata" />;
  }
  return (
    <a className="inline-flex rounded-xl bg-pine px-4 py-2 text-sm text-white" href={url} target="_blank" rel="noreferrer">
      Open the lesson video
    </a>
  );
}
