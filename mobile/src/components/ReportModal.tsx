import React, {useState, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import {useTheme} from '../contexts/ThemeContext';
import {getAtProtoClient} from '../services/atproto/client';
import {recordReport} from '../services/moderation-history';

export type ReportType = 'post' | 'account';

export interface ReportCategory {
  id: string;
  label: string;
  description: string;
  reasonType: string;
}

const REPORT_CATEGORIES: ReportCategory[] = [
  {
    id: 'spam',
    label: 'Spam',
    description: 'Unwanted commercial content or repetitive posts',
    reasonType: 'com.atproto.moderation.defs#reasonSpam',
  },
  {
    id: 'harassment',
    label: 'Harassment & Abuse',
    description: 'Targeted abuse, bullying, or threats',
    reasonType: 'com.atproto.moderation.defs#reasonViolation',
  },
  {
    id: 'hate',
    label: 'Hate Speech',
    description: 'Content promoting hatred based on identity',
    reasonType: 'com.atproto.moderation.defs#reasonViolation',
  },
  {
    id: 'violence',
    label: 'Violence or Harm',
    description: 'Graphic violence, self-harm, or dangerous content',
    reasonType: 'com.atproto.moderation.defs#reasonViolation',
  },
  {
    id: 'sexual',
    label: 'Sexual Content',
    description: 'Unwanted sexual content or exploitation',
    reasonType: 'com.atproto.moderation.defs#reasonViolation',
  },
  {
    id: 'impersonation',
    label: 'Impersonation',
    description: 'Pretending to be someone else',
    reasonType: 'com.atproto.moderation.defs#reasonMisleading',
  },
  {
    id: 'misleading',
    label: 'Misleading Information',
    description: 'False information or deceptive content',
    reasonType: 'com.atproto.moderation.defs#reasonMisleading',
  },
  {
    id: 'other',
    label: 'Other',
    description: 'Other violations of community guidelines',
    reasonType: 'com.atproto.moderation.defs#reasonOther',
  },
];

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  reportType: ReportType;
  subjectUri: string;
  subjectCid?: string;
  subjectDid?: string;
  subjectHandle?: string;
  subjectDisplayName?: string;
  subjectText?: string;
  onReportSubmitted?: () => void;
  onBlock?: (did: string) => void;
  onMute?: (did: string) => void;
}

