import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, StatusBar, SafeAreaView, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AppData, AllProfiles, BADGES, BadgeDef, Profile, HABIT_COLORS } from '../types';
import { T } from '../theme';

const RARITY: Record<BadgeDef['rarity'], { color: string; label: string }> = {
  common:    { color: '#8888A8', label: 'Commun' },
  rare:      { color: '#3B82F6', label: 'Rare' },
  epic:      { color: '#8B5CF6', label: 'Épique' },
  legendary: { color: '#F59E0B', label: 'Légendaire' },
};

const AVATAR_COLORS = HABIT_COLORS;
function avatarColor(p: Profile) {
  return /^#[0-9A-Fa-f]{6}$/.test(p.emoji) ? p.emoji : AVATAR_COLORS[0];
}

type ViewMode = 'mine' | 'team';

function BadgeCard({ badge, earned }: { badge: BadgeDef; earned: boolean }) {
  const r = RARITY[badge.rarity];
  return (
    <View style={[
      styles.card,
      earned ? { borderColor: r.color + '55', backgroundColor: r.color + '12' }
             : { borderColor: T.border, backgroundColor: T.card },
    ]}>
      <View style={[styles.iconCircle, { backgroundColor: earned ? r.color + '20' : T.cardAlt }]}>
        {earned
          ? <Ionicons name={badge.icon as any} size={26} color={r.color} />
          : <Ionicons name="lock-closed-outline" size={20} color={T.text3} />
        }
      </View>
      <Text style={[styles.badgeName, !earned && { opacity: 0.3 }]}>{badge.name}</Text>
      <Text style={[styles.badgeDesc, !earned && { opacity: 0.25 }]} numberOfLines={2}>{badge.description}</Text>
      {earned && (
        <View style={[styles.tag, { backgroundColor: r.color + '22', borderColor: r.color + '55' }]}>
          <Text style={[styles.tagText, { color: r.color }]}>{r.label}</Text>
        </View>
      )}
    </View>
  );
}

