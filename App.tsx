import 'react-native-url-polyfill/auto';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, AppState } from 'react-native';
import HomeScreen from './src/screens/HomeScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import BadgesScreen from './src/screens/BadgesScreen';
import LaboScreen from './src/screens/LaboScreen';
import TasksScreen from './src/screens/TasksScreen';
import ProfilePickerScreen from './src/screens/ProfilePickerScreen';
import TeamSetupScreen from './src/screens/TeamSetupScreen';
import TabBar, { TabName } from './src/components/TabBar';
import { AllProfiles, AppData, checkBadges } from './src/types';
import {
  loadAllProfiles, saveAllProfiles, getActiveData, setActiveData, loadFromSupabase,
} from './src/utils/storage';
import { getTeamId } from './src/utils/supabase';

const POLL_INTERVAL = 30000; // 30 secondes

export default function App() {
  const [tab,        setTab]        = useState<TabName>('home');
  const [showPicker, setShowPicker] = useState(true);
  const [teamReady,  setTeamReady]  = useState(false);
  const [all,        setAll]        = useState<AllProfiles>({ profiles: [], activeId: '', data: {} });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appState = useRef(AppState.currentState);

  // Charge le team ID au démarrage
  useEffect(() => {
    (async () => {
      const teamId = await getTeamId();
      if (teamId) {
        const loaded = await loadAllProfiles();
        setAll(loaded);
        setTeamReady(true);
        if (loaded.profiles.length === 1 && !loaded.profiles[0].password) setShowPicker(false);
      }
    })();
  }, []);

  // Polling toutes les 30s pour sync équipe
  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const remote = await loadFromSupabase();
      if (remote) setAll(remote);
    }, POLL_INTERVAL);
  }, []);

  useEffect(() => {
    if (!teamReady) return;
    startPolling();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        // Rafraîchit immédiatement quand l'app reprend le focus
        loadFromSupabase().then(remote => { if (remote) setAll(remote); });
        startPolling();
      } else if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    });
    return () => { sub.remove(); if (pollRef.current) clearInterval(pollRef.current); };
  }, [teamReady, startPolling]);

  const data          = getActiveData(all);
  const activeProfile = all.profiles.find(p => p.id === all.activeId) ?? all.profiles[0];

  function handleDataChange(newData: AppData) {
    const checked = checkBadges(newData);
    const newAll  = setActiveData(all, checked);
    setAll(newAll);
    saveAllProfiles(newAll);
  }

  function handleProfileChange(newAll: AllProfiles) {
    setAll(newAll);
    saveAllProfiles(newAll);
  }

  function handleSelectProfile(profileId: string) {
    const newAll = { ...all, activeId: profileId };
    setAll(newAll);
    saveAllProfiles(newAll);
    setShowPicker(false);
  }

  function handleTeamReady(initialAll: AllProfiles, teamId: string) {
    setAll(initialAll);
    setTeamReady(true);
    setShowPicker(initialAll.profiles.length > 0);
  }

  // Écran de setup équipe (première ouverture)
  if (!teamReady) {
    return <TeamSetupScreen onTeamReady={handleTeamReady} />;
  }

  // Sélection de profil (style Netflix)
  if (showPicker || !all.activeId) {
    return (
      <ProfilePickerScreen
        all={all}
        onChange={handleProfileChange}
        onSelect={handleSelectProfile}
      />
    );
  }

  return (
    <View style={styles.root}>
      {tab === 'home' && (
        <HomeScreen
          onDataChange={handleDataChange}
          profileData={data}
          profile={activeProfile}
          onProfilePress={() => setShowPicker(true)}
        />
      )}
      {tab === 'calendar' && <CalendarScreen data={data} all={all} />}
      {tab === 'labo'     && <LaboScreen  all={all} onChange={handleProfileChange} />}
      {tab === 'tasks'    && <TasksScreen all={all} onChange={handleProfileChange} />}
      {tab === 'badges'   && <BadgesScreen data={data} all={all} />}
      <TabBar active={tab} onChange={setTab} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#09090F' },
});
