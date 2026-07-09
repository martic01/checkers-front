// Simple built-in avatar set so accounts work fully offline with no image
// hosting required. A custom photo (data URL) is also supported via
// { type: "custom", value: "data:image/..." }.
export const DEFAULT_AVATARS = [
  { id: "avatar-1", emoji: "🦉", bg: "#4a2e1e" },
  { id: "avatar-2", emoji: "🦁", bg: "#5b3722" },
  { id: "avatar-3", emoji: "🐺", bg: "#2b1810" },
  { id: "avatar-4", emoji: "🦅", bg: "#3a2f4a" },
  { id: "avatar-5", emoji: "🐉", bg: "#521d1d" },
  { id: "avatar-6", emoji: "🦊", bg: "#6e2a2a" },
  { id: "avatar-7", emoji: "🐢", bg: "#241f1c" },
  { id: "avatar-8", emoji: "🦄", bg: "#43271a" },
];

export function getAvatarMeta(id) {
  return DEFAULT_AVATARS.find((a) => a.id === id) || DEFAULT_AVATARS[0];
}
