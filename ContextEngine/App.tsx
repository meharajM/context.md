import React from 'react';
import { StatusBar, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppBackground } from './src/shared/components/AppBackground';
import { AppShell } from './src/app/AppShell';
import { useAppBootstrap } from './src/app/AppBootstrap';
import { useAssistantIntentCapture } from './src/shared/hooks/useAssistantIntentCapture';
import { useAppLifecycleSync } from './src/shared/hooks/useAppLifecycleSync';

function App(): React.JSX.Element {
  const { bootMessage, contextPath } = useAppBootstrap();
  useAppLifecycleSync();
  useAssistantIntentCapture();

  return (
    <SafeAreaProvider>
      <AppBackground style={styles.screen}>
        <StatusBar barStyle="dark-content" />
        <AppShell bootMessage={bootMessage} contextPath={contextPath} />
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
