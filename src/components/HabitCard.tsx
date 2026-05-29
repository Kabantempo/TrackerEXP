import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, PanResponder,
} from 'react-native';
import { Habit, DailyEntry, getChallengeProgress, AppData } from '../types';

const SWIPE_THRESHOLD = 60;
const ACTION_WIDTH = 120;

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
  const xpAnim = useRef(new Animated.Value(0)).current;
  const xpOpacity = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [swiped, setSwiped] = useState(false);

  const status = entry?.status ?? 'pending';
  const isChallenge = habit.type === 'challenge';
  const progress = isChallenge ? getChallengeProgress(data, habit) : null;

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

  function handleYes() {
    closeSwipe();
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, speed: 60 }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 20 }),
    ]).start();
    if (status !== 'yes') {
      xpAnim.setValue(0);
      xpOpacity.setValue(1);
      Animated.parallel([
        Animated.timing(xpAnim, { toValue: -50, duration: 800, useNativeDriver: true }),
        Animated.timing(xpOpacity, { toValue: 0, duration: 800, useNativeDriver: true }),
      ]).start();
    }
    onYes();
  }

  function handleNo() {
    closeSwipe();
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, speed: 60 }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 20 }),
    ]).start();
    onNo();
  }

  const cardBg = status === 'yes' ? '#F9FAFB' : '#FFFFFF';
  const borderColor = status === 'yes' ? '#D1D5DB' : '#E5E7EB';

  return (
    <View style={styles.wrapper}>
      <View style={styles.actionsBack}>
        <TouchableOpacity style={styles.editAction} onPress={() => { closeSwipe(); onEdit(); }}>
          <Text style={styles.editIcon}>✏️</Text>
          <Text style={styles.editText}>Modifier</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteAction} onPress={() => { closeSwipe(); onDelete(); }}>
          <Text style={styles.deleteIcon}>🗑️</Text>
          <Text style={styles.deleteText}>Supprimer</Text>
        </TouchableOpacity>
      </View>

      <Animated.View
        style={[styles.card, { transform: [{ scale: scaleAnim }, { translateX }] }]}
        {...panResponder.panHandlers}
      >
        <View style={[styles.inner, { backgroundColor: cardBg, borderColor }]}>
          <View style={styles.colorBar} />
          <View style={styles.body}>
            <View style={styles.topRow}>
              <View style={styles.iconBg}>
                <Text style={styles.icon}>{habit.icon}</Text>
              </View>
              <View style={styles.textBlock}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{habit.name}</Text>
                  {isChallenge && (
                    <View style={styles.challengeBadge}>
                      <Text style={styles.challengeText}>DÉFI</Text>
                    </View>
                  )}
                </View>
                {habit.description ? <Text style={styles.desc}>{habit.description}</Text> : null}
                {isChallenge && habit.endDate && (
                  <Text style={styles.deadline}>Jusqu'au {habit.endDate}</Text>
                )}
              </View>
            </View>

            {isChallenge && progress && (
              <View style={styles.challengeProgress}>
                <View style={styles.progressBg}>
                  <View style={[styles.progressFill, { width: `${Math.round(progress.percent * 100)}%` as any }]} />
                </View>
                <Text style={styles.progressText}>{progress.done}/{progress.total} jours</Text>
              </View>
            )}

            <View style={styles.bottomRow}>
              <View style={styles.xpBadge}>
                <Text style={styles.xpText}>+{habit.xpReward} XP</Text>
              </View>
              <View style={styles.buttons}>
                <TouchableOpacity
                  style={[styles.btn, status === 'no' && styles.btnNoActive]}
                  onPress={handleNo}
                >
                  <Text style={[styles.btnTxt, status === 'no' && styles.btnNoTxt]}>
                    {status === 'no' ? '✗ Raté' : '✗'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, status === 'yes' && styles.btnYesActive]}
                  onPress={handleYes}
                >
                  <Text style={[styles.btnTxt, status === 'yes' && styles.btnYesTxt]}>
                    {status === 'yes' ? '✓ Fait !' : '✓'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Animated.View>

      <Animated.Text style={[styles.xpPopup, { transform: [{ translateY: xpAnim }], opacity: xpOpacity }]}>
        +{habit.xpReward} XP
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginHorizontal: 16, marginVertical: 5 },
  actionsBack: {
    position: 'absolute', right: 0, top: 0, bottom: 0,
    width: ACTION_WIDTH, flexDirection: 'row', borderRadius: 16, overflow: 'hidden',
  },
  editAction: {
    flex: 1, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },
  editIcon: { fontSize: 16, marginBottom: 2 },
  editText: { fontSize: 10, color: '#6B7280', fontWeight: '600' },
  deleteAction: {
    flex: 1, backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center',
    borderTopRightRadius: 16, borderBottomRightRadius: 16,
  },
  deleteIcon: { fontSize: 16, marginBottom: 2 },
  deleteText: { fontSize: 10, color: '#374151', fontWeight: '600' },
  card: { borderRadius: 16, overflow: 'hidden' },
  inner: {
    flexDirection: 'row', borderRadius: 16, borderWidth: 1, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  colorBar: { width: 3, backgroundColor: '#111827' },
  body: { flex: 1, padding: 14 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  iconBg: {
    width: 42, height: 42, borderRadius: 12, backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  icon: { fontSize: 20 },
  textBlock: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name: { fontSize: 15, fontWeight: '700', color: '#111827' },
  challengeBadge: {
    backgroundColor: '#F3F4F6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  challengeText: { fontSize: 9, fontWeight: '800', color: '#6B7280', letterSpacing: 1 },
  desc: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  deadline: { fontSize: 11, color: '#9CA3AF', marginTop: 3 },
  challengeProgress: { marginBottom: 10 },
  progressBg: {
    height: 4, backgroundColor: '#F3F4F6', borderRadius: 2, overflow: 'hidden', marginBottom: 4,
  },
  progressFill: { height: '100%', borderRadius: 2, backgroundColor: '#111827' },
  progressText: { fontSize: 10, color: '#9CA3AF' },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  xpBadge: {
    borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8,
  },
  xpText: { fontSize: 12, fontWeight: '800', color: '#374151' },
  buttons: { flexDirection: 'row', gap: 6 },
  btn: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB',
    minWidth: 48, alignItems: 'center',
  },
  btnNoActive: { borderColor: '#D1D5DB', backgroundColor: '#F3F4F6' },
  btnYesActive: { borderColor: '#111827', backgroundColor: '#111827' },
  btnTxt: { fontWeight: '700', fontSize: 13, color: '#9CA3AF' },
  btnNoTxt: { color: '#374151' },
  btnYesTxt: { color: '#FFFFFF' },
  xpPopup: {
    position: 'absolute', right: 20, top: 10,
    color: '#111827', fontWeight: '900', fontSize: 18,
    pointerEvents: 'none',
  },
});
