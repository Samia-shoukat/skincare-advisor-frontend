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

import { Body, Button, FormScreen, Heading } from './components/ui';
import { AuthProvider, useAuth } from './lib/auth';
import { color } from './lib/theme';
import { AuthFormScreen, AuthMode } from './screens/AuthFormScreen';
import { ForgotPasswordScreen } from './screens/ForgotPasswordScreen';
import { OnboardingHomeScreen } from './screens/OnboardingHomeScreen';
import { WelcomeScreen } from './screens/WelcomeScreen';

type AuthRoute = { name: 'welcome' } | { name: 'form'; mode: AuthMode } | { name: 'forgot' };

function Root() {
  const { loading, session, error, refresh, signOut } = useAuth();
  const [route, setRoute] = useState<AuthRoute>({ name: 'welcome' });

  if (loading) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator color={color.brand} />
      </View>
    );
  }

  if (!session) {
    if (route.name === 'forgot') {
      return <ForgotPasswordScreen onBack={() => setRoute({ name: 'form', mode: 'login' })} />;
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
      <WelcomeScreen
        onRegister={() => setRoute({ name: 'form', mode: 'register' })}
        onLogin={() => setRoute({ name: 'form', mode: 'login' })}
      />
    );
  }

  // Signed in to Supabase but our backend did not answer. In development this
  // is almost always EXPO_PUBLIC_API_URL, so say so rather than showing an
  // empty screen.
  if (error) {
    return (
      <FormScreen
        footer={
          <>
            <Button label="Try again" onPress={refresh} />
            <Button label="Sign out" tone="outline" onPress={signOut} />
          </>
        }
      >
        <Heading>Can't reach your profile</Heading>
        <Body muted>{error}</Body>
      </FormScreen>
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
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.base,
  },
});