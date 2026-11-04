import { forwardRef } from 'react';
import { Text as RNText, TextInput as RNTextInput, type TextInputProps, type TextProps } from 'react-native';
import { withSaliFont } from '../theme/fonts';

/** Drop-in replacements for React Native's Text / TextInput that always use Sali Sans. */
export const Text = forwardRef<RNText, TextProps>(function SaliText({ style, ...props }, ref) {
  return <RNText ref={ref} {...props} style={withSaliFont(style)} />;
});

export const TextInput = forwardRef<RNTextInput, TextInputProps>(function SaliTextInput({ style, ...props }, ref) {
  return <RNTextInput ref={ref} {...props} style={withSaliFont(style)} />;
});
