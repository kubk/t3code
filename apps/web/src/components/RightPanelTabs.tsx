import type { ProjectId } from "@t3tools/contracts";
import { MinusIcon, PlusIcon, RefreshCwIcon } from "lucide-react";
import { Suspense, lazy, useCallback, type ReactNode } from "react";
import { cn } from "~/lib/utils";
import {
  useBrowserPanelStore,
  selectProjectBrowserState,
  zoomIn,
  zoomOut,
  type ViewMode,
} from "../browserPanelStore";
import type { RightPanelTab } from "../diffRouteSearch";
import type { DiffPanelMode } from "./DiffPanelShell";
import { DiffPanelHeaderSkeleton, DiffPanelLoadingState, DiffPanelShell } from "./DiffPanelShell";
import { DiffWorkerPoolProvider } from "./DiffWorkerPoolProvider";
import { ViewModeToggle } from "./BrowserPanel";

const DiffPanel = lazy(() => import("./DiffPanel"));
const BrowserPanel = lazy(() => import("./BrowserPanel"));

function DiffLoadingFallback({ mode }: { mode: DiffPanelMode }) {
  return (
    <DiffPanelShell mode={mode} header={<DiffPanelHeaderSkeleton />}>
      <DiffPanelLoadingState label="Loading diff viewer..." />
    </DiffPanelShell>
  );
}

function BrowserLoadingFallback() {
  return (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      <p className="text-sm">Loading browser...</p>
    </div>
  );
}

interface RightPanelTabsProps {
  activeTab: RightPanelTab;
  onTabChange: (tab: RightPanelTab) => void;
  mode: DiffPanelMode;
  projectId: ProjectId | null;
  renderDiff: boolean;
  renderBrowser: boolean;
}

export function RightPanelTabs({
  activeTab,
  onTabChange,
  mode,
  projectId,
  renderDiff,
  renderBrowser,
}: RightPanelTabsProps) {
  const browserState = useBrowserPanelStore((store) =>
    projectId ? selectProjectBrowserState(store.browserStateByProjectId, projectId) : null,
  );
  const setViewModeAction = useBrowserPanelStore((store) => store.setViewMode);
  const setZoomAction = useBrowserPanelStore((store) => store.setZoom);
  const handleSetViewMode = useCallback(
    (vm: ViewMode) => {
      if (projectId) setViewModeAction(projectId, vm);
    },
    [projectId, setViewModeAction],
  );
  const handleZoomIn = useCallback(() => {
    if (projectId && browserState) setZoomAction(projectId, zoomIn(browserState.zoom));
  }, [projectId, browserState, setZoomAction]);
  const handleZoomOut = useCallback(() => {
    if (projectId && browserState) setZoomAction(projectId, zoomOut(browserState.zoom));
  }, [projectId, browserState, setZoomAction]);
  const handleZoomReset = useCallback(() => {
    if (projectId) setZoomAction(projectId, 1);
  }, [projectId, setZoomAction]);

  return (
    <div className="flex h-full flex-col">
      {/* Tab switcher */}
      <div className="flex shrink-0 items-center gap-0.5 border-b border-border px-2 py-1">
        <TabButton active={activeTab === "diff"} onClick={() => onTabChange("diff")}>
          Diff
        </TabButton>
        <TabButton active={activeTab === "browser"} onClick={() => onTabChange("browser")}>
          Browser
        </TabButton>
        {activeTab === "browser" && projectId && browserState && (
          <div className="ml-auto flex items-center gap-1">
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                onClick={handleZoomOut}
                aria-label="Zoom out"
                title="Zoom out"
              >
                <MinusIcon className="size-3" />
              </button>
              <button
                type="button"
                className="min-w-[3ch] rounded px-1 py-0.5 text-center text-[10px] text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                onClick={handleZoomReset}
                title="Reset zoom"
              >
                {Math.round(browserState.zoom * 100)}%
              </button>
              <button
                type="button"
                className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                onClick={handleZoomIn}
                aria-label="Zoom in"
                title="Zoom in"
              >
                <PlusIcon className="size-3" />
              </button>
            </div>
            <button
              type="button"
              className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              onClick={() => {
                document.querySelectorAll<HTMLIFrameElement>("iframe").forEach((iframe) => {
                  if (iframe.src) iframe.src = iframe.src;
                });
              }}
              aria-label="Reload all tabs"
              title="Reload all tabs"
            >
              <RefreshCwIcon className="size-3" />
            </button>
            <ViewModeToggle currentMode={browserState.viewMode} onSetMode={handleSetViewMode} />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="relative min-h-0 flex-1">
        <div className={cn("absolute inset-0", activeTab === "diff" ? "block" : "hidden")}>
          {renderDiff ? (
            <DiffWorkerPoolProvider>
              <Suspense fallback={<DiffLoadingFallback mode={mode} />}>
                <DiffPanel mode={mode} />
              </Suspense>
            </DiffWorkerPoolProvider>
          ) : null}
        </div>
        <div className={cn("absolute inset-0", activeTab === "browser" ? "block" : "hidden")}>
          {renderBrowser && projectId ? (
            <Suspense fallback={<BrowserLoadingFallback />}>
              <BrowserPanel projectId={projectId} />
            </Suspense>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
