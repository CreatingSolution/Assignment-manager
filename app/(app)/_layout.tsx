import { Stack } from 'expo-router';
import React from 'react';

export default function AppLayout(): React.JSX.Element {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="assignments/create" />
      <Stack.Screen name="assignments/[id]" />
      <Stack.Screen name="groups/index" />
      <Stack.Screen name="groups/create" />
      <Stack.Screen name="groups/[id]" />
      <Stack.Screen name="smart-schedule" />
    </Stack>
  );
}
