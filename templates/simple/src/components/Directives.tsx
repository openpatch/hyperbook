import { Flow as IFlow } from "@bitflow/core";
import hash from "object-hash";
import Link from "next/link";
import dynamic from "next/dynamic";
import mermaid from "mermaid";
import { useEffect, useLayoutEffect, useState } from "react";
import { getHyperbook } from "../utils/hyperbook";
import { usePrefersColorScheme } from "../utils/usePreferesColorScheme";
import { useBookmarks, useCollapsible, useProtect, useTabs } from "../store";

const { Flow, Task } = dynamic(() =>
  import("./Bitflow").then(
    (mod) =>
      ({
        Flow: mod.Flow,
        Task: mod.Task,
      } as any)
  )
) as any;

function basename(path: string) {
  return path.split("/").reverse()[0];
}

const config = getHyperbook();

export type YouTubeVideoProps = {
  id: string;
  children: string;
};

export const YouTubeVideo = ({ id, children }: YouTubeVideoProps) => (
  <div className="video-container" id={`video-${id}`}>
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
  className?: string;
};

export const Term = ({ id, className, children }: TermProps) => {
  if (!id) {
    id = children[0].toLowerCase().replaceAll(" ", "-");
  }

  let href = `/glossary/${id}`;

  if (className && typeof className[0] == "string") {
    href += `#${className}`;
  }

  return (
    <Link href={href}>
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

export const Tabs = ({ children, node, id }: any) => {
  if (!id) {
    id = hash(node);
  }
  let [active, setActive] = useTabs(id);

  const tabs: { title: string; id: string; index: number }[] =
    node.children?.map((c: any, i: number) => {
      return {
        title: c.properties?.title || "",
        id: c.propterties?.id || c.properties?.title,
        index: i,
      };
    });

  if (active === null) {
    active = tabs?.[0].id;
  }

  return (
    <>
      <div className="tabs" id={`tabs-${id}`}>
        {tabs.map(({ title, id, index }) => (
          <button
            key={index + id}
            className={active === id ? "tab active" : "tab"}
            onClick={() => setActive(id)}
          >
            {title}
          </button>
        ))}
      </div>
      {tabs?.map(
        ({ id, index }) =>
          active === id && (
            <div className="tabpanel" key={index + id}>
              {children[index]}
            </div>
          )
      )}
    </>
  );
};

export const Collapsible = ({ children, id, title }: any) => {
  const [active, toggleActive] = useCollapsible(id || title);

  if (!id) {
    id = title;
  }

  return (
    <>
      <button
        id={`collapsibel-${id}`}
        className={active ? "collapsible-button active" : "collapsible-button"}
        onClick={() => toggleActive()}
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
    return <pre>{err}</pre>;
  }

  return (
    <div
      className="flow border"
      id={`flow-${basename(src)}`}
      style={{ height }}
    >
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
      .then((j) => {
        setTask(j);
      })
      .catch(() => {
        setErr(`Could not find a task at ${src}. Please check the src.`);
      });
  }, [src]);

  if (err) {
    return <pre>{err}</pre>;
  }

  return (
    <div
      className="flow border"
      id={`task-${basename(src)}`}
      style={{ height }}
    >
      {task ? <Task task={task} /> : "...loading"}
    </div>
  );
};

const Protect = ({ children, node, password, description }) => {
  const id = hash(node);
  const [value, setValue] = useProtect(id);

  return value === password ? (
    children
  ) : (
    <div className="password border">
      <span className="description">{description}</span>
      <span className="icon">🔒</span>
      <input
        placeholder="..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    </div>
  );
};

const Download = ({ children, src }) => {
  const [isOnline, setIsOnline] = useState(true);

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

  useEffect(() => {
    let isCancelled = false;
    fetch(src, {
      method: "HEAD",
    }).then((r) => {
      if (!r.ok && !isCancelled) {
        setIsOnline(false);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  return (
    <a
      href={src}
      className="download border"
      target="_blank"
      rel="noopener noreferrer"
    >
      <span className="icon">⏬</span>
      <span className={!isOnline ? "label offline" : "label"}>
        {children} {!isOnline && "(Offline)"}
      </span>
    </a>
  );
};

const Archive = ({ name, children }) => {
  return <Download children={children} src={`/archives/${name}.zip`} />;
};

const Bookmarks = () => {
  const bookmarks = useBookmarks();

  return (
    <ul className="bookmarks">
      {bookmarks?.map((bookmark) => (
        <Link
          key={bookmark.href + bookmark.anchor}
          href={{
            pathname: bookmark.href,
            hash: "#" + bookmark.anchor,
          }}
          scroll={false}
        >
          <a>
            <li>{bookmark.label}</li>
          </a>
        </Link>
      ))}
    </ul>
  );
};

const getNodeText = (node: any) => {
  if (["string", "number"].includes(typeof node)) return node;
  if (node instanceof Array) return node.map(getNodeText).join("");
  if (typeof node === "object" && node) return getNodeText(node.props.children);
};

let currentId = 0;
const uuid = () => `mermaid-${(currentId++).toString()}`;

const Mermaid = ({ children }) => {
  const graphDefinition = getNodeText(children);
  const prefersColorScheme = usePrefersColorScheme();
  const [html, setHtml] = useState("");
  useLayoutEffect(() => {
    if (graphDefinition) {
      try {
        mermaid.mermaidAPI.initialize({
          startOnLoad: false,
          theme: prefersColorScheme == "dark" ? "dark" : ("neutral" as any),
        });
        mermaid.mermaidAPI.render(uuid(), graphDefinition, (svgCode) =>
          setHtml(svgCode)
        );
      } catch (e) {
        setHtml("");
        console.error(e);
      }
    }
  }, [graphDefinition, prefersColorScheme]);

  return graphDefinition ? (
    <div dangerouslySetInnerHTML={{ __html: html }} />
  ) : null;
};

export default {
  youtube: YouTubeVideo,
  term: Term,
  t: Term,
  alert: Alert,
  tab: Tab,
  tabs: Tabs,
  mermaid: Mermaid,
  collapsible: Collapsible,
  flow: FlowMD,
  task: TaskMD,
  protect: Protect,
  download: Download,
  archive: Archive,
  bookmarks: Bookmarks,
};
