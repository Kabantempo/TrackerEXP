import React from 'react';
import {
  View, Text, FlatList, StyleSheet, SafeAreaView, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppData, BADGES, BadgeDef } from '../types';

const RARITY_COLORS: Record<BadgeDef['rarity'], string[]> = {
  common:    ['#374151', '#1F2937'],
  rare:      ['#1E40AF', '#1E3A8A'],
  epic:      ['#6D28D9', '#4C1D95'],
  legendary: ['#B45309', '#78350F'],
};

const RARITY_GLOW: Record<BadgeDef['rarity'], string> = {
  common:    '#6B7280',
  rare:      '#3B82F6',
  epic:      '#A855F7',
  legendary: '#F59E0B',
};

const RARITY_LABEL: Record<BadgeDef['rarity'], string> = {
  common:    'Commun',
  rare:      'Rare',
  epic:      'Épique',
  legendary: 'Légendaire',
};

interface Props {
  data: AppData;
}

function BadgeCard({ badge, earned }: { badge: BadgeDef; earned: boolean }) {
  const colors = earned ? RARITY_COLORS[badge.rarity] : ['#111827', '#0D1117'];
  const glow = RARITY_GLOW[badge.rarity];

  return (
    <View style={[styles.cardWrapper, earned && { shadowColor: glow, shadowOpacity: 0.5 }]}>
      <LinearGradient colors={colors as [string, string]} style={styles.card}>
        {!earned && <View style={styles.locked} />}
        <Text style={[styles.icon, !earned && styles.iconLocked]}>
          {earned ? badge.icon : '🔒'}
        </Text>
        <Text style={[styles.badgeName, !earned && styles.textLocked]}>
          {badge.name}
        </Text>
        <Text style={[styles.badgeDesc, !earned && styles.textLocked]} numberOfLines={2}>
          {badge.description}
        </Text>
        {earned && (
          <View style={[styles.rarityTag, { backgroundColor: glow + '33', borderColor: glow }]}>
            <Text style={[styles.rarityText, { color: glow }]}>
              {RARITY_LABEL[badge.rarity]}
            </Text>
          </View>
        )}
      </LinearGradient>
    </View>
  );
}

export default function BadgesScreen({ data }: Props) {
  const earned = new Set(data.earnedBadges ?? []);
  const total = BADGES.length;
  const earnedCount = BADGES.filter(b => earned.has(b.id)).length;

  const sorted = [...BADGES].sort((a, b) => {
    const ae = earned.has(a.id) ? 0 : 1;
    const be = earned.has(b.id) ? 0 : 1;
    return ae - be;
  });

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#080B1A" />
      <LinearGradient colors={['#1A0533', '#0D1B4B', '#080B1A']} style={styles.header}>
        <Text style={styles.title}>Badges</Text>
        <Text style={styles.subtitle}>{earnedCount} / {total} débloqués</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${(earnedCount / total) * 100}%` as any }]} />
        </View>
      </LinearGradient>

      <FlatList
        data={sorted}
        keyExtractor={b => b.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <BadgeCard badge={item} earned={earned.has(item.id)} />
        )}
        ListFooterComponent={<View style={{ height: 100 }} />}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#080B1A',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#E2E8F0',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 14,
    color: '#A855F7',
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 12,
  },
  progressBar: {
    width: '80%',
    height: 6,
    backgroundColor: '#1E293B',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#A855F7',
    borderRadius: 3,
  },
  list: {
    paddingHorizontal: 12,
    paddingTop: 16,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardWrapper: {
    flex: 1,
    marginHorizontal: 4,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 8,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    minHeight: 150,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  locked: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 16,
  },
  icon: {
    fontSize: 40,
    marginBottom: 8,
  },
  iconLocked: {
    opacity: 0.4,
  },
  badgeName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#E2E8F0',
    textAlign: 'center',
    marginBottom: 4,
  },
  badgeDesc: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 15,
  },
  textLocked: {
    opacity: 0.35,
  },
  rarityTag: {
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  rarityText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
