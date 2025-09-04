/**
 * Proxy images through our server to avoid CORS issues when generating alt text
 */

// Get the proxy server URL based on environment
const getProxyServerUrl = () => {
  if (import.meta.env.DEV) {
    // In development, we can fetch directly from CDN due to Vite proxy
    return null;
  }

  // In production, use the proxy server
  // You'll need to update this to your actual production server URL
  return import.meta.env.VITE_PROXY_SERVER_URL || "https://api.shadowsky.io";
};

/**
 * Get a proxied URL for an image to avoid CORS issues
 * Only used for alt text generation where we need to fetch the image data
 */
export async function getProxiedImageUrl(originalUrl: string): Promise<string> {
  const proxyServer = getProxyServerUrl();

  // In development or if URL is already local, return as-is
  if (!proxyServer || !originalUrl.includes("cdn.bsky.app")) {
    return originalUrl;
  }

  // Use the proxy endpoint
  const proxyUrl = `${proxyServer}/api/proxy-image?${new URLSearchParams({ url: originalUrl })}`;
  return proxyUrl;
}

/**
 * Fetch an image through our proxy to avoid CORS issues
 * Returns a blob URL that can be used for alt text generation
 */
export async function fetchImageThroughProxy(
  imageUrl: string,
): Promise<string> {
  const proxiedUrl = await getProxiedImageUrl(imageUrl);

  // Fetch the image (either directly or through proxy)
  const response = await fetch(proxiedUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}
