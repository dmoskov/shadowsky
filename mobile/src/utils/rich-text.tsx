import React from 'react';
import {Text, Alert, TextStyle} from 'react-native';
import {RichText as AtpRichText, AppBskyRichtextFacet} from '@atproto/api';
import {colors} from '../constants/theme';
import {openLink} from './browser';

interface RichTextProps {
  text: string;
  facets?: AppBskyRichtextFacet.Main[];
  onMentionPress?: (handle: string, did: string) => void;
  onHashtagPress?: (tag: string) => void;
  style?: TextStyle;
  numberOfLines?: number;
}

export function RichText({
  text,
  facets,
  onMentionPress,
  onHashtagPress,
  style,
  numberOfLines,
}: RichTextProps) {
  // If no facets, just render plain text
  if (!facets || facets.length === 0) {
    return <Text style={style} numberOfLines={numberOfLines}>{text}</Text>;
  }

  // Create RichText instance to properly parse facets
  const rt = new AtpRichText({text, facets});
  const segments: React.ReactNode[] = [];

  let segmentIndex = 0;
  for (const segment of rt.segments()) {
    const key = `segment-${segmentIndex++}`;

    if (segment.isMention() && segment.mention) {
      // Render @mention as tappable blue text
      // Extract handle from the mention (remove @ prefix if present)
      const handle = segment.text.startsWith('@') ? segment.text.slice(1) : segment.text;
      segments.push(
        <Text
          key={key}
          style={{color: colors.primary}}
          onPress={() => {
            if (onMentionPress) {
              onMentionPress(handle, segment.mention!.did);
            }
          }}>
          {segment.text}
        </Text>,
      );
    } else if (segment.isLink() && segment.link) {
      // Render link as tappable blue text with underline
      segments.push(
        <Text
          key={key}
          style={{color: colors.primary, textDecorationLine: 'underline'}}
          onPress={() => {
            openLink(segment.link!.uri);
          }}
          onLongPress={() => {
            // Show action sheet on long press
            Alert.alert(
              segment.link!.uri,
              'Choose an action',
              [
                {
                  text: 'Open',
                  onPress: () => openLink(segment.link!.uri),
                },
                {
                  text: 'Copy URL',
                  onPress: () => {
                    // Note: React Native doesn't have built-in clipboard without expo
                    // Users will need to manually copy or we'd need @react-native-clipboard/clipboard
                    Alert.alert('URL', segment.link!.uri);
                  },
                },
                {
                  text: 'Cancel',
                  style: 'cancel',
                },
              ],
              {cancelable: true},
            );
          }}>
          {segment.text}
        </Text>,
      );
    } else if (segment.isTag() && segment.tag) {
      // Render #hashtag as tappable blue text
      segments.push(
        <Text
          key={key}
          style={{color: colors.primary}}
          onPress={() => {
            if (onHashtagPress) {
              onHashtagPress(segment.tag!.tag);
            }
          }}>
          {segment.text}
        </Text>,
      );
    } else {
      // Plain text segment
      segments.push(<Text key={key}>{segment.text}</Text>);
    }
  }

  return <Text style={style} numberOfLines={numberOfLines}>{segments}</Text>;
}
