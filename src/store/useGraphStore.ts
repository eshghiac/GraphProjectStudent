import { create } from 'zustand';
import { SESSION_ACCOUNTS } from '../domain/mockDatabase';
import { WorkspaceTab } from '../domain/types';

export type SelectionTarget =
  | { kind: 'node'; id: string }
  | { kind: 'edge'; id: string }
  | null;

interface GraphWorkspaceState {
  sessionToken: string;
  activeTab: WorkspaceTab;
  selection: SelectionTarget;
  zoom: number;
  panX: number;
  panY: number;
  showMiniMap: boolean;
  simulateServerOutage: boolean;
  isSessionDialogOpen: boolean;
  nodeOffsets: Record<string, { x: number; y: number }>;

  setSessionToken: (token: string) => void;
  setActiveTab: (tab: WorkspaceTab) => void;
  selectNode: (nodeId: string | null) => void;
  selectEdge: (edgeId: string | null) => void;
  clearSelection: () => void;
  setCamera: (camera: { zoom?: number; panX?: number; panY?: number }) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  toggleMiniMap: () => void;
  setSimulateServerOutage: (enabled: boolean) => void;
  setSessionDialogOpen: (open: boolean) => void;
  updateNodeOffset: (nodeId: string, dx: number, dy: number) => void;
  setNodeOffset: (nodeId: string, pos: { x: number; y: number }) => void;
  resetNodePositions: () => void;
}

export const MIN_ZOOM = 0.45;
export const MAX_ZOOM = 1.85;

export const useGraphStore = create<GraphWorkspaceState>((set) => ({
  sessionToken: SESSION_ACCOUNTS[0].sessionToken,
  activeTab: WorkspaceTab.Graph,
  selection: null,
  zoom: 0.8,
  panX: 0,
  panY: 0,
  showMiniMap: true,
  simulateServerOutage: false,
  isSessionDialogOpen: false,
  nodeOffsets: {},

  setSessionToken: (token) =>
    set({
      sessionToken: token,
      selection: null,
      simulateServerOutage: false,
      isSessionDialogOpen: false,
      nodeOffsets: {},
    }),

  setActiveTab: (tab) => set({ activeTab: tab }),

  selectNode: (nodeId) =>
    set({
      selection: nodeId ? { kind: 'node', id: nodeId } : null,
    }),

  selectEdge: (edgeId) =>
    set({
      selection: edgeId ? { kind: 'edge', id: edgeId } : null,
    }),

  clearSelection: () => set({ selection: null }),

  setCamera: (camera) =>
    set((state) => ({
      zoom:
        camera.zoom !== undefined
          ? Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(camera.zoom.toFixed(3))))
          : state.zoom,
      panX: camera.panX !== undefined ? Math.round(camera.panX) : state.panX,
      panY: camera.panY !== undefined ? Math.round(camera.panY) : state.panY,
    })),

  zoomIn: () =>
    set((state) => ({
      zoom: Math.min(MAX_ZOOM, Number((state.zoom + 0.15).toFixed(2))),
    })),

  zoomOut: () =>
    set((state) => ({
      zoom: Math.max(MIN_ZOOM, Number((state.zoom - 0.15).toFixed(2))),
    })),

  toggleMiniMap: () => set((state) => ({ showMiniMap: !state.showMiniMap })),

  setSimulateServerOutage: (enabled) => set({ simulateServerOutage: enabled }),

  setSessionDialogOpen: (open) => set({ isSessionDialogOpen: open }),

  updateNodeOffset: (nodeId, dx, dy) =>
    set((state) => {
      const prev = state.nodeOffsets[nodeId] || { x: 0, y: 0 };
      return {
        nodeOffsets: {
          ...state.nodeOffsets,
          [nodeId]: {
            x: Math.round(prev.x + dx),
            y: Math.round(prev.y + dy),
          },
        },
      };
    }),

  setNodeOffset: (nodeId, pos) =>
    set((state) => ({
      nodeOffsets: {
        ...state.nodeOffsets,
        [nodeId]: {
          x: Math.round(pos.x),
          y: Math.round(pos.y),
        },
      },
    })),

  resetNodePositions: () => set({ nodeOffsets: {} }),
}));
