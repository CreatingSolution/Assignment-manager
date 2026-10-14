import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Linking,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { COLORS } from '../constants';
import type { AttachmentItem } from '../types';

interface AttachmentViewerModalProps {
  visible: boolean;
  item: AttachmentItem | null;
  onClose: () => void;
  onRemove?: (id: string) => void;
  canRemove?: boolean;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getExt(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toUpperCase() : 'FILE';
}

export async function downloadOrShareAttachment(item: AttachmentItem): Promise<void> {
  try {
    if (item.uri.startsWith('http://') || item.uri.startsWith('https://')) {
      const supported = await Linking.canOpenURL(item.uri);
      if (supported) {
        await Linking.openURL(item.uri);
        return;
      }
    }

    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert(
        'Sharing Not Available',
        `File Path: ${item.uri}\nPlease use a device with file sharing capabilities.`
      );
      return;
    }

    const isPdf = item.name.toLowerCase().endsWith('.pdf') || item.mimeType === 'application/pdf';
    await Sharing.shareAsync(item.uri, {
      mimeType: item.mimeType || (isPdf ? 'application/pdf' : undefined),
      dialogTitle: `Download / Save ${item.name}`,
      UTI: isPdf ? 'com.adobe.pdf' : undefined,
    });
  } catch (err) {
    Alert.alert('Download Error', err instanceof Error ? err.message : 'Could not download or share file.');
  }
}

