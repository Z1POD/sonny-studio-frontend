// src/shared/hooks/use-telegram.ts



import { useCallback, useEffect, useMemo, useState } from "react";

// Types for Telegram WebApp

interface StoryWidgetLink {
  url: string;
  name?: string;
}

interface StoryShareParams {
  text?: string;
  widget_link?: StoryWidgetLink;
}

interface TelegramWebApp {
  initDataUnsafe?: {
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
    };
    start_param?: string;
    auth_date?: number;
    hash?: string;
    query_id?: string;
  };
  initData: string;
  ready: () => void;
  expand: () => void;
  close: () => void;
  enableClosingConfirmation: () => void;
  disableClosingConfirmation: () => void;
  isClosingConfirmationEnabled?: boolean;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
  headerColor?: string;
  backgroundColor?: string;
  HapticFeedback?: {
    impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
    notificationOccurred: (type: "error" | "success" | "warning") => void;
    selectionChanged: () => void;
  };
  shareToStory?: (mediaUrl: string, params?: StoryShareParams) => void;
  openTelegramLink: (url: string) => void;
  openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
  sendData: (data: string) => void;
  switchInlineQuery: (query: string, chooseChatTypes?: string[]) => void;
  showPopup: (params: {
    title?: string;
    message: string;
    buttons?: Array<{ id?: string; type?: string; text: string }>;
  }) => void;
  showAlert: (message: string, callback?: () => void) => void;
  showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void;
  isVersionAtLeast: (version: string) => boolean;
  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    isProgressVisible: boolean;
    setText: (text: string) => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    show: () => void;
    hide: () => void;
    enable: () => void;
    disable: () => void;
    showProgress: (leaveActive: boolean) => void;
    hideProgress: () => void;
    setParams: (params: {
      text?: string;
      color?: string;
      text_color?: string;
      is_active?: boolean;
      is_visible?: boolean;
    }) => void;
  };
  BackButton: {
    isVisible: boolean;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    show: () => void;
    hide: () => void;
  };
  themeParams: {
    bg_color?: string;
    text_color?: string;
    hint_color?: string;
    link_color?: string;
    button_color?: string;
    button_text_color?: string;
    secondary_bg_color?: string;
  };
  platform: string;
  version: string;
  colorScheme: "light" | "dark";
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  safeAreaInset: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  contentSafeAreaInset: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  onEvent: (eventType: string, callback: (...args: any[]) => void) => void;
  offEvent: (eventType: string, callback: (...args: any[]) => void) => void;
  /** Bot API 7.7+ — true fullscreen mode (distinct from `isExpanded`) */
  isFullscreen?: boolean;
  requestFullscreen?: () => void;
  exitFullscreen?: () => void;
  /** Bot API 7.7+ — prevent/allow swipe-down-to-close */
  enableVerticalSwipes?: () => void;
  disableVerticalSwipes?: () => void;
}

interface TelegramWindow extends Window {
  Telegram?: {
    WebApp: TelegramWebApp;
  };
}

// Hook

