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
import { getAssignmentRepository, getGroupRepository } from '../database';

interface DocumentScannerModalProps {
  visible: boolean;
  onClose: () => void;
  userId?: string;
  onAttach?: (attachment: AttachmentItem) => void;
  onAttached?: (assignmentTitle: string, isGroup: boolean) => void;
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

interface TargetAssignmentOption {
  id: string;
  title: string;
  isGroup: boolean;
  deadline?: string;
  courseOrCode?: string;
  existingAttachmentsCount: number;
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
  userId,
  onAttach,
  onAttached,
}: DocumentScannerModalProps): React.JSX.Element {
  const [pages, setPages] = useState<ScannedPage[]>([]);
  const [docName, setDocName] = useState<string>('Scanned_Document');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedPdf, setGeneratedPdf] = useState<GeneratedPdfInfo | null>(null);

  // Assignment selection modal state for "Attach to Assignment"
  const [selectorVisible, setSelectorVisible] = useState<boolean>(false);
  const [assignmentOptions, setAssignmentOptions] = useState<TargetAssignmentOption[]>([]);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);

  const handleReset = () => {
    setPages([]);
    setGeneratedPdf(null);
    setDocName('Scanned_Document');
    setIsGenerating(false);
    setSelectorVisible(false);
    setSelectedOptionId(null);
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
        }${fileSize ? `, ${formatBytes(fileSize)}` : ''}). You can now Download/Share or Attach it to an Assignment.`
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

  // Open the Assignment Selection dialog
  const handleOpenAssignmentSelector = () => {
    if (!generatedPdf) {
      Alert.alert('Generate PDF First', 'Please convert your scanned pages to PDF before attaching.');
      return;
    }

    const options: TargetAssignmentOption[] = [];

    if (userId) {
      const assignmentRepo = getAssignmentRepository();
      const groupRepo = getGroupRepository();

      // 1. Individual assignments
      try {
        const personalAssignments = assignmentRepo.findAll(userId).filter((a) => !a.isDeleted);
        personalAssignments.forEach((a) => {
          options.push({
            id: a.id,
            title: a.title,
            isGroup: false,
            deadline: a.deadline,
            existingAttachmentsCount: a.attachments?.length || 0,
          });
        });
      } catch {
        // Continue
      }

      // 2. Group assignments
      try {
        const userGroups = groupRepo.findAllForUser(userId);
        userGroups.forEach((g) => {
          options.push({
            id: g.id,
            title: g.name,
            isGroup: true,
            deadline: g.deadline,
            existingAttachmentsCount: g.attachments?.length || 0,
          });
        });
      } catch {
        // Continue
      }
    }

    if (options.length === 0) {
      Alert.alert(
        'No Assignments Found',
        'You have no active individual or group assignments to attach this document to. Please create an assignment first.'
      );
      return;
    }

    setAssignmentOptions(options);
    setSelectedOptionId(options[0]?.id || null);
    setSelectorVisible(true);
  };

  // Confirm and attach PDF to selected assignment
  const handleConfirmAttach = () => {
    if (!generatedPdf || !selectedOptionId) {
      Alert.alert('Selection Required', 'Please select an assignment using the radio button.');
      return;
    }

    const target = assignmentOptions.find((o) => o.id === selectedOptionId);
    if (!target) {
      Alert.alert('Error', 'Selected assignment not found.');
      return;
    }

    const newAttachment: AttachmentItem = {
      id: generateId(),
      name: generatedPdf.fileName,
      uri: generatedPdf.uri,
      type: 'document',
      mimeType: 'application/pdf',
      size: generatedPdf.size,
    };

    try {
      if (target.isGroup) {
        const groupRepo = getGroupRepository();
        const currentGroup = groupRepo.findById(target.id);
        const updatedList = [...(currentGroup?.attachments || []), newAttachment];
        groupRepo.update(target.id, { attachments: updatedList });
      } else {
        const assignmentRepo = getAssignmentRepository();
        const currentAssignment = assignmentRepo.findById(target.id);
        const updatedList = [...(currentAssignment?.attachments || []), newAttachment];
        assignmentRepo.update(target.id, { attachments: updatedList });
      }

      onAttach?.(newAttachment);
      onAttached?.(target.title, target.isGroup);

      Alert.alert(
        'Attached Successfully! 📎',
        `"${generatedPdf.fileName}" has been attached to ${
          target.isGroup ? 'Group Workspace' : 'Assignment'
        } "${target.title}".`
      );

      setSelectorVisible(false);
      handleClose();
    } catch (err) {
      Alert.alert(
        'Attachment Error',
        err instanceof Error ? err.message : 'Could not attach PDF to the selected assignment.'
      );
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
              <Text style={styles.headerTitle}>📑 Scan to PDF</Text>
              <Text style={styles.headerSubtitle}>
                {pages.length === 0
                  ? 'Capture single or multi-page documents'
                  : `${pages.length} page${pages.length === 1 ? '' : 's'} ready for PDF conversion`}
              </Text>
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
                  placeholder="e.g. Distributed_Systems_Assignment"
                  placeholderTextColor={COLORS.text.muted}
                  autoCapitalize="words"
                />
                <Text style={styles.inputExtBadge}>.pdf</Text>
              </View>
            </View>

            {/* Scanned Pages Section */}
            <View style={styles.pagesSectionHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.sectionTitle}>
                  Scanned Pages ({pages.length})
                </Text>
                {pages.length > 0 && (
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>
                      {pages.length === 1 ? '1 Page' : `${pages.length} Pages`}
                    </Text>
                  </View>
                )}
              </View>
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
                  Tap "Capture Page" to snap document pages with your camera, or "Add from Photos" to select page images. Supports single or multi-page documents.
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
                        {pages.length === 1
                          ? 'Single Page Document'
                          : index === 0
                          ? 'Page 1 (Cover)'
                          : index === pages.length - 1
                          ? `Page ${index + 1} (Final Page)`
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

            {/* Action: Generate PDF */}
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
                    <Text style={styles.generateBtnText}>Compiling PDF...</Text>
                  </View>
                ) : (
                  <Text style={styles.generateBtnText}>
                    {generatedPdf
                      ? `⚡ Re-generate PDF (${pages.length} page${pages.length > 1 ? 's' : ''})`
                      : `⚡ Convert to PDF (${pages.length} page${pages.length > 1 ? 's' : ''})`}
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
                  <TouchableOpacity
                    style={styles.attachBtn}
                    onPress={handleOpenAssignmentSelector}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.attachBtnIcon}>📎</Text>
                    <View style={styles.attachBtnTexts}>
                      <Text style={styles.attachBtnTitle}>Attach to Assignment</Text>
                      <Text style={styles.attachBtnSub}>Select from your individual or group assignments</Text>
                    </View>
                  </TouchableOpacity>

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

        {/* ─── Assignment Selection Dialog Modal with Radio Buttons ─────────── */}
        <Modal
          visible={selectorVisible}
          animationType="fade"
          transparent
          onRequestClose={() => setSelectorVisible(false)}
        >
          <View style={styles.selectorBackdrop}>
            <View style={styles.selectorContainer}>
              <View style={styles.selectorHeader}>
                <Text style={styles.selectorTitle}>📎 Select Assignment</Text>
                <Text style={styles.selectorSubtitle}>
                  Choose which assignment to attach "{generatedPdf?.fileName}":
                </Text>
              </View>

              <ScrollView style={styles.selectorList} contentContainerStyle={{ gap: 8 }}>
                {assignmentOptions.map((opt) => {
                  const isSelected = selectedOptionId === opt.id;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={[styles.assignmentOptionCard, isSelected && styles.assignmentOptionSelected]}
                      activeOpacity={0.8}
                      onPress={() => setSelectedOptionId(opt.id)}
                    >
                      {/* Radio button */}
                      <View style={[styles.radioButton, isSelected && styles.radioButtonSelected]}>
                        {isSelected && <View style={styles.radioButtonInner} />}
                      </View>

                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <View
                            style={[
                              styles.typeBadge,
                              opt.isGroup ? styles.groupTypeBadge : styles.personalTypeBadge,
                            ]}
                          >
                            <Text
                              style={[
                                styles.typeBadgeText,
                                opt.isGroup ? styles.groupTypeBadgeText : styles.personalTypeBadgeText,
                              ]}
                            >
                              {opt.isGroup ? '👥 Group' : '👤 Personal'}
                            </Text>
                          </View>
                          {opt.deadline && (
                            <Text style={styles.optionDeadlineText}>
                              📅 {opt.deadline.slice(0, 10)}
                            </Text>
                          )}
                        </View>

                        <Text style={styles.optionTitle} numberOfLines={1}>
                          {opt.title}
                        </Text>

                        {opt.existingAttachmentsCount > 0 && (
                          <Text style={styles.optionAttachmentsText}>
                            📎 {opt.existingAttachmentsCount} existing attachment{opt.existingAttachmentsCount > 1 ? 's' : ''}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={styles.selectorActions}>
                <TouchableOpacity
                  style={styles.selectorCancelBtn}
                  onPress={() => setSelectorVisible(false)}
                >
                  <Text style={styles.selectorCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.selectorOkBtn,
                    !selectedOptionId && styles.disabledSelectorOkBtn,
                  ]}
                  onPress={handleConfirmAttach}
                  disabled={!selectedOptionId}
                >
                  <Text style={styles.selectorOkText}>OK / Attach PDF</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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
  countBadge: {
    backgroundColor: '#E0E7FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3730A3',
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

  // Assignment Selector Modal Styles
  selectorBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  selectorContainer: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  selectorHeader: {
    marginBottom: 14,
  },
  selectorTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  selectorSubtitle: {
    fontSize: 13,
    color: COLORS.text.secondary,
    marginTop: 4,
  },
  selectorList: {
    maxHeight: 280,
    marginBottom: 14,
  },
  assignmentOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    gap: 12,
  },
  assignmentOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#EFF6FF',
  },
  radioButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonSelected: {
    borderColor: COLORS.primary,
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  personalTypeBadge: {
    backgroundColor: '#DBEAFE',
  },
  personalTypeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1E40AF',
  },
  groupTypeBadge: {
    backgroundColor: '#EDE9FE',
  },
  groupTypeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6D28D9',
  },
  optionDeadlineText: {
    fontSize: 11,
    color: COLORS.text.secondary,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  optionAttachmentsText: {
    fontSize: 11,
    color: COLORS.text.muted,
    marginTop: 2,
  },
  selectorActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  selectorCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  selectorCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  selectorOkBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  disabledSelectorOkBtn: {
    backgroundColor: '#94A3B8',
  },
  selectorOkText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
