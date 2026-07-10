export const ENVIRONMENT_FILES: Record<string, string> = (() => {
  try {
    const parsed = JSON.parse(
      import.meta.env.VITE_STUDIO_ENV_FILES ?? "{}"
    );

    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    console.warn(
      "Invalid VITE_STUDIO_ENV_FILES. Falling back to an empty mapping."
    );

    return {};
  }
})();
