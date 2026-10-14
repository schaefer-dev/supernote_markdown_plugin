import React, {useRef, useState} from 'react';
import {Image, StyleSheet, Text, View} from 'react-native';
import type {GestureResponderEvent} from 'react-native';
import type {PageSize, PlannedTextBox, Rect} from '../core/types';

export function PagePreview({size, background, boxes = [], area, onArea, disabled = false}: {
  size: PageSize; background?: string; boxes?: PlannedTextBox[]; area?: Rect;
  onArea?: (rect: Rect) => void; disabled?: boolean;
}) {
  const [containerWidth, setContainerWidth] = useState(400);
  const start = useRef<{x: number; y: number} | null>(null);
  const [drag, setDrag] = useState<Rect | null>(null);
  const width = Math.min(containerWidth, 480, 500 * size.width / size.height);
  const scale = width / size.width;
  const height = size.height * scale;
  function point(event: GestureResponderEvent) {
    return {x: Math.round(Math.max(0, Math.min(width, event.nativeEvent.locationX)) / scale),
      y: Math.round(Math.max(0, Math.min(height, event.nativeEvent.locationY)) / scale)};
  }
  function rectangle(event: GestureResponderEvent) {
    const end = point(event);
    const first = start.current ?? end;
    return {left: Math.min(first.x, end.x), top: Math.min(first.y, end.y),
      right: Math.max(first.x, end.x), bottom: Math.max(first.y, end.y)};
  }
  const selected = drag ?? area;
  return <View onLayout={event => setContainerWidth(event.nativeEvent.layout.width)} style={styles.container}>
    <View style={[styles.page, {width, height}]}
      onStartShouldSetResponder={() => !!onArea && !disabled}
      onMoveShouldSetResponder={() => !!onArea && !disabled}
      onResponderGrant={event => {start.current = point(event); setDrag(rectangle(event));}}
      onResponderMove={event => setDrag(rectangle(event))}
      onResponderRelease={event => {
        const rect = rectangle(event);
        setDrag(null); start.current = null;
        if (rect.right - rect.left >= size.width * 0.05 && rect.bottom - rect.top >= size.height * 0.03) {onArea?.(rect);}
      }}
      onResponderTerminate={() => {setDrag(null); start.current = null;}}>
      {background && <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Image source={{uri: background}} style={StyleSheet.absoluteFill} resizeMode="stretch" />
      </View>}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {boxes.map((box, index) => <View key={index} style={{position: 'absolute',
          left: box.rect.left * scale, top: box.rect.top * scale,
          width: (box.rect.right - box.rect.left) * scale, height: (box.rect.bottom - box.rect.top) * scale,
          borderWidth: 0.5, borderColor: '#aaa', padding: box.fontSize * 0.25 * scale}}>
          <Text allowFontScaling={false} style={{fontSize: box.fontSize * scale,
            color: '#000', fontWeight: box.bold ? 'bold' : 'normal', fontStyle: box.italic ? 'italic' : 'normal'}}>{box.text}</Text>
        </View>)}
        {selected && <View style={{position: 'absolute', left: selected.left * scale, top: selected.top * scale,
          width: (selected.right - selected.left) * scale, height: (selected.bottom - selected.top) * scale,
          borderWidth: 2, borderStyle: 'dashed', borderColor: '#000'}} />}
      </View>
    </View>
  </View>;
}
const styles = StyleSheet.create({container: {alignItems: 'center', width: '100%', paddingVertical: 12},
  page: {backgroundColor: '#fff', borderWidth: 1, borderColor: '#000'}});
