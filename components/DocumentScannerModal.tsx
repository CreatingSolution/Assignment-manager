import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File } from 'expo-file-system';
import { COLORS } from '../constants';
import type { AttachmentItem } from '../types';
import { generateId } from '../utils/id.utils';

interface DocumentScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onAttach?: (attachment: AttachmentItem) => void;
}

interface ScannedPage {
  id: string;
  uri: string;
  base64?: string;
}

interface GeneratedPdfInfo {
  uri: string;
  size?: number;
  fileName: string;
  pageCount: number;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentScannerModal({
  visible,
  onClose,
  onAttach,
}: DocumentScannerModalProps): React.JSX.Element {
  const [pages, setPages] = useState<ScannedPage[]>([]);
  const [docName, setDocName] = useState<string>('Scanned_Document');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedPdf, setGeneratedPdf] = useState<GeneratedPdfInfo | null>(null);

  const handleReset = () => {
    setPages([]);
    setGeneratedPdf(null);
    setDocName('Scanned_Document');
    setIsGenerating(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleCapturePage = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Camera Permission Required',
          'Please allow camera access in device settings to scan document pages.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const newPage: ScannedPage = {
          id: generateId(),
          uri: asset.uri,
          base64: asset.base64 || undefined,
        };
        setPages((prev) => [...prev, newPage]);
        // Invalidate previously generated PDF since pages changed
        if (generatedPdf) setGeneratedPdf(null);
      }
    } catch (err) {
      Alert.alert('Scanner Error', err instanceof Error ? err.message : 'Could not launch camera.');
    }
  };

  const handlePickFromPhotos = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Photo Library Permission Required',
          'Please allow photo library access in device settings to select pages.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.85,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newPages: ScannedPage[] = result.assets.map((asset) => ({
          id: generateId(),
          uri: asset.uri,
          base64: asset.base64 || undefined,
        }));
        setPages((prev) => [...prev, ...newPages]);
        if (generatedPdf) setGeneratedPdf(null);
      }
    } catch (err) {
      Alert.alert('Gallery Error', err instanceof Error ? err.message : 'Could not pick photos.');
    }
  };

  const handleRemovePage = (id: string) => {
    setPages((prev) => prev.filter((p) => p.id !== id));
    if (generatedPdf) setGeneratedPdf(null);
  };

  const handleMovePage = (index: number, direction: 'up' | 'down') => {
    setPages((prev) => {
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
    if (generatedPdf) setGeneratedPdf(null);
  };

  const buildHtml = (pageList: ScannedPage[]) => {
    const pagesHtml = pageList
      .map((page, idx) => {
        const imageSrc = page.base64 ? `data:image/jpeg;base64,${page.base64}` : page.uri;
        const pageBreak = idx === pageList.length - 1 ? 'avoid' : 'always';
        return `
          <div class="page-container" style="page-break-after: ${pageBreak};">
            <img src="${imageSrc}" class="doc-page-img" alt="Page ${idx + 1}" />
          </div>
        `;
      })
      .join('');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <style>
            @page {
              size: A4 portrait;
              margin: 8mm;
            }
            * {
              box-sizing: border-box;
            }
            body {
              margin: 0;
              padding: 0;
              background-color: #ffffff;
            }
            .page-container {
              width: 100%;
              min-height: 95vh;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 4mm;
            }
            .doc-page-img {
              max-width: 100%;
              max-height: 100%;
              object-fit: contain;
              display: block;
              margin: auto;
              border-radius: 4px;
            }
          </style>
        </head>
        <body>
          ${pagesHtml}
        </body>
      </html>
    `;
  };

  const handleGeneratePdf = async () => {
    if (pages.length === 0) {
      Alert.alert('No Pages', 'Please scan or add at least one page before converting to PDF.');
      return;
    }

    setIsGenerating(true);
    try {
      const html = buildHtml(pages);
      const printResult = await Print.printToFileAsync({
        html,
      });

      let fileSize: number | undefined;
      try {
        const fileRef = new File(printResult.uri);
        fileSize = fileRef.size;
      } catch {
        fileSize = undefined;
      }

      const cleanDocName = (docName.trim() || 'Scanned_Document').replace(/\.pdf$/i, '');
      const finalFileName = `${cleanDocName}_${Date.now().toString().slice(-4)}.pdf`;

      setGeneratedPdf({
        uri: printResult.uri,
        size: fileSize,
        fileName: finalFileName,
        pageCount: pages.length,
      });

      Alert.alert(
        'PDF Generated Successfully! 📄',
        `Your document has been compiled into a high-quality PDF (${pages.length} page${
          pages.length > 1 ? 's' : ''
        }${fileSize ? `, ${formatBytes(fileSize)}` : ''}). You can now Download/Share or Attach it.`
      );
    } catch (err) {
      Alert.alert(
        'PDF Generation Failed',
        err instanceof Error ? err.message : 'Could not convert scanned pages to PDF.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadOrShare = async () => {
    if (!generatedPdf) return;
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert(
          'Sharing Unavailable',
          `Sharing is not supported on this platform. PDF file path:\n${generatedPdf.uri}`
        );
        return;
      }

      await Sharing.shareAsync(generatedPdf.uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Download or Share ${generatedPdf.fileName}`,
        UTI: 'com.adobe.pdf',
      });
    } catch (err) {
      Alert.alert('Share Error', err instanceof Error ? err.message : 'Could not share/download PDF.');
    }
  };

  const handleAttachToAssignment = () => {
    if (!generatedPdf) return;
    if (!onAttach) {
      Alert.alert('Info', 'No assignment attachment handler provided.');
      return;
    }

    const item: AttachmentItem = {
      id: generateId(),
      name: generatedPdf.fileName,
      uri: generatedPdf.uri,
      type: 'document',
      mimeType: 'application/pdf',
      size: generatedPdf.size,
    };

    onAttach(item);
    Alert.alert('Attached! 📎', `"${generatedPdf.fileName}" added to your assignment attachments.`);
    handleClose();
  };

  const handlePreviewPdf = async () => {
    if (!generatedPdf) return;
    try {
      const supported = await Linking.canOpenURL(generatedPdf.uri);
      if (supported) {
        await Linking.openURL(generatedPdf.uri);
      } else {
        await handleDownloadOrShare();
      }
    } catch {
      await handleDownloadOrShare();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardContainer}
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>📑 Document Scanner</Text>
              <Text style={styles.headerSubtitle}>Scan & Convert Pages to PDF</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            {/* Capture controls */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.cameraBtn]}
                onPress={handleCapturePage}
                activeOpacity={0.8}
              >
                <Text style={styles.actionBtnIcon}>📷</Text>
                <Text style={styles.actionBtnText}>Capture Page</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.galleryBtn]}
                onPress={handlePickFromPhotos}
                activeOpacity={0.8}
              >
                <Text style={styles.actionBtnIcon}>🖼️</Text>
                <Text style={styles.actionBtnText}>Add from Photos</Text>
              </TouchableOpacity>
            </View>

            {/* Document metadata input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Document Name</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.textInput}
                  value={docName}
                  onChangeText={(text) => {
                    setDocName(text);
                    if (generatedPdf) setGeneratedPdf(null);
                  }}
                  placeholder="e.g. Math_Assignment_1"
                  placeholderTextColor={COLORS.text.muted}
                  autoCapitalize="words"
                />
                <Text style={styles.inputExtBadge}>.pdf</Text>
              </View>
            </View>

            {/* Scanned Pages Section */}
            <View style={styles.pagesSectionHeader}>
              <Text style={styles.sectionTitle}>
                Scanned Pages ({pages.length})
              </Text>
              {pages.length > 0 && (
                <TouchableOpacity onPress={() => setPages([])} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.clearAllText}>Clear All</Text>
                </TouchableOpacity>
              )}
            </View>

            {pages.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>📄</Text>
                <Text style={styles.emptyTitle}>No pages scanned yet</Text>
                <Text style={styles.emptySubtitle}>
                  Tap "Capture Page" to snap document pages with your camera, or "Add from Photos" to select page images.
                </Text>
              </View>
            ) : (
              <View style={styles.pagesList}>
                {pages.map((page, index) => (
                  <View key={page.id} style={styles.pageCard}>
                    <Image source={{ uri: page.uri }} style={styles.pageThumbnail} resizeMode="cover" />

                    <View style={styles.pageInfo}>
                      <Text style={styles.pageNumberText}>Page {index + 1}</Text>
                      <Text style={styles.pageSubText}>
                        {index === 0 && pages.length > 1
                          ? 'First Page (Cover)'
                          : index === pages.length - 1 && pages.length > 1
                          ? 'Final Page'
                          : `Page ${index + 1} of ${pages.length}`}
                      </Text>
                    </View>

                    {/* Ordering and remove controls */}
                    <View style={styles.pageControls}>
                      <TouchableOpacity
                        style={[styles.orderBtn, index === 0 && styles.disabledBtn]}
                        disabled={index === 0}
                        onPress={() => handleMovePage(index, 'up')}
                      >
                        <Text style={styles.orderBtnText}>⬆️</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.orderBtn, index === pages.length - 1 && styles.disabledBtn]}
                        disabled={index === pages.length - 1}
                        onPress={() => handleMovePage(index, 'down')}
                      >
                        <Text style={styles.orderBtnText}>⬇️</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => handleRemovePage(page.id)}
                      >
                        <Text style={styles.deleteBtnText}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Generate PDF CTA */}
            {pages.length > 0 && (
              <TouchableOpacity
                style={[styles.generateBtn, isGenerating && styles.disabledGenerateBtn]}
                onPress={handleGeneratePdf}
                disabled={isGenerating}
                activeOpacity={0.8}
              >
                {isGenerating ? (
                  <View style={styles.generatingRow}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.generateBtnText}>Compiling PDF document...</Text>
                  </View>
                ) : (
                  <Text style={styles.generateBtnText}>
                    {generatedPdf ? '⚡ Re-generate PDF' : '⚡ Convert to PDF'}
                  </Text>
                )}
              </TouchableOpacity>
            )}

            {/* Generated PDF Card with Actions */}
            {generatedPdf && (
              <View style={styles.pdfResultCard}>
                <View style={styles.pdfResultHeader}>
                  <Text style={styles.pdfResultBadge}>PDF READY</Text>
                  <Text style={styles.pdfResultTitle} numberOfLines={1}>
                    {generatedPdf.fileName}
                  </Text>
                  <Text style={styles.pdfResultMeta}>
                    {generatedPdf.pageCount} page{generatedPdf.pageCount > 1 ? 's' : ''}
                    {generatedPdf.size ? ` • ${formatBytes(generatedPdf.size)}` : ''}
                  </Text>
                </View>

                <View style={styles.resultActionsCol}>
                  {/* Download / Share action */}
                  <TouchableOpacity
                    style={styles.downloadBtn}
                    onPress={handleDownloadOrShare}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.downloadBtnIcon}>📥</Text>
                    <View style={styles.downloadBtnTexts}>
                      <Text style={styles.downloadBtnTitle}>Download / Share PDF</Text>
                      <Text style={styles.downloadBtnSub}>Save to Files, Google Drive, WhatsApp, or Print</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Attach to assignment action */}
                  {onAttach && (
                    <TouchableOpacity
                      style={styles.attachBtn}
                      onPress={handleAttachToAssignment}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.attachBtnIcon}>📎</Text>
                      <View style={styles.attachBtnTexts}>
                        <Text style={styles.attachBtnTitle}>Attach to Assignment</Text>
                        <Text style={styles.attachBtnSub}>Directly save to this assignment's attachments</Text>
                      </View>
                    </TouchableOpacity>
                  )}

                  {/* Preview action */}
                  <TouchableOpacity
                    style={styles.previewBtn}
                    onPress={handlePreviewPdf}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.previewBtnText}>👁️ Preview Document</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  keyboardContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748B',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    gap: 8,
  },
  cameraBtn: {
    backgroundColor: '#2563EB',
  },
  galleryBtn: {
    backgroundColor: '#059669',
  },
  actionBtnIcon: {
    fontSize: 18,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text.primary,
    paddingVertical: 10,
  },
  inputExtBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    paddingLeft: 6,
  },
  pagesSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  clearAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EF4444',
  },
  emptyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    color: COLORS.text.secondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  pagesList: {
    gap: 10,
  },
  pageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    gap: 12,
  },
  pageThumbnail: {
    width: 52,
    height: 70,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  pageInfo: {
    flex: 1,
  },
  pageNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  pageSubText: {
    fontSize: 11,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  pageControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  orderBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledBtn: {
    opacity: 0.35,
  },
  orderBtnText: {
    fontSize: 13,
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: {
    fontSize: 13,
  },
  generateBtn: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  disabledGenerateBtn: {
    backgroundColor: '#64748B',
  },
  generateBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  generatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pdfResultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#93C5FD',
    padding: 16,
    gap: 14,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  pdfResultHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 10,
  },
  pdfResultBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#DBEAFE',
    color: '#1D4ED8',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
  },
  pdfResultTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  pdfResultMeta: {
    fontSize: 12,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  resultActionsCol: {
    gap: 10,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284C7',
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  downloadBtnIcon: {
    fontSize: 22,
  },
  downloadBtnTexts: {
    flex: 1,
  },
  downloadBtnTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  downloadBtnSub: {
    fontSize: 11,
    color: '#E0F2FE',
    marginTop: 1,
  },
  attachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  attachBtnIcon: {
    fontSize: 22,
  },
  attachBtnTexts: {
    flex: 1,
  },
  attachBtnTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  attachBtnSub: {
    fontSize: 11,
    color: '#D1FAE5',
    marginTop: 1,
  },
  previewBtn: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  previewBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
});

