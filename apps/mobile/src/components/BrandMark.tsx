import { Image, StyleSheet, View } from 'react-native';
export function BrandMark({ size = 44 }: { size?: number }) { return <View style={[styles.frame, { width: size, height: size, borderRadius: size * .28 }]}><Image source={require('../../assets/sali-logo.png')} resizeMode="contain" style={styles.image} /></View>; }
const styles = StyleSheet.create({ frame: { overflow: 'hidden', backgroundColor: '#fff' }, image: { width: '100%', height: '100%' } });
