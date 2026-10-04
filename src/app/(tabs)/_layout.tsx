import { Tabs } from 'expo-router/js-tabs';

import { GlassTabBar } from '@/components/navigation/GlassTabBar';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <GlassTabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="planner" options={{ title: 'Planner' }} />
      <Tabs.Screen name="assistant" options={{ title: 'Buddy' }} />
      <Tabs.Screen name="journey" options={{ title: 'Journey' }} />
      <Tabs.Screen name="journal" options={{ title: 'Journal' }} />
    </Tabs>
  );
}
