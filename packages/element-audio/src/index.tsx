import { FC, useEffect, useRef, useState } from "react";
import { createSlice } from "@hyperbook/store";
import { useMakeUrl } from "@hyperbook/provider";
import type Wavesurfer from "wavesurfer.js";
import PlayIcon from "./play";
import PauseIcon from "./pause";
import "./index.css";

type DirectiveAudioProps = {
  src: string;
  title?: string;
  author?: string;
  thumbnail?: string;
  position?: "left" | "right";
};

function secondsToTimestamp(seconds: number) {
  seconds = Math.floor(seconds);
  var h = Math.floor(seconds / 3600);
  var m = Math.floor((seconds - h * 3600) / 60);
  var s = seconds - h * 3600 - m * 60;

  let th = h < 10 ? "0" + h : h;
  let tm = m < 10 ? "0" + m : m;
  let ts = s < 10 ? "0" + s : s;
  if (h > 0) {
    return th + ":" + tm + ":" + ts;
  }

  return tm + ":" + ts;
}

const DirectiveAudio: FC<DirectiveAudioProps> = ({
  src,
  title,
  thumbnail,
  author,
  position = "left",
}) => {
  const makeUrl = useMakeUrl();
  src = makeUrl(src, "public");
  thumbnail = makeUrl(thumbnail, "public");

  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<Wavesurfer>();
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    import("wavesurfer.js").then((wavesurfer) => {
      if (containerRef.current) {
        const ws = wavesurfer.default.create({
          container: containerRef.current,
          cursorWidth: 4,
          barWidth: 4,
          barGap: 5,
          barRadius: 2,
          height: 64,
          responsive: true,
        });
        ws.load(src);
        ws.on("ready", () => {
          wavesurferRef.current = ws;
          setDuration(ws.getDuration());
        });

        ws.on("audioprocess", () => {
          setCurrentTime(Math.floor(ws.getCurrentTime()));
        });

        ws.on("pause", () => {
          setIsPlaying(false);
        });

        ws.on("finish", () => {
          setIsPlaying(false);
        });

        ws.on("play", () => {
          setIsPlaying(true);
        });

        ws.on;
      }
    });

    return () => {
      wavesurferRef.current?.destroy();
    };
  }, [src]);

  const togglePlayPause = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause();
      setIsPlaying(wavesurferRef.current.isPlaying());
    }
  };

  return (
    <div className="element-audio">
      <div className="player">
        {position === "left" && thumbnail && (
          <div
            className="thumbnail"
            style={{ backgroundImage: `url(${thumbnail})` }}
          ></div>
        )}
        {position === "left" && (
          <button className="play" onClick={togglePlayPause}>
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>
        )}
        <div className="wave" ref={containerRef} />
        {position === "right" && (
          <button className="play right" onClick={togglePlayPause}>
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>
        )}
        {position === "right" && thumbnail && (
          <div
            className="thumbnail right"
            style={{ backgroundImage: `url(${thumbnail})` }}
          ></div>
        )}
      </div>
      <div className="information">
        {title && <span className="title">{title}</span>}{" "}
        {title && author && <span className="spacer">-</span>}{" "}
        {author && <span className="author">{author}</span>}{" "}
        <span className="duration">
          {secondsToTimestamp(currentTime)}/{secondsToTimestamp(duration)}
        </span>
      </div>
    </div>
  );
};

type ElementAudioState = {};

const initialState: ElementAudioState = {};

const sliceAudio = createSlice({
  name: "element.audio",
  initialState,
  reducers: {},
});

export default {
  directives: { audio: DirectiveAudio },
  slice: sliceAudio,
};