export function ReportModal({
  visible,
  onClose,
  reportType,
  subjectUri,
  subjectCid,
  subjectDid,
  subjectHandle,
  subjectDisplayName: _subjectDisplayName,
  subjectText: _subjectText,
  onReportSubmitted,
  onBlock,
  onMute,
}: ReportModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [additionalContext, setAdditionalContext] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!selectedCategory) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const client = getAtProtoClient();
      const agent = client.getAgent();

      const category = REPORT_CATEGORIES.find((c) => c.id === selectedCategory);
      if (!category) throw new Error('Invalid category selected');

      const reasonText = additionalContext.trim()
        ? `${category.label}: ${additionalContext.trim()}`
        : category.label;

      if (reportType === 'post') {
        if (!subjectCid) {
          throw new Error('Post CID is required for reporting posts');
        }

        await agent.com.atproto.moderation.createReport({
          reasonType: category.reasonType,
          subject: {
            $type: 'com.atproto.repo.strongRef',
            uri: subjectUri,
            cid: subjectCid,
          },
          reason: reasonText,
        });
      } else {
        if (!subjectDid) {
          throw new Error('User DID is required for reporting accounts');
        }

        await agent.com.atproto.moderation.createReport({
          reasonType: category.reasonType,
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: subjectDid,
          },
          reason: reasonText,
        });
      }

      recordReport({
        subjectUri: subjectUri,
        subjectType: reportType,
        subjectDid: subjectDid,
        subjectHandle: subjectHandle,
        reason: category.label,
        reasonText: additionalContext.trim() || undefined,
      });

      setIsSubmitted(true);

      if (onReportSubmitted) {
        onReportSubmitted();
      }
    } catch (err) {
      console.error('Failed to submit report:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to submit report. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedCategory(null);
    setAdditionalContext('');
    setIsSubmitting(false);
    setIsSubmitted(false);
    setError(null);
    onClose();
  };

  const handleBlockAfterReport = () => {
    if (subjectDid && onBlock) {
      onBlock(subjectDid);
    }
    handleClose();
  };

  const handleMuteAfterReport = () => {
    if (subjectDid && onMute) {
      onMute(subjectDid);
    }
    handleClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={styles.container}>
          {isSubmitted ? (
            <>
              {/* Success State */}
              <View style={styles.header}>
                <Text style={styles.headerTitle}>Report Submitted</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={handleClose}>
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.content} keyboardDismissMode="on-drag">
                <Text style={styles.successText}>
                  Thank you for helping keep our community safe. We'll review
                  this report and take appropriate action.
                </Text>

                {/* Block/Mute Options */}
                {reportType === 'account' && subjectHandle && (
                  <View style={styles.postReportActions}>
                    <Text style={styles.postReportTitle}>
                      Additional Actions
                    </Text>
                    <Text style={styles.postReportDescription}>
                      You can also block or mute @{subjectHandle} to control
                      your experience.
                    </Text>

                    <TouchableOpacity
                      style={[styles.actionButton, styles.blockButton]}
                      onPress={handleBlockAfterReport}>
                      <Text style={styles.actionButtonText}>
                        Block @{subjectHandle}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionButton, styles.muteButton]}
                      onPress={handleMuteAfterReport}>
                      <Text style={styles.actionButtonText}>
                        Mute @{subjectHandle}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>

              <View style={styles.footer}>
                <TouchableOpacity
                  style={[styles.button, styles.primaryButton]}
                  onPress={handleClose}>
                  <Text style={styles.primaryButtonText}>Close</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              {/* Report Form */}
              <View style={styles.header}>
                <Text style={styles.headerTitle}>
                  Report {reportType === 'post' ? 'Post' : 'Account'}
                </Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={handleClose}>
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.content} keyboardDismissMode="on-drag">
                <Text style={styles.description}>
                  {reportType === 'post'
                    ? "Help us understand what's wrong with this post"
                    : `Report @${subjectHandle || 'this account'} for violating community guidelines`}
                </Text>

                {/* Category Selection */}
                <View style={styles.categoriesContainer}>
                  {REPORT_CATEGORIES.map((category) => (
                    <TouchableOpacity
                      key={category.id}
                      style={[
                        styles.categoryItem,
                        selectedCategory === category.id &&
                          styles.categoryItemSelected,
                      ]}
                      onPress={() => setSelectedCategory(category.id)}>
                      <View
                        style={[
                          styles.radioButton,
                          selectedCategory === category.id &&
                            styles.radioButtonSelected,
                        ]}>
                        {selectedCategory === category.id && (
                          <View style={styles.radioButtonInner} />
                        )}
                      </View>
                      <View style={styles.categoryContent}>
                        <Text style={styles.categoryLabel}>
                          {category.label}
                        </Text>
                        <Text style={styles.categoryDescription}>
                          {category.description}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Additional Context */}
                {selectedCategory && (
                  <View style={styles.contextContainer}>
                    <Text style={styles.contextLabel}>
                      Additional context (optional)
                    </Text>
                    <TextInput
                      style={styles.textInput}
                      value={additionalContext}
                      onChangeText={setAdditionalContext}
                      placeholder="Provide any additional details..."
                      placeholderTextColor="#999"
                      multiline
                      numberOfLines={4}
                      maxLength={300}
                      textAlignVertical="top"
                    />
                    <Text style={styles.charCount}>
                      {additionalContext.length}/300
                    </Text>
                  </View>
                )}

                {/* Error Message */}
                {error && (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}
              </ScrollView>

              <View style={styles.footer}>
                <TouchableOpacity
                  style={[styles.button, styles.secondaryButton]}
                  onPress={handleClose}
                  disabled={isSubmitting}>
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.dangerButton,
                    (!selectedCategory || isSubmitting) &&
                      styles.buttonDisabled,
                  ]}
                  onPress={handleSubmit}
                  disabled={!selectedCategory || isSubmitting}>
                  {isSubmitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.dangerButtonText}>Submit Report</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    container: {
      backgroundColor: '#fff',
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      maxHeight: '90%',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: '#e0e0e0',
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: '#000',
    },
    closeButton: {
      padding: 8,
    },
    closeButtonText: {
      fontSize: 24,
      color: '#666',
    },
    content: {
      padding: 16,
    },
    description: {
      fontSize: 14,
      color: '#666',
      marginBottom: 16,
    },
    successText: {
      fontSize: 14,
      color: '#666',
      marginBottom: 16,
    },
    categoriesContainer: {
      marginBottom: 16,
    },
    categoryItem: {
      flexDirection: 'row',
      padding: 12,
      borderWidth: 1,
      borderColor: '#e0e0e0',
      borderRadius: 8,
      marginBottom: 8,
    },
    categoryItemSelected: {
      backgroundColor: '#e3f2fd',
      borderColor: colors.primary,
    },
    radioButton: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: '#ccc',
      marginRight: 12,
      marginTop: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioButtonSelected: {
      borderColor: colors.primary,
    },
    radioButtonInner: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.primary,
    },
    categoryContent: {
      flex: 1,
    },
    categoryLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: '#000',
      marginBottom: 4,
    },
    categoryDescription: {
      fontSize: 13,
      color: '#666',
    },
    contextContainer: {
      marginTop: 8,
    },
    contextLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: '#000',
      marginBottom: 8,
    },
    textInput: {
      borderWidth: 1,
      borderColor: '#e0e0e0',
      borderRadius: 8,
      padding: 12,
      fontSize: 14,
      color: '#000',
      minHeight: 100,
    },
    charCount: {
      fontSize: 12,
      color: '#999',
      textAlign: 'right',
      marginTop: 4,
    },
    errorContainer: {
      backgroundColor: '#fee',
      padding: 12,
      borderRadius: 8,
      marginTop: 16,
    },
    errorText: {
      color: '#c00',
      fontSize: 14,
    },
    postReportActions: {
      marginTop: 8,
      padding: 16,
      backgroundColor: '#f5f5f5',
      borderRadius: 8,
    },
    postReportTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: '#000',
      marginBottom: 8,
    },
    postReportDescription: {
      fontSize: 13,
      color: '#666',
      marginBottom: 12,
    },
    actionButton: {
      padding: 12,
      borderRadius: 8,
      marginBottom: 8,
      alignItems: 'center',
    },
    blockButton: {
      backgroundColor: '#dc3545',
    },
    muteButton: {
      backgroundColor: '#6c757d',
    },
    actionButtonText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '600',
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 8,
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: '#e0e0e0',
    },
    button: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 8,
      minWidth: 100,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryButton: {
      backgroundColor: '#f0f0f0',
    },
    secondaryButtonText: {
      color: '#333',
      fontSize: 14,
      fontWeight: '600',
    },
    primaryButton: {
      backgroundColor: colors.primary,
    },
    primaryButtonText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '600',
    },
    dangerButton: {
      backgroundColor: '#dc3545',
    },
    dangerButtonText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '600',
    },
    buttonDisabled: {
      opacity: 0.5,
    },
  });
}
