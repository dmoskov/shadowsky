export const OPEN_THREAD_KEY = "shadowsky:open-thread";

export const MOBILE_CONFIG = {
  PAGE_SIZE: window.innerWidth < 768 ? 20 : 30,
  STALE_TIME: window.innerWidth < 768 ? 15 * 60 * 1000 : 30 * 60 * 1000,
  GC_TIME: window.innerWidth < 768 ? 30 * 60 * 1000 : 60 * 60 * 1000,
  MAX_PAGES: window.innerWidth < 768 ? 5 : 10,
  VIRTUAL_OVERSCAN: window.innerWidth < 768 ? 3 : 5,
};
