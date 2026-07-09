import { create } from "zustand";

export const useUIStore = create((set, get) => ({
  toasts: [],
  confirmState: null, // { title, message, confirmLabel, cancelLabel, tone, resolve }
  promptState: null, // { title, message, defaultValue, placeholder, confirmLabel, resolve }
  profileTarget: null, // player id (string) or an already-fetched public profile object

  pushToast: (toast) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    set((s) => ({ toasts: [...s.toasts, { id, type: "info", ...toast }] }));
    const duration = toast.duration ?? 3400;
    setTimeout(() => get().dismissToast(id), duration);
    return id;
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  confirm: (opts = {}) =>
    new Promise((resolve) => {
      set({
        confirmState: {
          title: "Are you sure?",
          message: "",
          confirmLabel: "Confirm",
          cancelLabel: "Cancel",
          tone: "default",
          ...opts,
          resolve,
        },
      });
    }),
  resolveConfirm: (value) => {
    get().confirmState?.resolve(value);
    set({ confirmState: null });
  },

  prompt: (opts = {}) =>
    new Promise((resolve) => {
      set({
        promptState: {
          title: "Enter a value",
          message: "",
          defaultValue: "",
          placeholder: "",
          confirmLabel: "OK",
          ...opts,
          resolve,
        },
      });
    }),
  resolvePrompt: (value) => {
    get().promptState?.resolve(value);
    set({ promptState: null });
  },

  openProfile: (target) => set({ profileTarget: target }),
  closeProfile: () => set({ profileTarget: null }),
}));

// Plain-function helpers so non-component code (API client, socket handlers)
// can trigger UI feedback without needing to be a React component.
export const toastError = (message, extra) => useUIStore.getState().pushToast({ type: "error", message, ...extra });
export const toastSuccess = (message, extra) => useUIStore.getState().pushToast({ type: "success", message, ...extra });
export const toastInfo = (message, extra) => useUIStore.getState().pushToast({ type: "info", message, ...extra });
export const confirmDialog = (opts) => useUIStore.getState().confirm(opts);
export const promptDialog = (opts) => useUIStore.getState().prompt(opts);
export const openProfile = (target) => useUIStore.getState().openProfile(target);
