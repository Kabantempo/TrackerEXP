import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  SafeAreaView, StatusBar, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { generateTeamCode, setTeamId } from '../utils/supabase';
import { teamExists, loadFromSupabase, saveAllProfiles } from '../utils/storage';
import { AllProfiles, getTodayKey } from '../types';
import { T } from '../theme';

interface Props {
  onTeamReady: (all: AllProfiles, teamId: string) => void;
}

function makeEmptyTeam(): AllProfiles {
  return { profiles: [], activeId: '', data: {}, laboSessions: [], groupTasks: [] };
}

export default function TeamSetupScreen({ onTeamReady }: Props) {
  const [mode,    setMode]    = useState<'choice' | 'join' | 'create'>('choice');
  const [code,    setCode]    = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [newCode, setNewCode] = useState('');

  async function handleJoin() {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) { setError('Code trop court.'); return; }
    setLoading(true); setError('');
    try {
      await setTeamId(trimmed);
      const remote = await loadFromSupabase();
      if (!remote) {
        setError('Code introuvable. Vérifie ou crée une équipe.');
        setLoading(false); return;
      }
      onTeamReady(remote, trimmed);
    } catch {
      setError('Erreur de connexion. Réessaie.');
    }
    setLoading(false);
  }

  async function handleCreate() {
    const generated = generateTeamCode();
    setNewCode(generated);
    setLoading(true); setError('');
    try {
      await setTeamId(generated);
      const empty = makeEmptyTeam();
      await saveAllProfiles(empty);
      onTeamReady(empty, generated);
    } catch {
      setError('Erreur lors de la création.');
    }
    setLoading(false);
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#09090F" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <LinearGradient colors={['#0C1F0E', '#0A0F0A', '#09090F']} style={styles.gradient}>

          <View style={styles.logoWrap}>
            <Text style={styles.logo}>KABAN</Text>
            <Text style={styles.logoSub}>Application d'équipe</Text>
          </View>

          {mode === 'choice' && (
            <View style={styles.content}>
              <Text style={styles.title}>Bienvenue !</Text>
              <Text style={styles.subtitle}>Rejoins ton équipe ou crée-en une nouvelle.</Text>

              <TouchableOpacity style={styles.primaryBtn} onPress={() => setMode('join')}>
                <Ionicons name="enter-outline" size={20} color="#fff" />
                <Text style={styles.primaryBtnText}>Rejoindre une équipe</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.secondaryBtn} onPress={handleCreate}>
                {loading ? <ActivityIndicator color={T.accent} /> : (
                  <>
                    <Ionicons name="add-circle-outline" size={20} color={T.accent} />
                    <Text style={styles.secondaryBtnText}>Créer une nouvelle équipe</Text>
                  </>
                )}
              </TouchableOpacity>
              {!!error && <Text style={styles.error}>{error}</Text>}
            </View>
          )}

          {mode === 'join' && (
            <View style={styles.content}>
              <TouchableOpacity onPress={() => { setMode('choice'); setError(''); setCode(''); }} style={styles.back}>
                <Ionicons name="chevron-back" size={18} color={T.text2} />
                <Text style={styles.backText}>Retour</Text>
              </TouchableOpacity>

              <Text style={styles.title}>Code d'équipe</Text>
              <Text style={styles.subtitle}>Demande le code à ton administrateur ou à un membre.</Text>

              <TextInput
                style={styles.codeInput}
                value={code}
                onChangeText={t => { setCode(t.toUpperCase()); setError(''); }}
                placeholder="Ex: XK9F2A"
                placeholderTextColor={T.text3}
                autoCapitalize="characters"
                autoFocus
                maxLength={8}
                selectionColor={T.accent}
              />

              {!!error && <Text style={styles.error}>{error}</Text>}

              <TouchableOpacity
                style={[styles.primaryBtn, (!code.trim() || loading) && { opacity: 0.5 }]}
                onPress={handleJoin}
                disabled={!code.trim() || loading}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <><Ionicons name="checkmark-circle-outline" size={20} color="#fff" /><Text style={styles.primaryBtnText}>Rejoindre</Text></>
                }
              </TouchableOpacity>
            </View>
          )}

        </LinearGradient>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:     { flex: 1, backgroundColor: '#09090F' },
  gradient: { flex: 1, paddingHorizontal: 28 },
  logoWrap: { alignItems: 'center', paddingTop: 60, marginBottom: 48 },
  logo:     { fontSize: 40, fontWeight: '900', color: T.text, letterSpacing: 10 },
  logoSub:  { fontSize: 13, color: T.text2, marginTop: 6, letterSpacing: 1 },
  content:  { flex: 1 },
  back:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 24 },
  backText: { fontSize: 14, color: T.text2, fontWeight: '600' },
  title:    { fontSize: 26, fontWeight: '900', color: T.text, marginBottom: 10 },
  subtitle: { fontSize: 14, color: T.text2, lineHeight: 20, marginBottom: 32 },
  codeInput: {
    backgroundColor: T.cardAlt, borderRadius: 16,
    paddingHorizontal: 20, paddingVertical: 18,
    fontSize: 28, fontWeight: '800', color: T.text,
    letterSpacing: 8, textAlign: 'center',
    borderWidth: 1.5, borderColor: T.border, marginBottom: 12,
  },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: T.accent, borderRadius: 16,
    paddingVertical: 16, marginBottom: 12,
  },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: T.accentDim, borderRadius: 16,
    paddingVertical: 16, borderWidth: 1, borderColor: T.accent + '55',
  },
  secondaryBtnText: { color: T.accentSoft, fontWeight: '700', fontSize: 16 },
  error: { color: T.error, fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 10 },
});
