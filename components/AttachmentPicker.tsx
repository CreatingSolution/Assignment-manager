import React from 'react';
import {
  Alert,
  Image,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { COLORS } from '../constants';
import type { AttachmentItem } from '../types';
import { generateId } from '../utils/id.utils';

interface AttachmentPickerProps {
  attachments: AttachmentItem[];
  onChange?: (attachments: AttachmentItem[]) => void;
  editable?: boolean;
}

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  if (parts.length > 1) {
    return parts[parts.length - 1].toUpperCase();
  }
  return 'FILE';
}

export function AttachmentPicker({
  attachments,
  onChange,
  editable = true,
}: AttachmentPickerProps): React.JSX.Element {
  const handleTakeCamera = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Camera Permission Required',
          'Please allow camera access in device settings to take photos of assignments/documents.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const fileName =
          asset.fileName || `Photo_${new Date().toISOString().slice(0, 10)}_${Date.now().toString().slice(-4)}.jpg`;

        const newAttachment: AttachmentItem = {
          id: generateId(),
          name: fileName,
          uri: asset.uri,
          type: 'image',
          size: asset.fileSize,
          mimeType: asset.mimeType || 'image/jpeg',
        };

        onChange?.([...attachments, newAttachment]);
      }
    } catch (err) {
      Alert.alert('Camera Error', err instanceof Error ? err.message : 'Could not launch camera.');
    }
  };

  const handlePickGallery = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Photo Library Permission Required',
          'Please allow photo library access in device settings to pick assignment images.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newItems: AttachmentItem[] = result.assets.map((asset, idx) => ({
          id: generateId(),
          name:
            asset.fileName ||
            `Image_${new Date().toISOString().slice(0, 10)}_${(Date.now() + idx).toString().slice(-4)}.jpg`,
          uri: asset.uri,
          type: 'image',
          size: asset.fileSize,
          mimeType: asset.mimeType || 'image/jpeg',
        }));

        onChange?.([...attachments, ...newItems]);
      }
    } catch (err) {
      Alert.alert('Gallery Error', err instanceof Error ? err.message : 'Could not open image gallery.');
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/plain',
          '*/*',
        ],
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newItems: AttachmentItem[] = result.assets.map((doc) => ({
          id: generateId(),
          name: doc.name || 'Document',
          uri: doc.uri,
          type: 'document',
          size: doc.size,
          mimeType: doc.mimeType,
        }));

        onChange?.([...attachments, ...newItems]);
      }
    } catch (err) {
      Alert.alert('Document Picker Error', err instanceof Error ? err.message : 'Could not pick document.');
    }
  };

  const handleRemove = (id: string) => {
    onChange?.(attachments.filter((item) => item.id !== id));
  };

  const handleOpenAttachment = async (item: AttachmentItem) => {
    try {
      const supported = await Linking.canOpenURL(item.uri);
      if (supported) {
        await Linking.openURL(item.uri);
      } else {
        // Fallback for file uris
        await Linking.openURL(item.uri);
      }
    } catch {
      Alert.alert(
        'Attachment Preview',
        `File: ${item.name}\n${item.size ? `Size: ${formatFileSize(item.size)}\n` : ''}Path: ${item.uri}`
      );
    }
  };

  return (
    <View style={styles.container}>
      {editable && (
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleTakeCamera}
            activeOpacity={0.7}
          >
            <Text style={styles.actionButtonIcon}>📷</Text>
            <Text style={styles.actionButtonText}>Camera</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handlePickGallery}
            activeOpacity={0.7}
          >
            <Text style={styles.actionButtonIcon}>🖼️</Text>
            <Text style={styles.actionButtonText}>Gallery</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handlePickDocument}
            activeOpacity={0.7}
          >
            <Text style={styles.actionButtonIcon}>📄</Text>
            <Text style={styles.actionButtonText}>PDF / Doc</Text>
          </TouchableOpacity>
        </View>
      )}

      {attachments.length === 0 ? (
        !editable ? (
          <Text style={styles.emptyText}>No attachments attached.</Text>
        ) : null
      ) : (
        <View style={styles.listContainer}>
          {attachments.map((item) => {
            const ext = getFileExtension(item.name);
            const isImage = item.type === 'image';
            const sizeStr = formatFileSize(item.size);

            return (
              <TouchableOpacity
                key={item.id}
                style={styles.attachmentCard}
                onPress={() => handleOpenAttachment(item)}
                activeOpacity={0.8}
              >
                {isImage ? (
                  <Image source={{ uri: item.uri }} style={styles.thumbnail} resizeMode="cover" />
                ) : (
                  <View style={[styles.thumbnailPlaceholder, ext === 'PDF' && styles.pdfBadge]}>
                    <Text style={styles.badgeText}>{ext}</Text>
                  </View>
                )}

                <View style={styles.infoContainer}>
                  <Text style={styles.fileName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.fileMeta}>
                    {item.type === 'image' ? 'Image' : 'Document'}
                    {sizeStr ? ` • ${sizeStr}` : ''}
                  </Text>
                </View>

                {editable && (
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => handleRemove(item.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.removeBtnText}>✕</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  actionButtonIcon: {
    fontSize: 16,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.text.muted,
    fontStyle: 'italic',
    paddingVertical: 4,
  },
  listContainer: {
    gap: 8,
  },
  attachmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 8,
    gap: 10,
  },
  thumbnail: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  thumbnailPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfBadge: {
    backgroundColor: '#FEE2E2',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  infoContainer: {
    flex: 1,
  },
  fileName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  fileMeta: {
    fontSize: 11,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
});

