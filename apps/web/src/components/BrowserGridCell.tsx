import type { ProjectId } from "@t3tools/contracts";
import { RefreshCwIcon, XIcon } from "lucide-react";
import { memo, useCallback, useRef, useState, type KeyboardEvent } from "react";
import { useBrowserPanelStore, type BrowserTab } from "../browserPanelStore";
import { cn } from "~/lib/utils";

interface BrowserGridCellProps {
  projectId: ProjectId;
  tab: BrowserTab;
  isFocused: boolean;
  onCellMouseDown: (tabId: string) => void;
  zoom: number;
}

const BrowserGridCell = memo(function BrowserGridCell({
  projectId,
  tab,
  isFocused,
  onCellMouseDown,
  zoom,
}: BrowserGridCellProps) {
  const setActiveTab = useBrowserPanelStore((s) => s.setActiveTab);
  const navigateTab = useBrowserPanelStore((s) => s.navigateTab);
  const closeTab = useBrowserPanelStore((s) => s.closeTab);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [inputValue, setInputValue] = useState(tab.url);

  const lastUrlRef = useRef(tab.url);
  if (tab.url !== lastUrlRef.current) {
    lastUrlRef.current = tab.url;
    setInputValue(tab.url);
  }

  const handleSubmit = useCallback(() => {
    let normalized = inputValue.trim();
    if (normalized.length === 0) return;
    if (!/^https?:\/\//i.test(normalized)) {
      normalized = `http://${normalized}`;
    }
    navigateTab(projectId, tab.id, normalized);
  }, [inputValue, navigateTab, projectId, tab.id]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const handleRefresh = useCallback(() => {
    const iframe = iframeRef.current;
    if (iframe) {
      iframe.src = iframe.src;
    }
  }, []);

  const handleMouseDown = useCallback(() => {
    setActiveTab(projectId, tab.id);
    onCellMouseDown(tab.id);
  }, [setActiveTab, projectId, tab.id, onCellMouseDown]);

  return (
    <div
      data-cell-tab-id={tab.id}
      className={cn(
        "flex min-h-0 min-w-0 flex-col overflow-hidden",
        isFocused ? "ring-2 ring-ring" : "ring-1 ring-border",
      )}
      onMouseDown={handleMouseDown}
    >
      {/* Compact URL bar */}
      <div className="flex shrink-0 items-center gap-0.5 border-b border-border px-1 py-0.5">
        <button
          type="button"
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={handleRefresh}
          aria-label="Refresh"
        >
          <RefreshCwIcon className="size-2.5" />
        </button>
        <input
          type="text"
          className="min-w-0 flex-1 rounded bg-muted/50 px-1.5 py-0.5 text-[11px] text-foreground outline-none ring-1 ring-border focus:ring-ring"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSubmit}
          placeholder="URL..."
          spellCheck={false}
        />
        <button
          type="button"
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={() => closeTab(projectId, tab.id)}
          aria-label="Close cell"
        >
          <XIcon className="size-2.5" />
        </button>
      </div>

      {/* iframe */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <iframe
          ref={iframeRef}
          src={tab.url || undefined}
          title={tab.title || tab.url || "New Tab"}
          className="absolute border-none bg-white"
          style={{
            transformOrigin: "top left",
            transform: `scale(${zoom})`,
            width: `${100 / zoom}%`,
            height: `${100 / zoom}%`,
          }}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        />
      </div>
    </div>
  );
});

export default BrowserGridCell;
