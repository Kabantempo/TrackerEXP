import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import HomeScreen from './src/screens/HomeScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import BadgesScreen from './src/screens/BadgesScreen';
import TabBar, { TabName } from './src/components/TabBar';
import { AppData, checkBadges } from './src/types';
import { loadData, saveData } from './src/utils/storage';

export default function App() {
  const [tab, setTab] = useState<TabName>('home');
  const [data, setData] = useState<AppData>({ habits: [], entries: [], totalXP: 0, earnedBadges: [] });

  useEffect(() => {
    loadData().then(setData);
  }, []);

  function handleDataChange(newData: AppData) {
    const checked = checkBadges(newData);
    setData(checked);
    if (checked !== newData) saveData(checked);
  }

  return (
    <View style={styles.root}>
      {tab === 'home' && <HomeScreen onDataChange={handleDataChange} />}
      {tab === 'calendar' && <CalendarScreen data={data} />}
      {tab === 'badges' && <BadgesScreen data={data} />}
      <TabBar active={tab} onChange={setTab} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F9FAFB' },
});
