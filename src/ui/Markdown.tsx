import * as WebBrowser from 'expo-web-browser';
import { Fragment, useMemo, type ReactNode } from 'react';
import { Text, type TextStyle } from 'react-native';
import { Renderer, useMarkdown } from 'react-native-marked';
import { useColors } from '../theme/theme';
import { radius, type } from '../theme/tokens';

// Links open in the in-app browser (components.md › MessageBubble).
class InAppLinkRenderer extends Renderer {
  link(children: string | ReactNode[], href: string, styles?: TextStyle): ReactNode {
    return (
      <Text key={href + String(children)} accessibilityRole="link" style={styles} onPress={() => WebBrowser.openBrowserAsync(href)}>
        {children}
      </Text>
    );
  }
}

export function Markdown({ text, color }: { text: string; color: string }) {
  const c = useColors();
  const renderer = useMemo(() => new InAppLinkRenderer({ selectable: false }), []);
  const elements = useMarkdown(text, {
    renderer,
    styles: {
      text: { ...type.body, color },
      paragraph: { paddingVertical: 2, marginBottom: 0 },
      strong: { ...type.bodyStrong, color },
      link: { color: c.link, textDecorationLine: 'underline', fontStyle: 'normal' },
      li: { ...type.body, color },
      list: { marginBottom: 0 },
      codespan: { ...type.mono, color, backgroundColor: c.bgMuted },
      code: { backgroundColor: c.bgMuted, borderRadius: radius.sm, padding: 8, marginVertical: 4 },
      codeText: { ...type.mono, color },
      h1: { ...type.titleNav, color },
      h2: { ...type.bodyStrong, color },
      h3: { ...type.bodyStrong, color },
      blockquote: { borderLeftColor: c.border, paddingLeft: 8 },
    },
  });
  return (
    <>
      {elements.map((el, i) => (
        <Fragment key={i}>{el}</Fragment>
      ))}
    </>
  );
}
