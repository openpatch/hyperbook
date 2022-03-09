import Link from "next/link";

export type YouTubeVideoProps = {
  id: string;
  children: string;
};

export const YouTubeVideo = ({ id, children }: YouTubeVideoProps) => (
  <div className="video-container">
    <iframe
      src={"https://www.youtube.com/embed/" + id}
      frameBorder="0"
      title={children}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
    />
  </div>
);

export type TermProps = {
  id?: string;
  children: string;
};

export const Term = ({ id, children }: TermProps) => {
  if (!id) {
    id = children[0].toLowerCase().replaceAll(" ", "-");
  }
  return (
    <Link href={`/glossary/${id}`}>
      <a>{children}</a>
    </Link>
  );
};

export default {
  youtube: YouTubeVideo,
  term: Term,
  t: Term,
};
