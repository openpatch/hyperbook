import { Flow as IFlow } from "@bitflow/core";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getHyperbook } from "../utils/hyperbook";

const Flow = dynamic(() => import("./Bitflow").then((b) => b.Flow), {
  ssr: false,
});
const Task = dynamic(() => import("./Bitflow").then((b) => b.Task), {
  ssr: false,
});
//const Flow = () => <div />
const config = getHyperbook();

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

export const Alert = ({ children, node, ...props }: any) => {
  let c = Object.keys(props).join(" ");
  return <div className={`alert ${c}`}>{children}</div>;
};

export const Tab = ({ children }: any) => {
  return <>{children}</>;
};

export const Tabs = ({ children, node }: any) => {
  const [active, setActive] = useState(0);

  const titles: string[] = node.children?.map((c: any) => {
    return Object.keys(c.properties)?.join(" ") || "";
  });

  return (
    <>
      <div className="tabs">
        {titles.map((title, i) => (
          <button
            className={active === i ? "tab active" : "tab"}
            key={title}
            onClick={() => setActive(i)}
          >
            {title}
          </button>
        ))}
      </div>
      {titles?.map(
        (title, i) =>
          active === i && (
            <div className="tabpanel" key={title}>
              {children[i]}
            </div>
          )
      )}
    </>
  );
};

export const Collapsible = ({ children, node, ...props }: any) => {
  const [active, setActive] = useState(false);

  const title = Object.keys(props).join(" ");

  return (
    <>
      <button
        className={active ? "collapsible-button active" : "collapsible-button"}
        onClick={() => setActive((a) => !a)}
      >
        {title}
      </button>
      <div
        className={
          active ? "collapsible-content active" : "collapsible-content"
        }
      >
        <div className={"collapsible-inner"}>{children}</div>
      </div>
    </>
  );
};

export const FlowMD = ({ src, height = 400 }) => {
  const [flow, setFlow] = useState<IFlow | null>(null);
  const [err, setErr] = useState<string>();

  if (!src) {
    setErr('You need to provide a src like so: ::flow{src="/flow.json"}');
  }

  useEffect(() => {
    const { basePath } = config;

    if (
      process.env.NODE_ENV !== "production" &&
      basePath &&
      src.startsWith("/")
    ) {
      if (basePath.endsWith("/")) {
        src = basePath.slice(0, -1) + src;
      } else {
        src = basePath + src;
      }
    }

    fetch(src)
      .then((r) => r.json())
      .then((j) => setFlow(j))
      .catch(() => {
        setErr(`Could not find a flow at ${src}. Please check the src.`);
      });
  }, [src]);

  if (err) {
    return err;
  }

  return (
    <div className="flow" style={{ height }}>
      {flow ? <Flow flow={flow} /> : "...loading"}
    </div>
  );
};

export const TaskMD = ({ src, height = 400 }) => {
  const [task, setTask] = useState<Bitflow.Task | null>(null);
  const [err, setErr] = useState<string>();

  if (!src) {
    setErr('You need to provide a src like so: ::task{src="/task.json"}');
  }

  useEffect(() => {
    const { basePath } = config;

    if (
      process.env.NODE_ENV !== "production" &&
      basePath &&
      src.startsWith("/")
    ) {
      if (basePath.endsWith("/")) {
        src = basePath.slice(0, -1) + src;
      } else {
        src = basePath + src;
      }
    }

    fetch(src)
      .then((r) => r.json())
      .then((j) => setTask(j))
      .catch(() => {
        setErr(`Could not find a task at ${src}. Please check the src.`);
      });
  }, [src]);

  if (err) {
    return err;
  }

  return (
    <div className="flow" style={{ height }}>
      {task ? <Task task={task} /> : "...loading"}
    </div>
  );
};

export default {
  youtube: YouTubeVideo,
  term: Term,
  t: Term,
  alert: Alert,
  tab: Tab,
  tabs: Tabs,
  collapsible: Collapsible,
  flow: FlowMD,
  task: TaskMD,
};
