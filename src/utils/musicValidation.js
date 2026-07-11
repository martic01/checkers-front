const ALLOWED_EXTENSIONS = ["mp3", "wav", "ogg", "m4a", "aac", "flac"];
const MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25MB is plenty for background music

export async function validateAndLoadMusicFile(file) {
  if (!file) throw new Error("No file selected");

  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error(`Unsupported file type. Use: ${ALLOWED_EXTENSIONS.join(", ")}`);
  }

  // Browsers report the sniffed MIME type here; reject anything that isn't
  // actually audio even if the extension was renamed to look like one.
  if (file.type && !file.type.startsWith("audio/")) {
    throw new Error("That file doesn't look like an audio file");
  }

  if (file.size > MAX_SIZE_BYTES) {
    throw new Error("File is too large (25MB max)");
  }
  if (file.size === 0) {
    throw new Error("That file is empty");
  }

  const url = URL.createObjectURL(file);

  // Actually try to decode it — this is what catches corrupt or disguised
  // (non-audio) files that slipped past the extension/MIME checks above.
  await new Promise((resolve, reject) => {
    const probe = new Audio();
    const cleanup = () => {
      probe.removeEventListener("loadedmetadata", onOk);
      probe.removeEventListener("error", onErr);
    };
    const onOk = () => {
      cleanup();
      resolve();
    };
    const onErr = () => {
      cleanup();
      URL.revokeObjectURL(url);
      reject(new Error("This file appears to be corrupt or isn't a playable audio file"));
    };
    probe.addEventListener("loadedmetadata", onOk);
    probe.addEventListener("error", onErr);
    probe.src = url;
  });

  return url;
}

export { ALLOWED_EXTENSIONS };
