import { useSegments } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HistoryDrawer } from '../ui/HistoryDrawer';
import { AppProvider } from '../state/AppState';
import { useColors } from '../theme/theme';

function Navigator() {
  const c = useColors();
  const segments = useSegments();
  // Edge swipe opens the drawer on Chatt only; pushed views use it for "back".
  const onChat = segments.length <= 1;
  return (
    <Drawer
      drawerContent={(props) => <HistoryDrawer navigation={props.navigation} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'front',
        swipeEnabled: onChat,
        drawerStyle: { width: '84%', backgroundColor: c.bgSidebar },
        overlayColor: c.scrim,
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Drawer.Screen name="(main)" />
    </Drawer>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProvider>
          <StatusBar style="auto" />
          <Navigator />
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
