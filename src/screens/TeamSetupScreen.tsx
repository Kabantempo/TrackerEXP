import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  SafeAreaView, StatusBar, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { generateTeamCode, setTeamId, setMyProfileId } from '../utils/supabase';
import { teamExists, loadFromSupabase, saveAllProfiles } from '../utils/storage';
import { AllProfiles, HABIT_COLORS, getTodayKey } from '../types';
import { T } from '../theme';

const AVATAR_COLORS = HABIT_COLORS;

type Step = 'choice' | 'create-name' | 'join-code' | 'join-name';

interface Props {
  onReady: (all: AllProfiles, myProfileId: string) => void;
}

function makeProfile(id: string, name: string, color: string, password?: string) {
  return { id, name, emoji: color, createdAt: getTodayKey(), ...(password ? { password } : {}) };
}

export default function TeamSetupScreen({ onReady }: Props) {
  const [step,     setStep]     = useState<Step>('choice');
  const [teamCode, setTeamCode] = useState('');
  const [name,     setName]     = useState('');
  const [color,    setColor]    = useState(AVATAR_COLORS[0]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [takenColors, setTakenColors] = useState<string[]>([]);

  function reset() { setError(''); setName(''); setColor(AVATAR_COLORS[0]); }

  /* ── CRÉER une équipe ────────────────────────────────────────────── */
  async function handleCreate() {
    if (!name.trim()) { setError('Entre ton prénom.'); return; }
    setLoading(true); setError('');
    try {
      const code = generateTeamCode();
      const profileId = `profile_${Date.now()}`;
      const profile   = makeProfile(profileId, name.trim(), color);
      const all: AllProfiles = {
        profiles: [profile],
        activeId: profileId,
        data: { [profileId]: { habits: [], entries: [], totalXP: 0, earnedBadges: [] } },
        laboSessions: [],
        groupTasks:   [],
      };
      await setTeamId(code);
      await setMyProfileId(profileId);
      await saveAllProfiles(all);
      onReady(all, profileId);
    } catch { setError('Erreur. Réessaie.'); }
    setLoading(false);
  }

  /* ── REJOINDRE une équipe ────────────────────────────────────────── */
  async function handleCheckCode() {
    const code = teamCode.trim().toUpperCase();
    if (code.length < 4) { setError('Code trop court.'); return; }
    setLoading(true); setError('');
    try {
      await setTeamId(code);
      const remote = await loadFromSupabase();
      if (!remote) { setError('Code introuvable. Vérifie avec ton équipe.'); setLoading(false); return; }
      // Couleurs déjà prises
      const taken = remote.profiles.map(p =>
        /^#[0-9A-Fa-f]{6}$/.test(p.emoji) ? p.emoji : AVATAR_COLORS[0]
      );
      setTakenColors(taken);
      const firstFree = AVATAR_COLORS.find(c => !taken.includes(c)) ?? AVATAR_COLORS[0];
      setColor(firstFree);
      setStep('join-name');
    } catch { setError('Erreur de connexion.'); }
    setLoading(false);
  }

  async function handleJoin() {
    if (!name.trim()) { setError('Entre ton prénom.'); return; }
    setLoading(true); setError('');
    try {
      const remote = await loadFromSupabase();
      if (!remote) { setError('Erreur lors du chargement.'); setLoading(false); return; }
      const profileId = `profile_${Date.now()}`;
      const profile   = makeProfile(profileId, name.trim(), color);
      const newAll: AllProfiles = {
        ...remote,
        profiles: [...remote.profiles, profile],
        data: { ...remote.data, [profileId]: { habits: [], entries: [], totalXP: 0, earnedBadges: [] } },
      };
      await setMyProfileId(profileId);
      await saveAllProfiles(newAll);
      onReady(newAll, profileId);
    } catch { setError('Erreur. Réessaie.'); }
    setLoading(false);
  }

  const availableColors = AVATAR_COLORS.filter(c => !takenColors.includes(c));
  const initial = name.trim().charAt(0).toUpperCase() || '?';

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <LinearGradient colors={['#0C1F0E', '#0A0F0A', '#09090F']} style={styles.gradient}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

            <View style={styles.logoWrap}>
              <Text style={styles.logo}>KABAN</Text>
              <Text style={styles.logoSub}>Application d'équipe</Text>
            </View>

            {/* ── Choix initial ── */}
            {step === 'choice' && (
              <View style={styles.content}>
                <Text style={styles.title}>Bienvenue !</Text>
                <Text style={styles.subtitle}>Rejoins ton équipe ou crée-en une nouvelle.</Text>

                <TouchableOpacity style={styles.primaryBtn} onPress={() => { reset(); setStep('join-code'); }}>
                  <Ionicons name="enter-outline" size={20} color="#fff" />
                  <Text style={styles.primaryBtnTxt}>Rejoindre une équipe</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.secondaryBtn} onPress={() => { reset(); setStep('create-name'); }}>
                  <Ionicons name="add-circle-outline" size={20} color={T.accentSoft} />
                  <Text style={styles.secondaryBtnTxt}>Créer une nouvelle équipe</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── Saisie code pour rejoindre ── */}
            {step === 'join-code' && (
              <View style={styles.content}>
                <Back onPress={() => { setStep('choice'); setError(''); setTeamCode(''); }} />
                <Text style={styles.title}>Code d'équipe</Text>
                <Text style={styles.subtitle}>Demande le code à un membre de ton équipe.</Text>
                <TextInput
                  style={styles.codeInput}
                  value={teamCode}
                  onChangeText={t => { setTeamCode(t.toUpperCase()); setError(''); }}
                  placeholder="Ex: XK9F2A"
                  placeholderTextColor={T.text3}
                  autoCapitalize="characters"
                  autoFocus maxLength={8}
                  selectionColor={T.accent}
                />
                {!!error && <Text style={styles.error}>{error}</Text>}
                <TouchableOpacity
                  style={[styles.primaryBtn, (!teamCode.trim() || loading) && { opacity: 0.5 }]}
                  onPress={handleCheckCode} disabled={!teamCode.trim() || loading}
                >
                  {loading ? <ActivityIndicator color="#fff" /> : (
                    <><Ionicons name="arrow-forward" size={18} color="#fff" /><Text style={styles.primaryBtnTxt}>Continuer</Text></>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* ── Saisie nom + couleur (créer ou rejoindre) ── */}
            {(step === 'create-name' || step === 'join-name') && (
              <View style={styles.content}>
                <Back onPress={() => { setStep(step === 'create-name' ? 'choice' : 'join-code'); setError(''); }} />
                <Text style={styles.title}>
                  {step === 'create-name' ? 'Ton profil' : 'Rejoindre l\'équipe'}
                </Text>
                <Text style={styles.subtitle}>Comment tu t'appelles ?</Text>

                {/* Prévisualisation avatar */}
                <View style={[styles.avatarPreview, { backgroundColor: color }]}>
                  <Text style={styles.avatarInitial}>{initial}</Text>
                </View>

                {/* Nom */}
                <Text style={styles.label}>Prénom</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={t => { setName(t); setError(''); }}
                  placeholder="Ton prénom"
                  placeholderTextColor={T.text3}
                  autoFocus selectionColor={T.accent}
                />

                {/* Couleur */}
                <Text style={styles.label}>Couleur</Text>
                <View style={styles.colorRow}>
                  {AVATAR_COLORS.map(c => {
                    const taken = step === 'join-name' && takenColors.includes(c);
                    return (
                      <TouchableOpacity
                        key={c} disabled={taken}
                        style={[styles.colorDot, { backgroundColor: c, opacity: taken ? 0.2 : 1 }, color === c && styles.colorDotActive]}
                        onPress={() => setColor(c)}
                      />
                    );
                  })}
                </View>
                {step === 'join-name' && takenColors.length > 0 && (
                  <Text style={styles.takenNote}>Les couleurs grisées sont déjà prises.</Text>
                )}

                {!!error && <Text style={styles.error}>{error}</Text>}

                <TouchableOpacity
                  style={[styles.primaryBtn, (!name.trim() || loading) && { opacity: 0.5 }]}
                  onPress={step === 'create-name' ? handleCreate : handleJoin}
                  disabled={!name.trim() || loading}
                >
                  {loading ? <ActivityIndicator color="#fff" /> : (
                    <><Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                    <Text style={styles.primaryBtnTxt}>
                      {step === 'create-name' ? 'Créer mon équipe' : 'Rejoindre'}
                    </Text></>
                  )}
                </TouchableOpacity>
              </View>
            )}

          </ScrollView>
        </LinearGradient>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Back({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.back}>
      <Ionicons name="chevron-back" size={18} color={T.text2} />
      <Text style={styles.backTxt}>Retour</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root:     { flex: 1, backgroundColor: '#09090F' },
  gradient: { flex: 1 },
  scroll:   { flexGrow: 1, paddingHorizontal: 28, paddingBottom: 40 },
  logoWrap: { alignItems: 'center', paddingTop: 60, marginBottom: 48 },
  logo:     { fontSize: 40, fontWeight: '900', color: T.text, letterSpacing: 10 },
  logoSub:  { fontSize: 13, color: T.text2, marginTop: 6, letterSpacing: 1 },
  content:  {},
  back:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 24 },
  backTxt:  { fontSize: 14, color: T.text2, fontWeight: '600' },
  title:    { fontSize: 26, fontWeight: '900', color: T.text, marginBottom: 10 },
  subtitle: { fontSize: 14, color: T.text2, lineHeight: 20, marginBottom: 28 },

  codeInput: {
    backgroundColor: T.cardAlt, borderRadius: 16,
    paddingHorizontal: 20, paddingVertical: 18,
    fontSize: 28, fontWeight: '800', color: T.text,
    letterSpacing: 8, textAlign: 'center',
    borderWidth: 1.5, borderColor: T.border, marginBottom: 12,
  },

  avatarPreview: {
    width: 80, height: 80, borderRadius: 24,
    alignSelf: 'center', alignItems: 'center', justifyContent: 'center',
    marginBottom: 24, borderWidth: 2, borderColor: 'rgba(255,255,255,0.15)',
  },
  avatarInitial: { fontSize: 36, fontWeight: '900', color: '#fff' },

  label:    { fontSize: 11, color: T.text2, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10, marginTop: 16 },
  input:    { backgroundColor: T.input, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, color: T.text, fontSize: 16, borderWidth: 1, borderColor: T.border },
  colorRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  colorDot: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'transparent' },
  colorDotActive: { borderColor: '#fff', transform: [{ scale: 1.15 }] },
  takenNote:{ fontSize: 11, color: T.text3, marginTop: 6 },

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: T.accent, borderRadius: 16, paddingVertical: 16, marginTop: 28,
  },
  primaryBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: T.accentDim, borderRadius: 16, paddingVertical: 16, marginTop: 12,
    borderWidth: 1, borderColor: T.accent + '55',
  },
  secondaryBtnTxt: { color: T.accentSoft, fontWeight: '700', fontSize: 16 },
  error: { color: T.error, fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 8 },
});
