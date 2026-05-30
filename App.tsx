import 'react-native-url-polyfill/auto';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, AppState } from 'react-native';
import HomeScreen from './src/screens/HomeScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import BadgesScreen from './src/screens/BadgesScreen';
import LaboScreen from './src/screens/LaboScreen';
import TasksScreen from './src/screens/TasksScreen';
import ProfilePickerScreen from './src/screens/ProfilePickerScreen';
import TabBar, { TabName } from './src/components/TabBar';
import { AllProfiles, AppData, checkBadges } from './src/types';
import {
  loadAllProfiles, saveAllProfiles, getActiveData, setActiveData, loadFromSupabase,
} from './src/utils/storage';

const POLL_INTERVAL = 30000;

export default function App() {
  const [tab,        setTab]        = useState<TabName>('home');
  const [showPicker, setShowPicker] = useState(true);
  const [all,        setAll]        = useState<AllProfiles>({ profiles: [], activeId: '', data: {} });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Chargement initial depuis Supabase partagé
  useEffect(() => {
    loadAllProfiles().then(loaded => {
      setAll(loaded);
      if (loaded.profiles.length === 1 && !loaded.profiles[0].password) {
        // 1 seul profil sans mdp → sélection auto
        setShowPicker(false);
      }
    });
  }, []);

  // Polling 30s pour sync équipe
  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const remote = await loadFromSupabase();
      if (remote) setAll(prev => ({ ...remote, activeId: prev.activeId }));
    }, POLL_INTERVAL);
  }, []);

  useEffect(() => {
    startPolling();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        loadFromSupabase().then(r => { if (r) setAll(prev => ({ ...r, activeId: prev.activeId })); });
        startPolling();
      } else if (pollRef.current) clearInterval(pollRef.current);
    });
    return () => { sub.remove(); if (pollRef.current) clearInterval(pollRef.current); };
  }, [startPolling]);

  const data          = getActiveData(all);
  const activeProfile = all.profiles.find(p => p.id === all.activeId) ?? all.profiles[0];

  function handleDataChange(newData: AppData) {
    const checked = checkBadges(newData);
    const newAll  = setActiveData(all, checked);
    setAll(newAll);
    saveAllProfiles(newAll);
  }

  function handleProfileChange(newAll: AllProfiles) {
    setAll(prev => ({ ...newAll, activeId: prev.activeId }));
    saveAllProfiles(newAll);
  }

  function handleSelectProfile(profileId: string) {
    const newAll = { ...all, activeId: profileId };
    setAll(newAll);
    saveAllProfiles(newAll);
    setShowPicker(false);
  }

  // Écran Netflix si pas encore de profil sélectionné
  if (showPicker || !all.activeId) {
    return (
      <ProfilePickerScreen
        all={all}
        onChange={newAll => { setAll(newAll); saveAllProfiles(newAll); }}
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
      {tab === 'calendar' && <CalendarScreen data={data} all={all} onChange={handleProfileChange} />}
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
