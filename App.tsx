import 'react-native-url-polyfill/auto';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, AppState } from 'react-native';
import HomeScreen from './src/screens/HomeScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import BadgesScreen from './src/screens/BadgesScreen';
import LaboScreen from './src/screens/LaboScreen';
import TasksScreen from './src/screens/TasksScreen';
import TeamSetupScreen from './src/screens/TeamSetupScreen';
import TabBar, { TabName } from './src/components/TabBar';
import { AllProfiles, AppData, checkBadges } from './src/types';
import {
  loadAllProfiles, saveAllProfiles, getActiveData, setActiveData, loadFromSupabase,
} from './src/utils/storage';
import { getTeamId, getMyProfileId, setMyProfileId } from './src/utils/supabase';

const POLL_INTERVAL = 30000;

export default function App() {
  const [tab,        setTab]        = useState<TabName>('home');
  const [ready,      setReady]      = useState(false);   // setup terminé
  const [all,        setAll]        = useState<AllProfiles>({ profiles: [], activeId: '', data: {} });
  const [myId,       setMyId]       = useState('');
  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  // Chargement initial
  useEffect(() => {
    (async () => {
      const teamId   = await getTeamId();
      const profileId = await getMyProfileId();
      if (teamId && profileId) {
        const loaded = await loadAllProfiles();
        // S'assurer que le profil existe encore dans l'équipe
        if (loaded.profiles.some(p => p.id === profileId)) {
          const withActive = { ...loaded, activeId: profileId };
          setAll(withActive);
          setMyId(profileId);
          setReady(true);
          return;
        }
      }
      // Pas encore configuré
    })();
  }, []);

  // Polling 30s
  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const remote = await loadFromSupabase();
      if (remote) setAll(prev => ({ ...remote, activeId: prev.activeId }));
    }, POLL_INTERVAL);
  }, []);

  useEffect(() => {
    if (!ready) return;
    startPolling();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        loadFromSupabase().then(r => { if (r) setAll(prev => ({ ...r, activeId: prev.activeId })); });
        startPolling();
      } else if (pollRef.current) clearInterval(pollRef.current);
    });
    return () => { sub.remove(); if (pollRef.current) clearInterval(pollRef.current); };
  }, [ready, startPolling]);

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

  function handleTeamReady(initialAll: AllProfiles, profileId: string) {
    const withActive = { ...initialAll, activeId: profileId };
    setAll(withActive);
    setMyId(profileId);
    setMyProfileId(profileId);
    setReady(true);
  }

  if (!ready) {
    return <TeamSetupScreen onReady={handleTeamReady} />;
  }

  const data          = getActiveData(all);
  const activeProfile = all.profiles.find(p => p.id === myId) ?? all.profiles[0];

  return (
    <View style={styles.root}>
      {tab === 'home' && (
        <HomeScreen
          onDataChange={handleDataChange}
          profileData={data}
          profile={activeProfile}
          onProfilePress={() => {}} // plus de changement de profil
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
