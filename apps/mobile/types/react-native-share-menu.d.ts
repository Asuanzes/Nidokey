/**
 * Declaración de tipos mínima para react-native-share-menu (no publica tipos).
 * Cubre solo la API que usamos en la pantalla Importar.
 */
declare module "react-native-share-menu" {
  export type ShareItem = { mimeType?: string; data: string };

  export type ShareData = {
    mimeType?: string;
    data: string | ShareItem[] | null;
    extraData?: Record<string, unknown>;
  } | null;

  export type ShareListener = (share: ShareData) => void;

  export type ShareSubscription = { remove: () => void };

  const ShareMenu: {
    getInitialShare: (callback: ShareListener) => void;
    addNewShareListener: (callback: ShareListener) => ShareSubscription;
  };

  export default ShareMenu;
}
