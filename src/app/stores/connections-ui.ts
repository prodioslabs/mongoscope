import { create } from 'zustand'

export type ConnectionsDialogView = 'list' | 'add' | 'edit'

type ConnectionsUiState = {
  dialogOpen: boolean
  dialogView: ConnectionsDialogView
  openManage: () => void
  openAdd: () => void
  setDialogView: (view: ConnectionsDialogView) => void
  close: () => void
}

export const useConnectionsUi = create<ConnectionsUiState>((set) => ({
  dialogOpen: false,
  dialogView: 'list',

  openManage() {
    set({ dialogOpen: true, dialogView: 'list' })
  },

  openAdd() {
    set({ dialogOpen: true, dialogView: 'add' })
  },

  setDialogView(view) {
    set({ dialogView: view })
  },

  close() {
    set({ dialogOpen: false, dialogView: 'list' })
  },
}))
