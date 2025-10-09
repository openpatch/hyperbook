function isYoutubeUrl(url: string) {
  return (
    typeof url === "string" &&
    (url.includes("youtube.com/watch?v=") || url.includes("youtu.be/"))
  );
}

function getYoutubeEmbedUrl(url: string) {
  if (url.includes("youtube.com/watch?v=")) {
    const videoId = url.split("v=")[1].split("&")[0];
    return `https://www.youtube-nocookie.com/embed/${videoId}`;
  }
  if (url.includes("youtu.be/")) {
    const videoId = url.split("youtu.be/")[1].split("?")[0];
    return `https://www.youtube-nocookie.com/embed/${videoId}`;
  }
  return url;
}

function getVideoMimeType(url: string) {
  if (url.endsWith(".webm")) return "video/webm";
  if (url.endsWith(".mp4")) return "video/mp4";
  return "video/mp4";
}

export const Video: React.FC<{ url: string; title?: string }> = ({ url, title }) => {
  if (isYoutubeUrl(url)) {
    const embedUrl = getYoutubeEmbedUrl(url);
    return (
      <div className="video-container" style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', marginBottom: 16 }}>
        <iframe
          src={embedUrl}
          title={title || "YouTube video"}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
        ></iframe>
      </div>
    );
  } else {
    const mimeType = getVideoMimeType(url);
    return (
      <video
        controls
        style={{
          width: '100%', maxHeight: '400px', marginBottom: 16
        }}      >
        <source src={url} type={mimeType} />
        Your browser does not support the video tag.
      </video>
    );
  }
};
