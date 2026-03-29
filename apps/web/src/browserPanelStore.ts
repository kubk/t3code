import type { ProjectId } from "@t3tools/contracts";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface BrowserTab {
  id: string;
  url: string;
  title: string;
}

export type ViewMode = "tabs" | "grid-2x2" | "grid-2x3" | "grid-3x3";

interface ProjectBrowserState {
  tabs: BrowserTab[];
  activeTabId: string;
  viewMode: ViewMode;
  gridCellTabIds: string[];
  zoom: number;
}

const BROWSER_PANEL_STORAGE_KEY = "t3code:browser-panel:v1";

let nextTabId = 1;
function generateTabId(): string {
  return `browser-tab-${Date.now()}-${nextTabId++}`;
}

function gridCellCount(mode: ViewMode): number {
  if (mode === "grid-2x2") return 4;
  if (mode === "grid-2x3") return 6;
  if (mode === "grid-3x3") return 9;
  return 0;
}

const DEFAULT_PROJECT_BROWSER_STATE: ProjectBrowserState = {
  tabs: [],
  activeTabId: "",
  viewMode: "tabs",
  gridCellTabIds: [],
  zoom: 1,
};

const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2] as const;

export function zoomIn(current: number): number {
  return ZOOM_STEPS.find((s) => s > current + 0.001) ?? current;
}

export function zoomOut(current: number): number {
  return [...ZOOM_STEPS].reverse().find((s) => s < current - 0.001) ?? current;
}

function getProjectState(
  stateByProjectId: Record<ProjectId, ProjectBrowserState>,
  projectId: ProjectId,
): ProjectBrowserState {
  return stateByProjectId[projectId] ?? DEFAULT_PROJECT_BROWSER_STATE;
}

interface BrowserPanelStoreState {
  browserStateByProjectId: Record<ProjectId, ProjectBrowserState>;
  openUrlInProject: (projectId: ProjectId, url: string) => void;
  addTab: (projectId: ProjectId, url?: string) => void;
  closeTab: (projectId: ProjectId, tabId: string) => void;
  setActiveTab: (projectId: ProjectId, tabId: string) => void;
  navigateTab: (projectId: ProjectId, tabId: string, url: string) => void;
  setTabTitle: (projectId: ProjectId, tabId: string, title: string) => void;
  setViewMode: (projectId: ProjectId, viewMode: ViewMode) => void;
  setZoom: (projectId: ProjectId, zoom: number) => void;
}