export function AttachmentViewerModal({
  visible,
  item,
  onClose,
  onRemove,
  canRemove = false,
}: AttachmentViewerModalProps): React.JSX.Element | null {
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);

  if (!item) return null;

  const ext = getExt(item.name);
  const isImage = item.type === 'image';
  const isPdf = ext === 'PDF' || item.mimeType === 'application/pdf';
  const sizeStr = formatBytes(item.size);

  const handleDownload = async () => {
    setIsProcessing(true);
    try {
      await downloadOrShareAttachment(item);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrint = async () => {
    try {
      setIsProcessing(true);
      await Print.printAsync({
        uri: item.uri,
      });
    } catch (err) {
      Alert.alert('Print Error', err instanceof Error ? err.message : 'Could not print document.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenExternally = async () => {
    try {
      if (item.uri.startsWith('http://') || item.uri.startsWith('https://')) {
        await Linking.openURL(item.uri);
      } else {
        await handleDownload();
      }
    } catch {
      await handleDownload();
    }
  };

  const handleDelete = () => {
    Alert.alert('Remove Attachment', `Are you sure you want to remove "${item.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          onRemove?.(item.id);
          onClose();
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        {/* Top Navigation Bar */}
        <View style={styles.navBar}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.closeBtnText}>✕ Close</Text>
          </TouchableOpacity>

          <View style={styles.navTitleContainer}>
            <Text style={styles.navTitle} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.navSubtitle}>
              {ext} {sizeStr ? `• ${sizeStr}` : ''}
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleDownload}
            disabled={isProcessing}
            style={styles.navActionBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.navActionBtnText}>📥 Save</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Content Viewer */}
        <View style={styles.viewerContainer}>
          {isImage ? (
            <View style={styles.imageViewerWrapper}>
              {!imageLoaded && (
                <View style={styles.loaderCenter}>
                  <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
              )}
              <Image
                source={{ uri: item.uri }}
                style={styles.fullImage}
                resizeMode="contain"
                onLoadEnd={() => setImageLoaded(true)}
              />
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.documentViewerContent}>
              <View style={styles.documentHeroCard}>
                <View style={[styles.largeDocBadge, isPdf && styles.largePdfBadge]}>
                  <Text style={styles.largeDocBadgeText}>{ext}</Text>
                </View>

                <Text style={styles.docHeroName}>{item.name}</Text>
                <Text style={styles.docHeroMeta}>
                  {isPdf ? 'Portable Document Format (PDF)' : 'Attached Document'}
                  {sizeStr ? ` • ${sizeStr}` : ''}
                </Text>

                <View style={styles.docActionsCol}>
                  <TouchableOpacity
                    style={styles.primaryDownloadBtn}
                    onPress={handleDownload}
                    activeOpacity={0.8}
                    disabled={isProcessing}
                  >
                    <Text style={styles.primaryDownloadIcon}>📥</Text>
                    <View style={styles.primaryDownloadTexts}>
                      <Text style={styles.primaryDownloadTitle}>Download / Save File</Text>
                      <Text style={styles.primaryDownloadSub}>
                        Save to Downloads, Files app, or share via apps
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondaryOpenBtn}
                    onPress={handleOpenExternally}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.secondaryOpenText}>
                      {isPdf ? '📄 Open with System PDF Reader' : '📂 Open with External App'}
                    </Text>
                  </TouchableOpacity>

                  {isPdf && (
                    <TouchableOpacity
                      style={styles.printBtn}
                      onPress={handlePrint}
                      activeOpacity={0.8}
                      disabled={isProcessing}
                    >
                      <Text style={styles.printBtnText}>🖨️ Print Document</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* File details info section */}
              <View style={styles.infoSection}>
                <Text style={styles.infoSectionTitle}>File Information</Text>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Name</Text>
                  <Text style={styles.infoValue} numberOfLines={1}>
                    {item.name}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Type</Text>
                  <Text style={styles.infoValue}>{item.type.toUpperCase()} ({ext})</Text>
                </View>
                {sizeStr ? (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Size</Text>
                    <Text style={styles.infoValue}>{sizeStr}</Text>
                  </View>
                ) : null}
                {item.mimeType ? (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>MIME Type</Text>
                    <Text style={styles.infoValue}>{item.mimeType}</Text>
                  </View>
                ) : null}
              </View>
            </ScrollView>
          )}
        </View>

        {/* Bottom Toolbar */}
        <View style={styles.bottomToolbar}>
          <TouchableOpacity
            style={styles.toolbarBtn}
            onPress={handleDownload}
            disabled={isProcessing}
            activeOpacity={0.8}
          >
            <Text style={styles.toolbarBtnIcon}>📥</Text>
            <Text style={styles.toolbarBtnText}>Download / Save</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toolbarBtn}
            onPress={handleDownload}
            disabled={isProcessing}
            activeOpacity={0.8}
          >
            <Text style={styles.toolbarBtnIcon}>📤</Text>
            <Text style={styles.toolbarBtnText}>Share</Text>
          </TouchableOpacity>

          {canRemove && onRemove && (
            <TouchableOpacity
              style={[styles.toolbarBtn, styles.deleteToolbarBtn]}
              onPress={handleDelete}
              activeOpacity={0.8}
            >
              <Text style={styles.toolbarBtnIcon}>🗑️</Text>
              <Text style={[styles.toolbarBtnText, styles.deleteBtnText]}>Remove</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const screenHeight = Dimensions.get('window').height;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    backgroundColor: '#0F172A',
  },
  closeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
  },
  navTitleContainer: {
    flex: 1,
    marginHorizontal: 12,
    alignItems: 'center',
  },
  navTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
    textAlign: 'center',
  },
  navSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  navActionBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 64,
    alignItems: 'center',
  },
  navActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  viewerContainer: {
    flex: 1,
    backgroundColor: '#020617',
    position: 'relative',
  },
  imageViewerWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  loaderCenter: {
    position: 'absolute',
    zIndex: 2,
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  documentViewerContent: {
    padding: 20,
    gap: 20,
  },
  documentHeroCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    gap: 12,
  },
  largeDocBadge: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  largePdfBadge: {
    backgroundColor: '#EF4444',
  },
  largeDocBadgeText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  docHeroName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#F8FAFC',
    textAlign: 'center',
  },
  docHeroMeta: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
  },
  docActionsCol: {
    width: '100%',
    gap: 10,
    marginTop: 12,
  },
  primaryDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  primaryDownloadIcon: {
    fontSize: 24,
  },
  primaryDownloadTexts: {
    flex: 1,
  },
  primaryDownloadTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  primaryDownloadSub: {
    fontSize: 11,
    color: '#BFDBFE',
    marginTop: 2,
  },
  secondaryOpenBtn: {
    backgroundColor: '#334155',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryOpenText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  printBtn: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  printBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  infoSection: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  infoSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  infoLabel: {
    fontSize: 12,
    color: '#94A3B8',
  },
  infoValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F8FAFC',
    maxWidth: '70%',
    textAlign: 'right',
  },
  bottomToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  toolbarBtn: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  toolbarBtnIcon: {
    fontSize: 20,
  },
  toolbarBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  deleteToolbarBtn: {},
  deleteBtnText: {
    color: '#F87171',
  },
});

