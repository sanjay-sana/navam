// Custom dark-themed "casino scroll" date/time picker — a bottom-sheet modal
// with snapping scroll wheels, fully on-theme (replaces the native dialog).
import { Fragment, useEffect, useRef, useState } from 'react';
import {
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors, fonts, radius, spacing } from '@/src/theme/theme';

const ITEM_H = 40;
const VISIBLE = 5; // odd, so there's a clear centre row
const PAD = ITEM_H * Math.floor(VISIBLE / 2);

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface WheelItem {
  label: string;
}

function WheelColumn({
  items,
  selectedIndex,
  onChange,
  flex = 1,
}: {
  items: WheelItem[];
  selectedIndex: number;
  onChange: (index: number) => void;
  flex?: number;
}) {
  const ref = useRef<ScrollView>(null);
  const inited = useRef(false);

  const scrollToIndex = (i: number, animated: boolean) =>
    ref.current?.scrollTo({ y: i * ITEM_H, animated });

  // Keep the wheel aligned with external changes (e.g. day count shrinking).
  useEffect(() => {
    scrollToIndex(selectedIndex, false);
  }, [selectedIndex]);

  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = clamp(Math.round(e.nativeEvent.contentOffset.y / ITEM_H), 0, items.length - 1);
    if (i !== selectedIndex) onChange(i);
    else scrollToIndex(i, false); // re-snap if unchanged
  };

  return (
    <ScrollView
      ref={ref}
      style={{ flex }}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_H}
      decelerationRate="fast"
      nestedScrollEnabled
      onLayout={() => {
        if (!inited.current) {
          inited.current = true;
          scrollToIndex(selectedIndex, false);
        }
      }}
      onMomentumScrollEnd={settle}
      contentContainerStyle={{ paddingVertical: PAD }}
    >
      {items.map((it, i) => (
        <Pressable
          key={i}
          style={styles.item}
          onPress={() => {
            onChange(i);
            scrollToIndex(i, true);
          }}
        >
          <Text
            style={[styles.itemText, i === selectedIndex && styles.itemTextSel]}
            numberOfLines={1}
          >
            {it.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export function WheelDateTimeModal({
  visible,
  mode,
  value,
  maximumDate,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  mode: 'date' | 'time';
  value: Date;
  maximumDate?: Date;
  onConfirm: (next: Date) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  const apply = (d: Date) => {
    setDraft(maximumDate && d.getTime() > maximumDate.getTime() ? maximumDate : d);
  };

  // shared parts
  const y = draft.getFullYear();
  const m = draft.getMonth();
  const day = draft.getDate();
  const h24 = draft.getHours();
  const min = draft.getMinutes();

  let columns: React.ReactNode;
  if (mode === 'date') {
    const maxYear = (maximumDate ?? new Date()).getFullYear();
    const years = Array.from({ length: 6 }, (_, i) => maxYear - 5 + i);
    const dayItems = Array.from({ length: daysInMonth(y, m) }, (_, i) => ({ label: String(i + 1) }));
    columns = (
      <>
        <WheelColumn
          items={MONTHS.map((label) => ({ label }))}
          selectedIndex={m}
          onChange={(i) => apply(new Date(y, i, Math.min(day, daysInMonth(y, i)), h24, min))}
        />
        <WheelColumn
          items={dayItems}
          selectedIndex={day - 1}
          onChange={(i) => apply(new Date(y, m, i + 1, h24, min))}
        />
        <WheelColumn
          items={years.map((yr) => ({ label: String(yr) }))}
          selectedIndex={clamp(years.indexOf(y), 0, years.length - 1)}
          onChange={(i) => {
            const yr = years[i];
            apply(new Date(yr, m, Math.min(day, daysInMonth(yr, m)), h24, min));
          }}
        />
      </>
    );
  } else {
    const h12 = ((h24 + 11) % 12) + 1;
    const isPm = h24 >= 12;
    const rebuild = (nextH12: number, nextMin: number, pm: boolean) => {
      const hh = (nextH12 % 12) + (pm ? 12 : 0);
      apply(new Date(y, m, day, hh, nextMin));
    };
    columns = (
      <>
        <WheelColumn
          items={Array.from({ length: 12 }, (_, i) => ({ label: String(i + 1) }))}
          selectedIndex={h12 - 1}
          onChange={(i) => rebuild(i + 1, min, isPm)}
        />
        <WheelColumn
          items={Array.from({ length: 60 }, (_, i) => ({ label: String(i).padStart(2, '0') }))}
          selectedIndex={min}
          onChange={(i) => rebuild(h12, i, isPm)}
        />
        <WheelColumn
          items={[{ label: 'AM' }, { label: 'PM' }]}
          selectedIndex={isPm ? 1 : 0}
          onChange={(i) => rebuild(h12, min, i === 1)}
        />
      </>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel} />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Pressable onPress={onCancel} hitSlop={10}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
          <Text style={styles.title}>{mode === 'date' ? 'Date' : 'Time'}</Text>
          <Pressable onPress={() => onConfirm(draft)} hitSlop={10}>
            <Text style={styles.done}>Done</Text>
          </Pressable>
        </View>
        <View style={styles.wheels}>
          <View style={styles.highlight} pointerEvents="none" />
          {columns}
        </View>
      </View>
    </Modal>
  );
}

export interface WheelColumnSpec {
  items: WheelItem[];
  /** Unit suffix shown to the right of the wheel (e.g. "kg", "lb", "ft"). */
  label?: string;
}

/**
 * Compound numeric picker: one or more wheels (each with an optional unit
 * label) combined into a single number by `compose`. `initial` gives the
 * starting index per column. Used for weight (kg+g / lb+oz) and length
 * (cm / ft+in).
 */
export function WheelCompoundModal({
  visible,
  title,
  columns,
  initial,
  compose,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  columns: WheelColumnSpec[];
  initial: number[];
  compose: (indices: number[]) => number;
  onConfirm: (next: number) => void;
  onCancel: () => void;
}) {
  const [idx, setIdx] = useState<number[]>(initial);

  // Reset to `initial` only when the sheet opens (not on every re-render).
  useEffect(() => {
    if (visible) setIdx(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const setAt = (col: number, i: number) =>
    setIdx((prev) => {
      const next = [...prev];
      next[col] = i;
      return next;
    });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel} />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Pressable onPress={onCancel} hitSlop={10}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={() => onConfirm(compose(idx))} hitSlop={10}>
            <Text style={styles.done}>Done</Text>
          </Pressable>
        </View>
        <View style={styles.wheels}>
          <View style={styles.highlight} pointerEvents="none" />
          {columns.map((c, ci) => (
            <Fragment key={ci}>
              <WheelColumn
                items={c.items}
                selectedIndex={clamp(idx[ci] ?? 0, 0, c.items.length - 1)}
                onChange={(i) => setAt(ci, i)}
                flex={2}
              />
              {c.label ? (
                <View style={styles.unitCol}>
                  <Text style={styles.unitText}>{c.label}</Text>
                </View>
              ) : null}
            </Fragment>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontFamily: fonts.uiBold, fontSize: 16, color: colors.text },
  cancel: { fontFamily: fonts.ui, fontSize: 16, color: colors.dim },
  done: { fontFamily: fonts.uiBold, fontSize: 16, color: colors.accent },
  wheels: {
    flexDirection: 'row',
    height: ITEM_H * VISIBLE,
    marginHorizontal: spacing.lg,
  },
  highlight: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: PAD,
    height: ITEM_H,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  item: { height: ITEM_H, alignItems: 'center', justifyContent: 'center' },
  itemText: { fontFamily: fonts.ui, fontSize: 20, color: colors.dim },
  itemTextSel: { fontFamily: fonts.uiBold, color: colors.text },
  unitCol: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  unitText: { fontFamily: fonts.uiBold, fontSize: 18, color: colors.dim },
});
