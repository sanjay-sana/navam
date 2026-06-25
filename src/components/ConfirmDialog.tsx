// Themed confirmation dialog (replaces the system Alert.alert, which doesn't
// follow the app theme). Controlled via `visible`.
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, spacing } from '@/src/theme/theme';

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  showCancel = true,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** Hide the cancel button for single-button notices. */
  showCancel?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        {/* Inner press is swallowed so taps on the card don't dismiss. */}
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <View style={styles.actions}>
            {showCancel ? (
              <Pressable style={styles.btn} onPress={onCancel}>
                <Text style={styles.cancelText}>{cancelLabel}</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={[styles.btn, styles.confirmBtn, destructive && styles.destructiveBtn]}
              onPress={onConfirm}
            >
              <Text style={[styles.confirmText, destructive && styles.destructiveText]}>
                {confirmLabel}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  title: { fontFamily: fonts.display, fontSize: 22, color: colors.text },
  message: { fontFamily: fonts.ui, fontSize: 15, color: colors.dim, marginTop: spacing.sm, lineHeight: 21 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.lg },
  btn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2, borderRadius: radius.md },
  cancelText: { fontFamily: fonts.uiBold, fontSize: 16, color: colors.dim },
  confirmBtn: { backgroundColor: colors.accentSoft },
  confirmText: { fontFamily: fonts.uiBold, fontSize: 16, color: colors.accent },
  destructiveBtn: { backgroundColor: 'rgba(232,137,107,0.16)' },
  destructiveText: { color: '#E8896B' },
});
