import { useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import type { RecordType } from "@nidokey/shared";
import { RECORD_TYPE_CONFIG } from "@/lib/records/config";
import { useTheme } from "@/lib/theme";

/**
 * Lista de CATEGORÍAS reordenable por arrastre + toggle de visibilidad (ojo).
 * Mismo gesto/animación que `ReorderableRecordList` (gesture-handler + reanimated
 * + haptics, sin dependencias nuevas), pero filas de altura fija y sin RecordCard.
 * El orden se persiste al soltar (`onCommit`); ocultar/mostrar es inmediato.
 */
const ROW_HEIGHT = 56;

type Managed = { type: RecordType; hidden: boolean };
type Th = ReturnType<typeof useTheme>["th"];

type Props = {
  data: Managed[];
  onReorder: (next: Managed[]) => void;
  onCommit: (next: Managed[]) => void;
  onToggleHidden: (t: RecordType) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
};

function move<T>(arr: T[], from: number, to: number): T[] {
  const copy = arr.slice();
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

export function ReorderableCategoryList({
  data,
  onReorder,
  onCommit,
  onToggleHidden,
  onDragStart,
  onDragEnd,
}: Props) {
  const { th } = useTheme();
  const dataRef = useRef(data);
  dataRef.current = data;
  const accShift = useRef(0);
  const activeIdSV = useSharedValue("");
  const dragTY = useSharedValue(0);
  const [activeId, setActiveId] = useState<string | null>(null);

  function startDrag(id: string) {
    accShift.current = 0;
    dragTY.value = 0;
    activeIdSV.value = id;
    setActiveId(id);
    onDragStart?.();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }

  function updateDrag(id: string, translationY: number) {
    const items = dataRef.current;
    const idx = items.findIndex((m) => m.type === id);
    if (idx < 0) return;
    const displacement = translationY - accShift.current;
    if (idx < items.length - 1 && displacement > ROW_HEIGHT / 2) {
      onReorder(move(items, idx, idx + 1));
      accShift.current += ROW_HEIGHT;
    } else if (idx > 0 && displacement < -ROW_HEIGHT / 2) {
      onReorder(move(items, idx, idx - 1));
      accShift.current -= ROW_HEIGHT;
    }
    dragTY.value = translationY - accShift.current;
  }

  function endDrag() {
    dragTY.value = withTiming(0, { duration: 160 });
    activeIdSV.value = "";
    setActiveId(null);
    onCommit(dataRef.current);
    onDragEnd?.();
  }

  return (
    <View style={[styles.list, { borderColor: th.border }]}>
      {data.map((m) => (
        <Row
          key={m.type}
          item={m}
          th={th}
          isActive={activeId === m.type}
          activeIdSV={activeIdSV}
          dragTY={dragTY}
          onToggleHidden={onToggleHidden}
          onStart={() => startDrag(m.type)}
          onUpdate={(ty) => updateDrag(m.type, ty)}
          onEnd={endDrag}
        />
      ))}
    </View>
  );
}

type RowProps = {
  item: Managed;
  th: Th;
  isActive: boolean;
  activeIdSV: SharedValue<string>;
  dragTY: SharedValue<number>;
  onToggleHidden: (t: RecordType) => void;
  onStart: () => void;
  onUpdate: (translationY: number) => void;
  onEnd: () => void;
};

function Row({
  item,
  th,
  isActive,
  activeIdSV,
  dragTY,
  onToggleHidden,
  onStart,
  onUpdate,
  onEnd,
}: RowProps) {
  const id = item.type;
  const cfg = RECORD_TYPE_CONFIG[id];
  const muted = item.hidden;

  const animatedStyle = useAnimatedStyle(() => {
    const active = activeIdSV.value === id;
    return {
      transform: [{ translateY: active ? dragTY.value : 0 }, { scale: active ? 1.03 : 1 }],
      zIndex: active ? 20 : 0,
      shadowColor: "#000",
      shadowOpacity: active ? 0.18 : 0,
      shadowRadius: active ? 8 : 0,
      shadowOffset: { width: 0, height: active ? 4 : 0 },
      elevation: active ? 8 : 0,
    };
  });

  // El gesto se arma tras ~200ms de pulsación; un toque rápido sobre el ojo va al
  // Pressable, no al arrastre. Corre en JS para reordenar el array directamente.
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activateAfterLongPress(200)
        .runOnJS(true)
        .onStart(onStart)
        .onUpdate((e) => onUpdate(e.translationY))
        .onFinalize(onEnd),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id]
  );

  return (
    <Animated.View
      layout={isActive ? undefined : LinearTransition.duration(180)}
      style={animatedStyle}
    >
      <GestureDetector gesture={pan}>
        <View style={[styles.row, { backgroundColor: th.surface, borderBottomColor: th.border }]}>
          <Ionicons name="reorder-three-outline" size={20} color={th.textSubtle} />
          <Ionicons
            name={cfg.icon}
            size={20}
            color={muted ? th.textSubtle : th.accent}
            style={styles.catIcon}
          />
          <Text style={[styles.label, { color: muted ? th.textSubtle : th.text }]}>
            {cfg.label}
          </Text>
          <Pressable onPress={() => onToggleHidden(id)} hitSlop={10} style={styles.eye}>
            <Ionicons
              name={muted ? "eye-off-outline" : "eye-outline"}
              size={20}
              color={muted ? th.textSubtle : th.primary}
            />
          </Pressable>
        </View>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  list: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  row: {
    height: ROW_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  catIcon: { marginLeft: 2 },
  label: { flex: 1, fontSize: 15, fontWeight: "500" },
  eye: { padding: 4 },
});
