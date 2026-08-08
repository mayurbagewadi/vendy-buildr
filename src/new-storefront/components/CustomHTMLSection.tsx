import { useEffect, useRef, useState } from "react";

const MAX_BYTES = 50 * 1024;

const HEIGHT_SCRIPT = [
  "(function(){",
  "function s(){parent.postMessage({type:'vendy-iframe-height',h:document.documentElement.scrollHeight},'*');}",
  "var ro=new ResizeObserver(s);ro.observe(document.documentElement);s();",
  "})();"
].join("");

function buildSrcdoc(html: string): string {
  return [
    "<!DOCTYPE html><html><head>",
    "<meta charset=\"utf-8\">",
    "<style>*{box-sizing:border-box}body{margin:0;padding:0}</style>",
    "</head><body>",
    html,
    "<script>" + HEIGHT_SCRIPT + "<" + "/script>",
    "</body></html>",
  ].join("");
}

interface CustomHTMLSectionProps {
  htmlContent: string;
}

export function CustomHTMLSection({ htmlContent }: CustomHTMLSectionProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState(120);
  const byteLen = new TextEncoder().encode(htmlContent).length;

  useEffect(() => {
    if (iframeRef.current) {
      // Chrome/Edge defense-in-depth: block network requests from the sandboxed iframe
      iframeRef.current.setAttribute("csp", "connect-src 'none'; script-src 'unsafe-inline'");
    }
  }, []);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (
        event.data &&
        typeof event.data === "object" &&
        event.data.type === "vendy-iframe-height" &&
        typeof event.data.h === "number"
      ) {
        setIframeHeight(Math.max(40, Math.min(event.data.h, 4000)));
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  if (!htmlContent.trim()) return null;

  if (byteLen > MAX_BYTES) {
    return (
      <div className="mx-4 my-2 flex items-center justify-center rounded-md border border-border py-8 text-sm text-muted-foreground">
        Custom HTML block exceeds 50 KB limit.
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      srcDoc={buildSrcdoc(htmlContent)}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      loading="lazy"
      title="Custom HTML block"
      className="block w-full border-0"
      style={{ height: `${iframeHeight}px` }}
    />
  );
}