export const useBrowserPanelStore = create<BrowserPanelStoreState>()(
  persist(
    (set) => {
      const updateProject = (
        projectId: ProjectId,
        updater: (state: ProjectBrowserState) => ProjectBrowserState,
      ) => {
        set((store) => {
          const current = getProjectState(store.browserStateByProjectId, projectId);
          const next = updater(current);
          if (next === current) return store;
          return {
            browserStateByProjectId: {
              ...store.browserStateByProjectId,
              [projectId]: next,
            },
          };
        });
      };

      return {
        browserStateByProjectId: {},

        openUrlInProject: (projectId, url) => {
          updateProject(projectId, (state) => {
            // If there are no tabs, create one with this URL
            if (state.tabs.length === 0) {
              const id = generateTabId();
              return {
                ...state,
                tabs: [{ id, url, title: url }],
                activeTabId: id,
              };
            }
            // Navigate the active tab to this URL
            return {
              ...state,
              tabs: state.tabs.map((tab) =>
                tab.id === state.activeTabId ? { ...tab, url, title: url } : tab,
              ),
            };
          });
        },

        addTab: (projectId, url) => {
          updateProject(projectId, (state) => {
            const id = generateTabId();
            const tabUrl = url ?? "about:blank";
            return {
              ...state,
              tabs: [...state.tabs, { id, url: tabUrl, title: tabUrl }],
              activeTabId: id,
            };
          });
        },

        closeTab: (projectId, tabId) => {
          updateProject(projectId, (state) => {
            const remaining = state.tabs.filter((tab) => tab.id !== tabId);
            if (remaining.length === 0) {
              return DEFAULT_PROJECT_BROWSER_STATE;
            }
            const closedIndex = state.tabs.findIndex((tab) => tab.id === tabId);
            const nextActiveId =
              state.activeTabId === tabId
                ? (remaining[Math.min(closedIndex, remaining.length - 1)]?.id ??
                  remaining[0]?.id ??
                  "")
                : state.activeTabId;

            // If the closed tab was in the grid, replace it with a new blank tab
            const cellIndex = state.gridCellTabIds.indexOf(tabId);
            if (cellIndex !== -1) {
              const newId = generateTabId();
              const newTab: BrowserTab = { id: newId, url: "", title: "New Tab" };
              const newGridCellTabIds = [...state.gridCellTabIds];
              newGridCellTabIds[cellIndex] = newId;
              return {
                ...state,
                tabs: [...remaining, newTab],
                activeTabId: nextActiveId === tabId ? newId : nextActiveId,
                gridCellTabIds: newGridCellTabIds,
              };
            }

            return { ...state, tabs: remaining, activeTabId: nextActiveId };
          });
        },

        setActiveTab: (projectId, tabId) => {
          updateProject(projectId, (state) => {
            if (state.activeTabId === tabId) return state;
            if (!state.tabs.some((tab) => tab.id === tabId)) return state;
            return { ...state, activeTabId: tabId };
          });
        },

        navigateTab: (projectId, tabId, url) => {
          updateProject(projectId, (state) => ({
            ...state,
            tabs: state.tabs.map((tab) => (tab.id === tabId ? { ...tab, url, title: url } : tab)),
          }));
        },

        setTabTitle: (projectId, tabId, title) => {
          updateProject(projectId, (state) => ({
            ...state,
            tabs: state.tabs.map((tab) => (tab.id === tabId ? { ...tab, title } : tab)),
          }));
        },

        setViewMode: (projectId, viewMode) => {
          updateProject(projectId, (state) => {
            if (state.viewMode === viewMode) return state;

            if (viewMode === "tabs") {
              return { ...state, viewMode: "tabs", gridCellTabIds: [] };
            }

            // Switching to a grid mode: fill cells from existing tabs, create blanks for the rest
            const cellCount = gridCellCount(viewMode);
            const existingTabIds = state.tabs.map((t) => t.id);
            const cellTabIds = existingTabIds.slice(0, cellCount);
            const newTabs: BrowserTab[] = [];

            while (cellTabIds.length < cellCount) {
              const id = generateTabId();
              newTabs.push({ id, url: "", title: "New Tab" });
              cellTabIds.push(id);
            }

            const activeTabId = cellTabIds.includes(state.activeTabId)
              ? state.activeTabId
              : cellTabIds[0]!;

            return {
              ...state,
              viewMode,
              tabs: newTabs.length > 0 ? [...state.tabs, ...newTabs] : state.tabs,
              gridCellTabIds: cellTabIds,
              activeTabId,
            };
          });
        },

        setZoom: (projectId, zoom) => {
          updateProject(projectId, (state) => {
            if (state.zoom === zoom) return state;
            return { ...state, zoom };
          });
        },
      };
    },
    {
      name: BROWSER_PANEL_STORAGE_KEY,
      version: 3,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        browserStateByProjectId: state.browserStateByProjectId,
      }),
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as {
          browserStateByProjectId: Record<string, Record<string, unknown>>;
        };
        if (version < 3) {
          return {
            browserStateByProjectId: Object.fromEntries(
              Object.entries(state.browserStateByProjectId).map(([pid, ps]) => [
                pid,
                {
                  ...ps,
                  viewMode: (ps as { viewMode?: string }).viewMode ?? "tabs",
                  gridCellTabIds: (ps as { gridCellTabIds?: string[] }).gridCellTabIds ?? [],
                  zoom: 1,
                },
              ]),
            ),
          };
        }
        return persistedState;
      },
    },
  ),
);

export function selectProjectBrowserState(
  browserStateByProjectId: Record<ProjectId, ProjectBrowserState>,
  projectId: ProjectId,
): ProjectBrowserState {
  const stored = browserStateByProjectId[projectId];
  if (!stored) return DEFAULT_PROJECT_BROWSER_STATE;
  // Backfill zoom for pre-v3 persisted state without creating new objects on every call
  if (stored.zoom == null) {
    stored.zoom = 1;
  }
  return stored;
}
