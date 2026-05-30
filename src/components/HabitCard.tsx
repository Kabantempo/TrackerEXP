import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, PanResponder } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Habit, DailyEntry, getChallengeProgress, AppData, HABIT_ICONS } from '../types';
import { T } from '../theme';

const SWIPE_THRESHOLD = 60;
const ACTION_WIDTH    = 130;

interface Props {
  habit: Habit;
  entry?: DailyEntry;
  data: AppData;
  onYes: () => void;
  onNo: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function HabitCard({ habit, entry, data, onYes, onNo, onEdit, onDelete }: Props) {
  const translateX = useRef(new Animated.Value(0)).current;
  const xpAnim     = useRef(new Animated.Value(0)).current;
  const xpOpacity  = useRef(new Animated.Value(0)).current;
  const scaleAnim  = useRef(new Animated.Value(1)).current;
  const [swiped, setSwiped] = useState(false);

  const status      = entry?.status ?? 'pending';
  const isChallenge = habit.type === 'challenge';
  const progress    = isChallenge ? getChallengeProgress(data, habit) : null;
  const iconName    = HABIT_ICONS.includes(habit.icon) ? habit.icon : HABIT_ICONS[0];
  const color       = habit.color || T.accent;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dy) < 20,
      onPanResponderMove: (_, g) => {
        if (g.dx < 0) translateX.setValue(Math.max(g.dx, -ACTION_WIDTH));
        else if (swiped) translateX.setValue(Math.min(g.dx - ACTION_WIDTH, 0));
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx < -SWIPE_THRESHOLD || (swiped && g.dx < 0)) {
          Animated.spring(translateX, { toValue: -ACTION_WIDTH, useNativeDriver: true, tension: 60 }).start();
          setSwiped(true);
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 60 }).start();
          setSwiped(false);
        }
      },
    })
  ).current;

  function closeSwipe() {
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 60 }).start();
    setSwiped(false);
  }

  function animatePress(cb: () => void) {
    closeSwipe();
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 0.975, useNativeDriver: true, speed: 80 }),
      Animated.spring(scaleAnim, { toValue: 1,     useNativeDriver: true, speed: 24 }),
    ]).start();
    cb();
  }

  function handleYes() {
    animatePress(() => {
      if (status !== 'yes') {
        xpAnim.setValue(0); xpOpacity.setValue(1);
        Animated.parallel([
          Animated.timing(xpAnim,    { toValue: -52, duration: 900, useNativeDriver: true }),
          Animated.timing(xpOpacity, { toValue: 0,   duration: 900, useNativeDriver: true }),
        ]).start();
      }
      onYes();
    });
  }

  function handleNo() { animatePress(onNo); }

  const isDone    = status === 'yes';
  const isMissed  = status === 'no';
  const isPending = status === 'pending';

  return (
    <View style={styles.wrapper}>
      {/* Actions swipe */}
      <View style={styles.actionsBack}>
        <Pressable
          style={({ pressed }) => [styles.actionEdit, pressed && { opacity: 0.7 }]}
          onPress={() => { closeSwipe(); onEdit(); }}
          accessibilityLabel="Modifier l'habitude"
        >
          <Ionicons name="pencil-outline" size={18} color={T.text2} />
          <Text style={styles.actionLabel}>Modifier</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.actionDelete, pressed && { opacity: 0.7 }]}
          onPress={() => { closeSwipe(); onDelete(); }}
          accessibilityLabel="Supprimer l'habitude"
        >
          <Ionicons name="trash-outline" size={18} color={T.error} />
          <Text style={[styles.actionLabel, { color: T.error }]}>Supprimer</Text>
        </Pressable>
      </View>

      {/* Carte */}
      <Animated.View
        style={[styles.cardWrap, { transform: [{ scale: scaleAnim }, { translateX }] }]}
        {...panResponder.panHandlers}
      >
        <View style={[
          styles.card,
          isDone   && { borderColor: color + '55' },
          isMissed && { borderColor: T.error + '33' },
        ]}>
          {/* Barre couleur gauche */}
          <View style={[styles.leftBar, { backgroundColor: color, opacity: isDone ? 1 : 0.45 }]} />

          <View style={styles.body}>
            {/* Ligne du haut */}
            <View style={styles.topRow}>
              {/* Icône */}
              <View style={[styles.iconWrap, { backgroundColor: color + '1A' }]}>
                <Ionicons name={iconName as any} size={22} color={color} />
              </View>

              <View style={styles.textCol}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={1}>{habit.name}</Text>
                  {isChallenge && (
                    <View style={[styles.badge, { backgroundColor: color + '1A', borderColor: color + '44' }]}>
                      <Text style={[styles.badgeText, { color }]}>DÉFI</Text>
                    </View>
                  )}
                </View>
                {!!habit.description && (
                  <Text style={styles.desc} numberOfLines={1}>{habit.description}</Text>
                )}
                {isChallenge && habit.endDate && (
                  <View style={styles.deadlineRow}>
                    <Ionicons name="time-outline" size={10} color={T.text3} />
                    <Text style={styles.deadline}>{habit.endDate}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Barre de progression défi */}
            {isChallenge && progress && (
              <View style={styles.progressSection}>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, {
                    width: `${Math.round(progress.percent * 100)}%` as any,
                    backgroundColor: color,
                    shadowColor: color,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.5,
                    shadowRadius: 4,
                  }]} />
                </View>
                <Text style={styles.progressText}>{progress.done}/{progress.total} j</Text>
              </View>
            )}

            {/* Ligne du bas */}
            <View style={styles.bottomRow}>
              {/* XP badge */}
              <View style={[styles.xpBadge, { borderColor: color + '44' }]}>
                <Ionicons name="flash" size={10} color={color} />
                <Text style={[styles.xpText, { color }]}>+{habit.xpReward} XP</Text>
              </View>

              {/* Boutons statut */}
              <View style={styles.btns}>
                {/* Défi : seulement le bouton Raté (le Fait est automatique) */}
                {isChallenge ? (
                  <>
                    {!isMissed ? (
                      <View style={[styles.btn, { backgroundColor: color + '22', borderColor: color + '55' }]}>
                        <Ionicons name="checkmark-circle" size={14} color={color} />
                        <Text style={[styles.btnTxt, { color }]}>Auto</Text>
                      </View>
                    ) : null}
                    <Pressable
                      style={({ pressed }) => [
                        styles.btn,
                        isMissed && { backgroundColor: T.error + '22', borderColor: T.error + '66' },
                        pressed && { opacity: 0.75 },
                      ]}
                      onPress={handleNo}
                      accessibilityLabel="Marquer comme raté"
                    >
                      <Ionicons name={isMissed ? 'close-circle' : 'close'} size={14} color={isMissed ? T.error : T.text3} />
                      <Text style={[styles.btnTxt, isMissed && { color: T.error }]}>Raté</Text>
                    </Pressable>
                  </>
                ) : (
                  /* Habitude quotidienne : Yes + No classiques */
                  <>
                    <Pressable
                      style={({ pressed }) => [
                        styles.btn,
                        isMissed && { backgroundColor: T.error + '22', borderColor: T.error + '66' },
                        pressed && { opacity: 0.75 },
                      ]}
                      onPress={handleNo}
                      accessibilityLabel="Marquer comme raté"
                    >
                      <Ionicons name={isMissed ? 'close-circle' : 'close'} size={14} color={isMissed ? T.error : T.text3} />
                      {isMissed && <Text style={[styles.btnTxt, { color: T.error }]}>Raté</Text>}
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [
                        styles.btn,
                        isDone && { backgroundColor: color, borderColor: color, shadowColor: color, shadowOpacity: 0.4 },
                        pressed && { opacity: 0.75 },
                      ]}
                      onPress={handleYes}
                      accessibilityLabel="Marquer comme fait"
                    >
                      <Ionicons name={isDone ? 'checkmark-circle' : 'checkmark'} size={14} color={isDone ? '#fff' : T.text2} />
                      <Text style={[styles.btnTxt, isDone && { color: '#fff' }]}>
                        {isDone ? 'Fait' : 'Valider'}
                      </Text>
                    </Pressable>
                  </>
                )}
              </View>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* +XP popup */}
      <Animated.Text style={[
        styles.xpPopup,
        { color, transform: [{ translateY: xpAnim }], opacity: xpOpacity },
      ]}>
        +{habit.xpReward} XP
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper:     { marginHorizontal: 14, marginVertical: 5 },
  actionsBack: {
    position: 'absolute', right: 0, top: 0, bottom: 0,
    width: ACTION_WIDTH, flexDirection: 'row', borderRadius: 18, overflow: 'hidden',
  },
  actionEdit: {
    flex: 1, backgroundColor: T.cardRaised,
    alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  actionDelete: {
    flex: 1, backgroundColor: T.card,
    alignItems: 'center', justifyContent: 'center', gap: 4,
    borderTopRightRadius: 18, borderBottomRightRadius: 18,
  },
  actionLabel: { fontSize: 9, color: T.text2, fontWeight: '700', letterSpacing: 0.3 },

  cardWrap: { borderRadius: 18, overflow: 'hidden' },
  card: {
    flexDirection: 'row',
    backgroundColor: T.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: T.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  leftBar: { width: 4 },
  body:    { flex: 1, padding: 14 },

  topRow:  { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, gap: 12 },
  iconWrap: {
    width: 44, height: 44, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  textCol: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 3 },
  name:    { fontSize: 15, fontWeight: '700', color: T.text, flex: 1 },
  badge: {
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 6, borderWidth: 1, flexShrink: 0,
  },
  badgeText: { fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  desc:     { fontSize: 12, color: T.text2 },
  deadlineRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  deadline: { fontSize: 10, color: T.text3 },

  progressSection: { marginBottom: 10 },
  progressTrack: {
    height: 4, backgroundColor: T.cardAlt,
    borderRadius: 2, overflow: 'hidden', marginBottom: 4,
  },
  progressFill: { height: '100%', borderRadius: 2 },
  progressText: { fontSize: 10, color: T.text2 },

  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  xpBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  xpText: { fontSize: 11, fontWeight: '800' },

  btns: { flexDirection: 'row', gap: 6 },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1, borderColor: T.border,
    backgroundColor: T.cardAlt, minWidth: 44, minHeight: 36,
    shadowOffset: { width: 0, height: 0 }, shadowRadius: 8, elevation: 0,
  },
  btnYes: {},
  btnTxt: { fontSize: 12, fontWeight: '700', color: T.text2 },

  xpPopup: {
    position: 'absolute', right: 18, top: 8,
    fontWeight: '900', fontSize: 18,
    shadowOffset: { width: 0, height: 0 }, shadowRadius: 8,
    pointerEvents: 'none',
  },
});
