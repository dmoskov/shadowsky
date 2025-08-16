export function removeTrailingSlash() {
  const path = window.location.pathname;

  // Only remove trailing slash if it's not the root path
  if (path !== "/" && path.endsWith("/")) {
    const newPath = path.slice(0, -1);
    window.history.replaceState(
      null,
      "",
      newPath + window.location.search + window.location.hash,
    );
  }
}
