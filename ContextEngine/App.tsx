import React from 'react';
import { LogBox, Platform, StatusBar, StyleSheet, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppBackground } from './src/shared/components/AppBackground';
import { AppShell } from './src/app/AppShell';
import { useAppBootstrap } from './src/app/AppBootstrap';
import { useAssistantIntentCapture } from './src/shared/hooks/useAssistantIntentCapture';
import { useAppLifecycleSync } from './src/shared/hooks/useAppLifecycleSync';
import { useQuickCaptureRequest } from './src/shared/hooks/useQuickCaptureRequest';
import { useAutomaticReminders } from './src/shared/hooks/useAutomaticReminders';

function App(): React.JSX.Element {
  if (__DEV__) {
    LogBox.ignoreAllLogs(true);
  }

  const { bootMessage, contextPath } = useAppBootstrap();
  const quickCaptureRequests = useQuickCaptureRequest();
  const colorScheme = useColorScheme();
  useAppLifecycleSync();
  useAssistantIntentCapture();
  useAutomaticReminders();

  return (
    <SafeAreaProvider>
      <AppBackground style={styles.screen}>
        {Platform.OS === 'ios' ? (
          <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
        ) : null}
        <AppShell
          bootMessage={bootMessage}
          contextPath={contextPath}
          quickCaptureRequest={quickCaptureRequests.type}
          quickRecordRequest={quickCaptureRequests.record}
        />
      </AppBackground>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
});

export default App;
