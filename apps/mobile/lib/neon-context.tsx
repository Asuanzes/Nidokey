import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { getItem, setItem } from "@/lib/secure-store";
import { NEON_ACCENTS, type NeonAccentId } from "@/lib/neon-accents";

const ACCENT_KEY = "nidokey.neon.accent";
const INTENSITY_KEY = "nidokey.neon.intensity";

type NeonCtx = {
  accent: NeonAccentId;
  setAccent: (id: NeonAccentId) => void;
  intensity: number;
  setIntensity: (v: number) => void;
};

const NeonContext = createContext<NeonCtx>({
  accent: "rosa",
  setAccent: () => {},
  intensity: 0.6,
  setIntensity: () => {},
});

function parseAccent(value: string | null | undefined): NeonAccentId {
  return value && Object.prototype.hasOwnProperty.call(NEON_ACCENTS, value)
    ? (value as NeonAccentId)
    : "rosa";
}

function parseIntensity(value: string | null | undefined): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0.6;
  return Math.max(0, Math.min(1, n));
}

export function NeonProvider({ children }: { children: ReactNode }) {
  const [accent, setAccentState] = useState<NeonAccentId>("rosa");
  const [intensity, setIntensityState] = useState(0.6);

  useEffect(() => {
    Promise.all([getItem(ACCENT_KEY), getItem(INTENSITY_KEY)])
      .then(([savedAccent, savedIntensity]) => {
        setAccentState(parseAccent(savedAccent));
        setIntensityState(parseIntensity(savedIntensity));
      })
      .catch(() => {});
  }, []);

  const setAccent = (next: NeonAccentId) => {
    setAccentState(next);
    void setItem(ACCENT_KEY, next);
  };

  const setIntensity = (next: number) => {
    const clamped = Math.max(0, Math.min(1, next));
    setIntensityState(clamped);
    void setItem(INTENSITY_KEY, String(clamped));
  };

  const value = useMemo<NeonCtx>(
    () => ({ accent, setAccent, intensity, setIntensity }),
    [accent, intensity]
  );

  return <NeonContext.Provider value={value}>{children}</NeonContext.Provider>;
}

export const useNeon = (): NeonCtx => useContext(NeonContext);
