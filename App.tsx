import 'react-native-url-polyfill/auto';
import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import HomeScreen from './src/screens/HomeScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import BadgesScreen from './src/screens/BadgesScreen';
import LaboScreen from './src/screens/LaboScreen';
import TasksScreen from './src/screens/TasksScreen';
import ProfilePickerScreen from './src/screens/ProfilePickerScreen';
import TabBar, { TabName } from './src/components/TabBar';
import { AllProfiles, AppData, checkBadges } from './src/types';
import {
  loadAllProfiles, saveAllProfiles, getActiveData, setActiveData,
} from './src/utils/storage';

export default function App() {
  const [tab,        setTab]        = useState<TabName>('home');
  const [showPicker, setShowPicker] = useState(true);
  const [all,        setAll]        = useState<AllProfiles>({
    profiles: [],
    activeId: '',
    data: {},
  });

  useEffect(() => {
    loadAllProfiles().then(loaded => {
      setAll(loaded);
      // Si un seul profil sans mdp, sélection auto
      if (loaded.profiles.length === 1 && !loaded.profiles[0].password) {
        setShowPicker(false);
      }
    });
  }, []);

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

  // Écran de sélection de profil (style Netflix)
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
      {tab === 'badges'   && <BadgesScreen data={data} />}
      <TabBar active={tab} onChange={setTab} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#09090F' },
});