function TeamMemberBadges({ profile, data }: { profile: Profile; data: AppData }) {
  const earned    = new Set(data.earnedBadges ?? []);
  const earnedCount = BADGES.filter(b => earned.has(b.id)).length;
  const color = avatarColor(profile);
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.memberSection}>
      <TouchableOpacity style={styles.memberHeader} onPress={() => setExpanded(e => !e)}>
        <View style={[styles.memberAvatar, { backgroundColor: color }]}>
          <Text style={styles.memberInitial}>{profile.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>{profile.name}</Text>
          <Text style={styles.memberBadgeCount}>{earnedCount} / {BADGES.length} badges</Text>
        </View>
        <View style={styles.memberBadgeRow}>
          {BADGES.filter(b => earned.has(b.id)).slice(0, 4).map(b => (
            <View key={b.id} style={[styles.memberBadgeDot, { backgroundColor: RARITY[b.rarity].color }]}>
              <Ionicons name={b.icon as any} size={10} color="#fff" />
            </View>
          ))}
          {earnedCount > 4 && (
            <View style={[styles.memberBadgeDot, { backgroundColor: T.cardAlt }]}>
              <Text style={{ fontSize: 8, color: T.text2 }}>+{earnedCount - 4}</Text>
            </View>
          )}
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={T.text3} />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.memberBadgeGrid}>
          {BADGES.map(b => {
            const e = earned.has(b.id);
            const r = RARITY[b.rarity];
            return (
              <View key={b.id} style={[
                styles.miniBadge,
                e ? { borderColor: r.color + '55', backgroundColor: r.color + '12' }
                  : { borderColor: T.border, backgroundColor: T.card, opacity: 0.35 },
              ]}>
                <Ionicons name={e ? b.icon as any : 'lock-closed-outline'} size={18} color={e ? r.color : T.text3} />
                <Text style={[styles.miniBadgeName, { color: e ? T.text : T.text3 }]} numberOfLines={2}>{b.name}</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

interface Props {
  data: AppData;
  all: AllProfiles;
}

export default function BadgesScreen({ data, all }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('mine');

  const earned      = new Set(data.earnedBadges ?? []);
  const total       = BADGES.length;
  const earnedCount = BADGES.filter(b => earned.has(b.id)).length;
  const pct         = total > 0 ? earnedCount / total : 0;

  const sorted = [...BADGES].sort((a, b) => (earned.has(a.id) ? 0 : 1) - (earned.has(b.id) ? 0 : 1));

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={T.bg} />
      <LinearGradient colors={['#0C1F0E', '#0F1810', T.bg]} style={styles.header}>
        <Text style={styles.title}>Badges</Text>
        <Text style={styles.subtitle}>{earnedCount} / {total} débloqués</Text>
        <View style={styles.progressTrack}>
          <LinearGradient colors={[T.accent, T.accentSoft]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={[styles.progressFill, { width: `${Math.round(pct * 100)}%` as any }]} />
        </View>
        <Text style={styles.pctText}>{Math.round(pct * 100)}%</Text>
      </LinearGradient>

      {/* Toggle Mes badges / Équipe */}
      <View style={styles.toggle}>
        {(['mine', 'team'] as ViewMode[]).map(m => (
          <TouchableOpacity
            key={m}
            style={[styles.toggleBtn, viewMode === m && styles.toggleBtnActive]}
            onPress={() => setViewMode(m)}
          >
            <Ionicons
              name={m === 'mine' ? 'person-outline' : 'people-outline'}
              size={14}
              color={viewMode === m ? T.accentSoft : T.text3}
            />
            <Text style={[styles.toggleText, viewMode === m && styles.toggleTextActive]}>
              {m === 'mine' ? 'Mes badges' : 'Équipe'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {viewMode === 'mine' ? (
        <FlatList
          data={sorted}
          keyExtractor={b => b.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <BadgeCard badge={item} earned={earned.has(item.id)} />}
          ListFooterComponent={<View style={{ height: 110 }} />}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={all.profiles}
          keyExtractor={p => p.id}
          contentContainerStyle={styles.teamList}
          renderItem={({ item }) => (
            <TeamMemberBadges
              profile={item}
              data={all.data[item.id] ?? { habits: [], entries: [], totalXP: 0, earnedBadges: [] }}
            />
          )}
          ListFooterComponent={<View style={{ height: 110 }} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: T.bg },
  header: { paddingTop: 56, paddingHorizontal: 24, paddingBottom: 20, alignItems: 'center', borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  title:  { fontSize: 26, fontWeight: '900', color: T.text, letterSpacing: 1, marginBottom: 4 },
  subtitle: { fontSize: 13, color: T.text2, fontWeight: '600', marginBottom: 14 },
  progressTrack: { width: '80%', height: 5, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  progressFill:  { height: '100%', borderRadius: 3 },
  pctText: { fontSize: 11, color: T.text3, fontWeight: '700' },

  toggle: { flexDirection: 'row', margin: 16, backgroundColor: T.cardAlt, borderRadius: 14, padding: 4, borderWidth: 1, borderColor: T.border },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 10 },
  toggleBtnActive: { backgroundColor: T.accentDim, borderWidth: 1, borderColor: T.accent + '44' },
  toggleText:      { fontSize: 13, color: T.text3, fontWeight: '600' },
  toggleTextActive:{ color: T.accentSoft, fontWeight: '700' },

  list: { paddingHorizontal: 12, paddingTop: 4 },
  row:  { justifyContent: 'space-between', marginBottom: 12 },
  card: {
    flex: 1, marginHorizontal: 4, borderRadius: 20, borderWidth: 1,
    padding: 16, alignItems: 'center', minHeight: 160, justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 5,
  },
  iconCircle: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  badgeName:  { fontSize: 13, fontWeight: '800', color: T.text, textAlign: 'center', marginBottom: 4 },
  badgeDesc:  { fontSize: 10, color: T.text2, textAlign: 'center', lineHeight: 14, marginBottom: 8 },
  tag:        { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  tagText:    { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },

  teamList: { paddingHorizontal: 14, paddingTop: 4 },
  memberSection: { backgroundColor: T.card, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: T.border, overflow: 'hidden' },
  memberHeader:  { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  memberAvatar:  { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  memberInitial: { color: '#fff', fontWeight: '800', fontSize: 18 },
  memberInfo:    { flex: 1 },
  memberName:    { fontSize: 15, fontWeight: '700', color: T.text },
  memberBadgeCount: { fontSize: 11, color: T.text2, marginTop: 2 },
  memberBadgeRow: { flexDirection: 'row', gap: 4 },
  memberBadgeDot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  memberBadgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 12, paddingTop: 0, borderTopWidth: 1, borderTopColor: T.border },
  miniBadge: { width: 60, height: 72, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', padding: 6, gap: 4 },
  miniBadgeName: { fontSize: 8, fontWeight: '600', textAlign: 'center', lineHeight: 10 },
});