export function useTelegram() {
  const [tg, setTg] = useState<TelegramWebApp | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTelegram, setIsTelegram] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const telegram = (window as unknown as TelegramWindow).Telegram?.WebApp;
    if (!telegram) return;

    setTg(telegram);
    telegram.ready();
    telegram.expand();
    setIsReady(true);

    const hasInitData = !!telegram.initDataUnsafe?.user;
    const hasInitDataString = !!telegram.initData && telegram.initData.length > 0;
    setIsTelegram(hasInitData || hasInitDataString);

    // Bot API 7.7+ fullscreen state, kept in sync with the native event.
    setIsFullscreen(!!telegram.isFullscreen);
    const onFullscreenChanged = () => setIsFullscreen(!!telegram.isFullscreen);
    telegram.onEvent?.("fullscreenChanged", onFullscreenChanged);
    return () => telegram.offEvent?.("fullscreenChanged", onFullscreenChanged);
  }, []);

  const isShareToStoryAvailable = useCallback(() => {
    return !!tg?.shareToStory;
  }, [tg]);


  /**
   * Opens the native Telegram story editor.
   *
   * @param mediaUrl - HTTPS URL of the media (image/video)
   * @param params - StoryShareParams: { text?, widget_link?: { url, name? } }
   */
  const shareToStory = useCallback(
    (mediaUrl: string, params?: StoryShareParams) => {
      if (!tg?.shareToStory) {
        console.warn("shareToStory not available");
        return;
      }
      tg.shareToStory(mediaUrl, params);
    },
    [tg]
  );

  const openTelegramLink = useCallback(
    (url: string) => {
      tg?.openTelegramLink?.(url);
    },
    [tg]
  );

  const openLink = useCallback(
    (url: string, options?: { try_instant_view?: boolean }) => {
      tg?.openLink?.(url, options);
    },
    [tg]
  );

  const showPopup = useCallback(
    (params: { title?: string; message: string; buttons?: Array<{ id?: string; type?: string; text: string }> }) => {
      tg?.showPopup?.(params);
    },
    [tg]
  );

  const showAlert = useCallback(
    (message: string, callback?: () => void) => {
      tg?.showAlert?.(message, callback);
    },
    [tg]
  );

  const showConfirm = useCallback(
    (message: string): Promise<boolean> => {
      return new Promise((resolve) => {
        if (!tg?.showConfirm) {
          resolve(false);
          return;
        }
        tg.showConfirm(message, (confirmed) => resolve(confirmed));
      });
    },
    [tg]
  );

  const ready = useCallback(() => {
    tg?.ready?.();
  }, [tg]);

  const expand = useCallback(() => {
    tg?.expand?.();
  }, [tg]);

  const close = useCallback(() => {
    tg?.close?.();
  }, [tg]);

  const enableClosingConfirmation = useCallback(() => {
    tg?.enableClosingConfirmation?.();
  }, [tg]);

  const disableClosingConfirmation = useCallback(() => {
    tg?.disableClosingConfirmation?.();
  }, [tg]);

  const setHeaderColor = useCallback(
    (color: string) => {
      tg?.setHeaderColor?.(color);
    },
    [tg]
  );

  const setBackgroundColor = useCallback(
    (color: string) => {
      tg?.setBackgroundColor?.(color);
    },
    [tg]
  );

  /** Enter true fullscreen mode (Bot API 7.7+). */
  const requestFullscreen = useCallback(() => {
    tg?.requestFullscreen?.();
  }, [tg]);

  /** Exit true fullscreen mode (Bot API 7.7+). */
  const exitFullscreen = useCallback(() => {
    tg?.exitFullscreen?.();
  }, [tg]);

  /** Disable vertical swipe-to-close gesture (Bot API 7.7+). Safe to call on older versions. */
  const disableVerticalSwipes = useCallback(() => {
    tg?.disableVerticalSwipes?.();
  }, [tg]);

  /** Re-enable vertical swipe-to-close gesture (Bot API 7.7+). */
  const enableVerticalSwipes = useCallback(() => {
    tg?.enableVerticalSwipes?.();
  }, [tg]);

  /** Send data back to the bot (triggers the `web_app_data` update). */
  const sendData = useCallback(
    (data: string) => {
      tg?.sendData?.(data);
    },
    [tg]
  );

  const switchInlineQuery = useCallback(
    (query: string, chooseChatTypes?: string[]) => {
      tg?.switchInlineQuery?.(query, chooseChatTypes);
    },
    [tg]
  );

  const isVersionAtLeast = useCallback(
    (version: string) => {
      return tg?.isVersionAtLeast?.(version) ?? false;
    },
    [tg]
  );

  return {
    tg,
    isReady,
    isTelegram,
    isFullscreen,
    isShareToStoryAvailable,
    shareToStory,
    openTelegramLink,
    openLink,
    showPopup,
    showAlert,
    showConfirm,
    ready,
    expand,
    close,
    enableClosingConfirmation,
    disableClosingConfirmation,
    setHeaderColor,
    setBackgroundColor,
    requestFullscreen,
    exitFullscreen,
    disableVerticalSwipes,
    enableVerticalSwipes,
    sendData,
    switchInlineQuery,
    isVersionAtLeast,
    themeParams: tg?.themeParams,
    platform: tg?.platform,
    version: tg?.version,
    colorScheme: tg?.colorScheme,
    isExpanded: tg?.isExpanded,
    viewportHeight: tg?.viewportHeight,
    viewportStableHeight: tg?.viewportStableHeight,
    safeAreaInset: tg?.safeAreaInset,
    contentSafeAreaInset: tg?.contentSafeAreaInset,
    headerColor: tg?.headerColor,
    backgroundColor: tg?.backgroundColor,
    isClosingConfirmationEnabled: tg?.isClosingConfirmationEnabled,
    MainButton: tg?.MainButton,
    BackButton: tg?.BackButton,
  };
}

// Standalone utilities
// Useful outside React components (e.g. in plain event handlers or utils files).

export function getTelegramWebApp(): TelegramWebApp | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as TelegramWindow).Telegram?.WebApp ?? null;
}

export function isTelegramMiniApp(): boolean {
  const tg = getTelegramWebApp();
  if (!tg) return false;
  const hasInitData = !!tg.initData && tg.initData.length > 0;
  const hasInitDataUser = !!tg.initDataUnsafe?.user;
  return hasInitData || hasInitDataUser;
}