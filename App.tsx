/**
 * App root.
 *
 * No navigation library yet. The auth flow is a handful of mutually exclusive
 * screens and onboarding is strictly linear with the server deciding what comes
 * next, so there is no history worth pushing and popping. Adding a navigator
 * now would create a second source of truth for where the user is, and the
 * server's would win anyway.
 *
 * A navigator earns its place when the scan and routine screens land, since
 * those are genuinely browsable.
 */

import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CaptureScreen } from './screens/CaptureScreen';

import { Body, Button, FormScreen, Heading, LinkButton } from './components/ui';
import { AuthProvider, useAuth } from './lib/auth';
import { color } from './lib/theme';
import { AuthFormScreen, AuthMode } from './screens/AuthFormScreen';
import { CaptureSpikeScreen } from './screens/CaptureSpikeScreen';
import { ForgotPasswordScreen } from './screens/ForgotPasswordScreen';
import { clearRoutine } from './lib/routineCache';
import { OfflineRoutineFallback } from './screens/OfflineRoutineFallback';
import { OnboardingHomeScreen } from './screens/OnboardingHomeScreen';
import { WelcomeScreen } from './screens/WelcomeScreen';

type Route =
  | { name: 'welcome' }
  | { name: 'form'; mode: AuthMode }
  | { name: 'forgot' }
  | { name: 'capture' }
  | { name: 'captureProd' };

function Root() {
  const { loading, session, error, refresh, signOut } = useAuth();
  const [route, setRoute] = useState<Route>({ name: 'welcome' });

  // Checked before anything else, and outside the signed-in branch, because
  // the capture gate has nothing to do with who you are — it measures the
  // device. Requiring a sign-in first would mean re-running onboarding every
  // time the measurement needs repeating on a different phone.
  //
  // __DEV__ is a compile-time constant, so this whole branch is stripped from
  // a production build rather than merely being unreachable.
  if (__DEV__ && route.name === 'capture') {
    return <CaptureSpikeScreen onExit={() => setRoute({ name: 'welcome' })} />;
  }
  if (__DEV__ && route.name === 'captureProd') {
  return (
    <CaptureScreen
      copy={{ retake: 'Retake', retakeGuidance: 'Retake guidance' }}
      onReferralRequired={() => setRoute({ name: 'welcome' })}
      onScanComplete={(result) => {
        console.log('Scan complete:', result);
        setRoute({ name: 'welcome' });
      }}
      onExit={() => setRoute({ name: 'welcome' })}
    />
  );
}

  if (loading) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator color={color.primary} />
      </View>
    );
  }

  if (!session) {
    if (route.name === 'forgot') {
      return (
        <ForgotPasswordScreen onBack={() => setRoute({ name: 'form', mode: 'login' })} />
      );
    }
    if (route.name === 'form') {
      return (
        <AuthFormScreen
          mode={route.mode}
          onBack={() => setRoute({ name: 'welcome' })}
          onForgotPassword={() => setRoute({ name: 'forgot' })}
          onSwitchMode={(mode) => setRoute({ name: 'form', mode })}
        />
      );
    }
    return (
      <View style={styles.fill}>
        <WelcomeScreen
          onRegister={() => setRoute({ name: 'form', mode: 'register' })}
          onLogin={() => setRoute({ name: 'form', mode: 'login' })}
        />
        {__DEV__ ? (
  <View style={styles.devBar}>
    <LinkButton
      label="Capture gate spike"
      onPress={() => setRoute({ name: 'capture' })}
    />
    <LinkButton
      label="Capture screen (prod)"
      onPress={() => setRoute({ name: 'captureProd' })}
    />
  </View>
) : null}
      </View>
    );
  }

  // Signed in to Supabase but our backend did not answer. In development this
  // is almost always EXPO_PUBLIC_API_URL, so say so rather than showing an
  // empty screen.
  if (error) {
    // DR-002: signing out removes this account's saved routine from the phone.
    const signOutAndForget = async () => {
      await clearRoutine(session.user.id);
      signOut();
    };
    const errorScreen = (
      <FormScreen
        footer={
          <>
            <Button label="Try again" onPress={refresh} />
            <Button label="Sign out" tone="outline" onPress={signOutAndForget} />
          </>
        }
      >
        <Heading>Can't reach your profile</Heading>
        <Body muted>{error}</Body>
      </FormScreen>
    );
    // SRS 2.4: a saved routine is still viewable when the backend is not.
    return (
      <OfflineRoutineFallback
        userId={session.user.id}
        onRetry={refresh}
        onSignOut={signOutAndForget}
        fallback={errorScreen}
      />
    );
  }

  return <OnboardingHomeScreen />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Root />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.ground,
  },
  devBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: 4,
  },
});