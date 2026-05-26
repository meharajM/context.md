import React from 'react';
import { StatusBar, StyleSheet } from 'react-native';

import { AppBackground } from './src/shared/components/AppBackground';
import { AppShell } from './src/app/AppShell';
import { useAppBootstrap } from './src/app/AppBootstrap';
import { useAppLifecycleSync } from './src/shared/hooks/useAppLifecycleSync';

function App(): React.JSX.Element {
  const { bootMessage, contextPath } = useAppBootstrap();
  useAppLifecycleSync();

  return (
    <AppBackground style={styles.screen}>
      <StatusBar barStyle="dark-content" />
      <AppShell bootMessage={bootMessage} contextPath={contextPath} />
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
});

export default App;
