import React from 'react';
import {
  View, Text, FlatList, StyleSheet, SafeAreaView, StatusBar,
} from 'react-native';
import { AppData, BADGES, BadgeDef } from '../types';

const RARITY_COLORS: Record<BadgeDef['rarity'], string> = {
  common:    '#F9FAFB',
  rare:      '#EFF6FF',
  epic:      '#F5F3FF',
  legendary: '#FFFBEB',
};

const RARITY_BORDER: Record<BadgeDef['rarity'], string> = {
  common:    '#E5E7EB',
  rare:      '#BFDBFE',
  epic:      '#DDD6FE',
  legendary: '#FDE68A',
};

const RARITY_GLOW: Record<BadgeDef['rarity'], string> = {
  common:    '#6B7280',
  rare:      '#3B82F6',
  epic:      '#8B5CF6',
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
  const bg = earned ? RARITY_COLORS[badge.rarity] : '#F9FAFB';
  const border = earned ? RARITY_BORDER[badge.rarity] : '#E5E7EB';
  const glow = RARITY_GLOW[badge.rarity];

  return (
    <View style={styles.cardWrapper}>
      <View style={[styles.card, { backgroundColor: bg, borderColor: border }]}>
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
          <View style={[styles.rarityTag, { backgroundColor: glow + '22', borderColor: glow + '55' }]}>
            <Text style={[styles.rarityText, { color: glow }]}>
              {RARITY_LABEL[badge.rarity]}
            </Text>
          </View>
        )}
      </View>
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
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.header}>
        <Text style={styles.title}>Badges</Text>
        <Text style={styles.subtitle}>{earnedCount} / {total} débloqués</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${(earnedCount / total) * 100}%` as any }]} />
        </View>
      </View>

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
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 24,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#111827',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 12,
  },
  progressBar: {
    width: '80%',
    height: 5,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#111827',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    minHeight: 150,
    justifyContent: 'center',
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
    color: '#111827',
    textAlign: 'center',
    marginBottom: 4,
  },
  badgeDesc: {
    fontSize: 11,
    color: '#6B7280',
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
