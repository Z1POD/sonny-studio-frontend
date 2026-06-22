/**
 * src/shared/hooks/use-telegram.ts
 *
 * Telegram Mini App integration utilities.
 */

import { useCallback, useEffect, useState } from "react";

// ─── Types for Telegram WebApp ─────────────────────────────────────────────

interface StoryWidgetLink {
  url: string;
  name?: string;
}

interface StoryShareParams {
  text?: string;
  widget_link?: StoryWidgetLink;
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
    };
    query_id?: string;
    auth_date?: number;
    hash?: string;
  };
  version: string;
  platform: string;
  colorScheme: "light" | "dark";
  themeParams: Record<string, string>;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  headerColor: string;
  backgroundColor: string;
  isClosingConfirmationEnabled: boolean;
  BackButton: {
    isVisible: boolean;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    show: () => void;
    hide: () => void;
  };
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
  };
  HapticFeedback: {
    impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
    notificationOccurred: (type: "error" | "success" | "warning") => void;
    selectionChanged: () => void;
  };
  shareToStory: (mediaUrl: string, params?: StoryShareParams) => void;
  openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
  openTelegramLink: (url: string) => void;
  close: () => void;
  ready: () => void;
  expand: () => void;
  enableClosingConfirmation: () => void;
  disableClosingConfirmation: () => void;
  onEvent: (eventType: string, callback: (...args: any[]) => void) => void;
  offEvent: (eventType: string, callback: (...args: any[]) => void) => void;
  sendData: (data: string) => void;
  switchInlineQuery: (query: string, chooseChatTypes?: string[]) => void;
  showPopup: (params: {
    title?: string;
    message: string;
    buttons?: Array<{ id?: string; type?: string; text?: string }>;
  }) => void;
  showAlert: (message: string, callback?: () => void) => void;
  showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void;
  isVersionAtLeast: (version: string) => boolean;
  /** Bot API 7.7+ — fullscreen mode */
  isFullscreen?: boolean;
  requestFullscreen?: () => void;
  exitFullscreen?: () => void;
  /** Bot API 7.7+ — prevent swipe-down-to-close */
  disableVerticalSwipes?: () => void;
  enableVerticalSwipes?: () => void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useTelegram() {
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      setWebApp(tg);
      tg.ready();
      setIsReady(true);
      // Detect fullscreen mode (Bot API 7.7+)
      setIsFullscreen(!!tg.isFullscreen);
      // Keep in sync if TG fires fullscreen change events
      const onFullscreenChanged = () => setIsFullscreen(!!tg.isFullscreen);
      tg.onEvent?.("fullscreenChanged", onFullscreenChanged);
      return () => tg.offEvent?.("fullscreenChanged", onFullscreenChanged);
    }
  }, []);

  const isInTelegramMiniApp = useCallback(() => {
    return !!webApp && !!webApp.initData && webApp.initData.length > 0;
  }, [webApp]);

  const isShareToStoryAvailable = useCallback(() => {
    return isInTelegramMiniApp() && !!webApp?.shareToStory;
  }, [webApp, isInTelegramMiniApp]);

  const shareToStory = useCallback(
    (mediaUrl: string, text?: string, widgetLink?: { url: string; name?: string }) => {
      if (!webApp?.shareToStory) {
        throw new Error("shareToStory is not available");
      }
      const params: StoryShareParams = {};
      if (text) params.text = text;
      if (widgetLink) params.widget_link = widgetLink;
      webApp.shareToStory(mediaUrl, params);
    },
    [webApp],
  );

  const openLink = useCallback(
    (url: string, options?: { try_instant_view?: boolean }) => {
      webApp?.openLink(url, options);
    },
    [webApp],
  );

  const openTelegramLink = useCallback(
    (url: string) => {
      webApp?.openTelegramLink(url);
    },
    [webApp],
  );

  const showAlert = useCallback(
    (message: string, callback?: () => void) => {
      webApp?.showAlert(message, callback);
    },
    [webApp],
  );

  const hapticFeedback = useCallback(
    (type: "success" | "error" | "warning" = "success") => {
      webApp?.HapticFeedback?.notificationOccurred(type);
    },
    [webApp],
  );

  /** Prevent swipe-down-to-close (Bot API 7.7+). Safe to call on older versions. */
  const disableVerticalSwipes = useCallback(() => {
    webApp?.disableVerticalSwipes?.();
  }, [webApp]);

  /** Re-enable swipe-down-to-close (Bot API 7.7+). */
  const enableVerticalSwipes = useCallback(() => {
    webApp?.enableVerticalSwipes?.();
  }, [webApp]);

  return {
    webApp,
    isReady,
    /** True when running inside a Telegram Mini App (has initData). */
    isTelegram: isInTelegramMiniApp(),
    isFullscreen,
    isInTelegramMiniApp,
    isShareToStoryAvailable,
    shareToStory,
    openLink,
    openTelegramLink,
    showAlert,
    hapticFeedback,
    disableVerticalSwipes,
    enableVerticalSwipes,
  };
}

// ─── Standalone utility ─────────────────────────────────────────────────────

export function getTelegramWebApp(): TelegramWebApp | null {
  return window.Telegram?.WebApp ?? null;
}

export function isTelegramMiniApp(): boolean {
  const tg = getTelegramWebApp();
  return !!tg && !!tg.initData && tg.initData.length > 0;
}