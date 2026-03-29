import type { ProjectId } from "@t3tools/contracts";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  useBrowserPanelStore,
  selectProjectBrowserState,
  type ViewMode,
} from "../browserPanelStore";
import BrowserGridCell from "./BrowserGridCell";

interface BrowserGridViewProps {
  projectId: ProjectId;
}

function gridDimensions(mode: ViewMode): { cols: number; rows: number } {
  if (mode === "grid-2x2") return { cols: 2, rows: 2 };
  if (mode === "grid-2x3") return { cols: 3, rows: 2 };
  if (mode === "grid-3x3") return { cols: 3, rows: 3 };
  return { cols: 1, rows: 1 };
}

/**
 * Tracks which grid cell has focus, including when focus is inside a cross-origin iframe.
 * CSS :focus-within doesn't work for cross-origin iframes, so we poll document.activeElement
 * while the window is blurred (i.e. focus is inside an iframe).
 */
function useFocusedCell(gridRef: React.RefObject<HTMLDivElement | null>) {
  const [focusedCellId, setFocusedCellId] = useState<string | null>(null);
  const windowBlurredRef = useRef(false);
  const rafRef = useRef<number>(0);

  const checkActiveIframe = useCallback(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const active = document.activeElement;
    if (active?.tagName === "IFRAME" && grid.contains(active)) {
      const cellId = active.closest("[data-cell-tab-id]")?.getAttribute("data-cell-tab-id");
      if (cellId) setFocusedCellId(cellId);
    } else if (!active || !grid.contains(active)) {
      setFocusedCellId(null);
    }
  }, [gridRef]);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (pollTimer) return;
      pollTimer = setInterval(checkActiveIframe, 150);
    };

    const stopPolling = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    const handleWindowBlur = () => {
      windowBlurredRef.current = true;
      // Immediate check + start polling for iframe switches
      rafRef.current = requestAnimationFrame(() => {
        checkActiveIframe();
        startPolling();
      });
    };

    const handleWindowFocus = () => {
      windowBlurredRef.current = false;
      stopPolling();
      rafRef.current = requestAnimationFrame(() => {
        const active = document.activeElement;
        if (!active || !grid.contains(active)) {
          setFocusedCellId(null);
        }
      });
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (!grid.contains(e.target as Node)) {
        setFocusedCellId(null);
      }
    };

    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", handleWindowFocus);
    window.addEventListener("mousedown", handleMouseDown);
    return () => {
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("focus", handleWindowFocus);
      window.removeEventListener("mousedown", handleMouseDown);
      stopPolling();
      cancelAnimationFrame(rafRef.current);
    };
  }, [gridRef, checkActiveIframe]);

  return { focusedCellId, setFocusedCellId };
}

const BrowserGridView = memo(function BrowserGridView({ projectId }: BrowserGridViewProps) {
  const browserState = useBrowserPanelStore((store) =>
    selectProjectBrowserState(store.browserStateByProjectId, projectId),
  );

  const { cols, rows } = gridDimensions(browserState.viewMode);
  const tabMap = new Map(browserState.tabs.map((t) => [t.id, t]));
  const gridRef = useRef<HTMLDivElement>(null);
  const { focusedCellId, setFocusedCellId } = useFocusedCell(gridRef);

  const handleCellMouseDown = useCallback(
    (tabId: string) => {
      setFocusedCellId(tabId);
    },
    [setFocusedCellId],
  );

  return (
    <div
      ref={gridRef}
      className="grid h-full gap-px bg-border"
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
      }}
    >
      {browserState.gridCellTabIds.map((tabId) => {
        const tab = tabMap.get(tabId);
        if (!tab) return null;
        return (
          <BrowserGridCell
            key={tab.id}
            projectId={projectId}
            tab={tab}
            isFocused={tab.id === focusedCellId}
            onCellMouseDown={handleCellMouseDown}
            zoom={browserState.zoom}
          />
        );
      })}
    </div>
  );
});

export default BrowserGridView;
