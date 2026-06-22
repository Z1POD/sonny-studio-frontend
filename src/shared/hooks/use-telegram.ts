/**
 * src/shared/hooks/use-telegram.ts
 *
 * Changes:
 *  - shareToStory signature updated to match Telegram WebApp API.
 *    Before: shareToStory(mediaUrl, text, widgetLink)
 *    After:  shareToStory(mediaUrl, params: { text?, widget_link?: { url, name } })
 *  - All existing exports preserved (isTelegram, isFullscreen, etc.)
 */

import { useCallback, useEffect, useMemo, useState } from "react";

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
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
  HapticFeedback?: {
    impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
    notificationOccurred: (type: "error" | "success" | "warning") => void;
    selectionChanged: () => void;
  };
  shareToStory?: (
    mediaUrl: string,
    params?: {
      text?: string;
      widget_link?: {
        url: string;
        name: string;
      };
    }
  ) => void;
  openTelegramLink: (url: string) => void;
  openLink: (url: string) => void;
  showPopup: (params: {
    title?: string;
    message: string;
    buttons?: Array<{ id?: string; type?: string; text: string }>;
  }) => void;
  showAlert: (message: string) => void;
  showConfirm: (message: string) => Promise<boolean>;
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
  onEvent: (eventType: string, callback: () => void) => void;
  offEvent: (eventType: string, callback: () => void) => void;
  /** @deprecated Bot API 7.0+ — use disableVerticalSwipes() instead */
  enableVerticalSwipes?: () => void;
  /** @deprecated Bot API 7.0+ — use enableVerticalSwipes() instead */
  disableVerticalSwipes?: () => void;
}

interface TelegramWindow extends Window {
  Telegram?: {
    WebApp: TelegramWebApp;
  };
}

export function useTelegram() {
  const [tg, setTg] = useState<TelegramWebApp | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const telegram = (window as unknown as TelegramWindow).Telegram?.WebApp;
      if (telegram) {
        setTg(telegram);
        telegram.ready();
      }
    }
  }, []);

  /**
   * TRUE when running inside a real Telegram Mini App.
   * Verified by checking initDataUnsafe contains user data (not just WebApp object presence).
   */
  const isTelegram = useMemo(() => {
    if (typeof window === "undefined") return false;
    const webApp = (window as unknown as TelegramWindow).Telegram?.WebApp;
    if (!webApp) return false;
    const hasInitData = !!webApp.initDataUnsafe && !!webApp.initDataUnsafe.user;
    const hasInitDataString = !!webApp.initData && webApp.initData.length > 0;
    return hasInitData || hasInitDataString;
  }, []);

  /** TRUE when the Mini App is in expanded/fullscreen mode */
  const isFullscreen = useMemo(() => {
    return !!tg?.isExpanded;
  }, [tg]);

  const isShareToStoryAvailable = useCallback(() => {
    return !!tg?.shareToStory;
  }, [tg]);

  /**
   * Opens the native Telegram story editor.
   *
   * @param mediaUrl - HTTPS URL of the media (image/video)
   * @param params - StoryShareParams: { text?, widget_link?: { url, name } }
   *
   * Breaking change: This now accepts a single params object as the second argument
   * instead of separate text and widgetLink arguments.
   */
  const shareToStory = useCallback(
    (
      mediaUrl: string,
      params?: {
        text?: string;
        widget_link?: { url: string; name: string };
      }
    ) => {
      if (!tg?.shareToStory) {
        console.warn("shareToStory not available");
        return;
      }
      tg.shareToStory(mediaUrl, params);
    },
    [tg]
  );

  const hapticFeedback = useCallback(
    (type: "success" | "error" | "warning" | "light" | "medium" | "heavy" | "rigid" | "soft") => {
      if (type === "success" || type === "error" || type === "warning") {
        tg?.HapticFeedback?.notificationOccurred?.(type);
      } else {
        tg?.HapticFeedback?.impactOccurred?.(type as "light" | "medium" | "heavy" | "rigid" | "soft");
      }
    },
    [tg]
  );

  const impactOccurred = useCallback(
    (style: "light" | "medium" | "heavy" | "rigid" | "soft") => {
      tg?.HapticFeedback?.impactOccurred?.(style);
    },
    [tg]
  );

  const notificationOccurred = useCallback(
    (type: "error" | "success" | "warning") => {
      tg?.HapticFeedback?.notificationOccurred?.(type);
    },
    [tg]
  );

  const selectionChanged = useCallback(() => {
    tg?.HapticFeedback?.selectionChanged?.();
  }, [tg]);

  const openTelegramLink = useCallback(
    (url: string) => {
      tg?.openTelegramLink?.(url);
    },
    [tg]
  );

  const openLink = useCallback(
    (url: string) => {
      tg?.openLink?.(url);
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
    (message: string) => {
      tg?.showAlert?.(message);
    },
    [tg]
  );

  const showConfirm = useCallback(
    (message: string) => {
      return tg?.showConfirm?.(message) ?? Promise.resolve(false);
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

  /** Disable vertical swipe-to-close gesture (Bot API 7.0+) */
  const disableVerticalSwipes = useCallback(() => {
    tg?.disableVerticalSwipes?.();
  }, [tg]);

  /** Re-enable vertical swipe-to-close gesture (Bot API 7.0+) */
  const enableVerticalSwipes = useCallback(() => {
    tg?.enableVerticalSwipes?.();
  }, [tg]);

  return {
    tg,
    isTelegram,
    isFullscreen,
    isShareToStoryAvailable,
    shareToStory,
    hapticFeedback,
    impactOccurred,
    notificationOccurred,
    selectionChanged,
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
    disableVerticalSwipes,
    enableVerticalSwipes,
    themeParams: tg?.themeParams,
    platform: tg?.platform,
    version: tg?.version,
    colorScheme: tg?.colorScheme,
    isExpanded: tg?.isExpanded,
    viewportHeight: tg?.viewportHeight,
    viewportStableHeight: tg?.viewportStableHeight,
    safeAreaInset: tg?.safeAreaInset,
    contentSafeAreaInset: tg?.contentSafeAreaInset,
    MainButton: tg?.MainButton,
    BackButton: tg?.BackButton,
  };
}
