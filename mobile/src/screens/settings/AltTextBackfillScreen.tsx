import { formatDistanceToNow } from "date-fns";
import { Image } from "expo-image";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { generateAltTextFromUrl } from "../../services/ai-service";
import {
  fetchPostsWithMissingAltText,
  updatePostAltText,
} from "../../services/atproto/post-editor";
import { createLogger } from "../../utils/logger";

const logger = createLogger("AltTextBackfill");

interface BackfillImage {
  postUri: string;
  postCid: string;
  postText: string;
  imageIndex: number;
  thumb: string;
  fullsize: string;
  createdAt: string;
  altText: string;
  status:
    | "pending"
    | "generating"
    | "ready"
    | "saving"
    | "saved"
    | "skipped"
    | "error";
  error?: string;
}

export function AltTextBackfillScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [images, setImages] = useState<BackfillImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [isBatchSaving, setIsBatchSaving] = useState(false);

  const loadPosts = useCallback(async (loadCursor?: string) => {
    try {
      setIsLoading(true);
      const result = await fetchPostsWithMissingAltText(loadCursor);

      const newImages: BackfillImage[] = [];
      for (const post of result.posts) {
        for (const img of post.images) {
          newImages.push({
            postUri: post.uri,
            postCid: post.cid,
            postText: post.text,
            imageIndex: img.index,
            thumb: img.thumb,
            fullsize: img.fullsize,
            createdAt: post.createdAt,
            altText: "",
            status: "pending",
          });
        }
      }

      if (loadCursor) {
        setImages((prev) => [...prev, ...newImages]);
      } else {
        setImages(newImages);
      }

      setCursor(result.cursor);
      setHasMore(!!result.cursor);
    } catch (error: any) {
      logger.error("Failed to load posts:", error);
      Alert.alert("Error", "Failed to load posts. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const handleLoadMore = useCallback(() => {
    if (!isLoading && hasMore && cursor) {
      loadPosts(cursor);
    }
  }, [isLoading, hasMore, cursor, loadPosts]);

  const handleGenerateOne = useCallback(
    async (index: number) => {
      setImages((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], status: "generating" };
        return next;
      });

      try {
        const altText = await generateAltTextFromUrl(images[index].fullsize);
        setImages((prev) => {
          const next = [...prev];
          next[index] = { ...next[index], altText, status: "ready" };
          return next;
        });
      } catch (error: any) {
        setImages((prev) => {
          const next = [...prev];
          next[index] = {
            ...next[index],
            status: "error",
            error: error.message,
          };
          return next;
        });
      }
    },
    [images],
  );

  const handleGenerateAll = useCallback(async () => {
    setIsBatchGenerating(true);
    const pendingIndices = images
      .map((img, i) => ({ img, i }))
      .filter(({ img }) => img.status === "pending")
      .map(({ i }) => i);

    for (const idx of pendingIndices) {
      setImages((prev) => {
        const next = [...prev];
        next[idx] = { ...next[idx], status: "generating" };
        return next;
      });

      try {
        const altText = await generateAltTextFromUrl(images[idx].fullsize);
        setImages((prev) => {
          const next = [...prev];
          next[idx] = { ...next[idx], altText, status: "ready" };
          return next;
        });
      } catch (error: any) {
        setImages((prev) => {
          const next = [...prev];
          next[idx] = { ...next[idx], status: "error", error: error.message };
          return next;
        });
      }
    }
    setIsBatchGenerating(false);
  }, [images]);

  const handleSkip = useCallback((index: number) => {
    setImages((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], status: "skipped" };
      return next;
    });
  }, []);

  const handleUpdateAltText = useCallback((index: number, text: string) => {
    setImages((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        altText: text,
        status: text.trim() ? "ready" : "pending",
      };
      return next;
    });
  }, []);

  const handleSaveOne = useCallback(
    async (index: number) => {
      const img = images[index];
      if (!img.altText.trim()) return;

      setImages((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], status: "saving" };
        return next;
      });

      try {
        await updatePostAltText(img.postUri, {
          [img.imageIndex]: img.altText.trim(),
        });
        setImages((prev) => {
          const next = [...prev];
          next[index] = { ...next[index], status: "saved" };
          return next;
        });
      } catch (error: any) {
        setImages((prev) => {
          const next = [...prev];
          next[index] = {
            ...next[index],
            status: "error",
            error: error.message,
          };
          return next;
        });
      }
    },
    [images],
  );

  const handleSaveAll = useCallback(async () => {
    const readyIndices = images
      .map((img, i) => ({ img, i }))
      .filter(({ img }) => img.status === "ready" && img.altText.trim())
      .map(({ i }) => i);

    if (readyIndices.length === 0) {
      Alert.alert("Nothing to Save", "Generate alt text first before saving.");
      return;
    }

    setIsBatchSaving(true);

    // Group by postUri for batch putRecord calls
    const byPost = new Map<
      string,
      { index: number; imageIndex: number; altText: string }[]
    >();
    for (const idx of readyIndices) {
      const img = images[idx];
      const existing = byPost.get(img.postUri) || [];
      existing.push({
        index: idx,
        imageIndex: img.imageIndex,
        altText: img.altText.trim(),
      });
      byPost.set(img.postUri, existing);
    }

    for (const [postUri, updates] of byPost) {
      // Mark all as saving
      setImages((prev) => {
        const next = [...prev];
        for (const u of updates) {
          next[u.index] = { ...next[u.index], status: "saving" };
        }
        return next;
      });

      try {
        const altTextMap: Record<number, string> = {};
        for (const u of updates) {
          altTextMap[u.imageIndex] = u.altText;
        }
        await updatePostAltText(postUri, altTextMap);

        setImages((prev) => {
          const next = [...prev];
          for (const u of updates) {
            next[u.index] = { ...next[u.index], status: "saved" };
          }
          return next;
        });
      } catch (error: any) {
        setImages((prev) => {
          const next = [...prev];
          for (const u of updates) {
            next[u.index] = {
              ...next[u.index],
              status: "error",
              error: error.message,
            };
          }
          return next;
        });
      }
    }

    setIsBatchSaving(false);
  }, [images]);

  const pendingCount = images.filter((i) => i.status === "pending").length;
  const readyCount = images.filter((i) => i.status === "ready").length;
  const savedCount = images.filter((i) => i.status === "saved").length;
  const activeImages = images.filter(
    (i) => i.status !== "skipped" && i.status !== "saved",
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView style={styles.scrollContent}>
        {/* Stats bar */}
        <View style={styles.statsBar}>
          <Text style={styles.statsText}>
            {images.length} images found
            {savedCount > 0 && ` \u00B7 ${savedCount} saved`}
            {readyCount > 0 && ` \u00B7 ${readyCount} ready`}
          </Text>
        </View>

        {/* Batch actions */}
        {activeImages.length > 0 && (
          <View style={styles.batchActions}>
            {pendingCount > 0 && (
              <TouchableOpacity
                style={[
                  styles.batchButton,
                  { backgroundColor: colors.primary },
                ]}
                onPress={handleGenerateAll}
                disabled={isBatchGenerating}
              >
                {isBatchGenerating ? (
                  <ActivityIndicator size="small" color={colors.text} />
                ) : (
                  <Text
                    style={[styles.batchButtonText, { color: colors.text }]}
                  >
                    Generate All ({pendingCount})
                  </Text>
                )}
              </TouchableOpacity>
            )}

            {readyCount > 0 && (
              <TouchableOpacity
                style={[
                  styles.batchButton,
                  { backgroundColor: colors.success || "#22c55e" },
                ]}
                onPress={handleSaveAll}
                disabled={isBatchSaving}
              >
                {isBatchSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={[styles.batchButtonText, { color: "#fff" }]}>
                    Save All ({readyCount})
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Image list */}
        {activeImages.map((img) => {
          const originalIndex = images.indexOf(img);
          return (
            <BackfillImageCard
              key={`${img.postUri}-${img.imageIndex}`}
              image={img}
              colors={colors}
              onGenerate={() => handleGenerateOne(originalIndex)}
              onSkip={() => handleSkip(originalIndex)}
              onSave={() => handleSaveOne(originalIndex)}
              onUpdateAltText={(text) =>
                handleUpdateAltText(originalIndex, text)
              }
            />
          );
        })}

        {/* Loading / Load more */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Finding images without alt text...
            </Text>
          </View>
        )}

        {!isLoading && hasMore && (
          <TouchableOpacity
            style={styles.loadMoreButton}
            onPress={handleLoadMore}
          >
            <Text style={[styles.loadMoreText, { color: colors.primary }]}>
              Load More
            </Text>
          </TouchableOpacity>
        )}

        {!isLoading && images.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              All caught up!
            </Text>
            <Text
              style={[styles.emptySubtitle, { color: colors.textSecondary }]}
            >
              All your recent images have alt text. Great job with
              accessibility!
            </Text>
          </View>
        )}

        {!isLoading && activeImages.length === 0 && images.length > 0 && (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              All done!
            </Text>
            <Text
              style={[styles.emptySubtitle, { color: colors.textSecondary }]}
            >
              {savedCount} images updated with alt text.
            </Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

interface BackfillImageCardProps {
  image: BackfillImage;
  colors: any;
  onGenerate: () => void;
  onSkip: () => void;
  onSave: () => void;
  onUpdateAltText: (text: string) => void;
}

function BackfillImageCard({
  image,
  colors,
  onGenerate,
  onSkip,
  onSave,
  onUpdateAltText,
}: BackfillImageCardProps) {
  const cardStyles = createCardStyles(colors);
  const isGenerating = image.status === "generating";
  const isSaving = image.status === "saving";
  const hasAltText = image.altText.trim().length > 0;

  return (
    <View style={cardStyles.card}>
      <Image
        source={{ uri: image.thumb }}
        style={cardStyles.image}
        contentFit="cover"
        cachePolicy="memory-disk"
      />

      <View style={cardStyles.cardContent}>
        {image.postText ? (
          <Text style={cardStyles.postText} numberOfLines={2}>
            {image.postText}
          </Text>
        ) : null}

        <Text style={cardStyles.timestamp}>
          {formatDistanceToNow(new Date(image.createdAt), { addSuffix: true })}
        </Text>

        {image.status === "error" && (
          <Text style={cardStyles.errorText}>{image.error}</Text>
        )}

        <TextInput
          style={cardStyles.altTextInput}
          placeholder="Alt text will appear here..."
          placeholderTextColor={colors.textTertiary}
          multiline
          value={image.altText}
          onChangeText={onUpdateAltText}
          maxLength={1000}
          editable={!isSaving && image.status !== "saved"}
        />

        <Text style={cardStyles.charCount}>{image.altText.length}/1000</Text>

        <View style={cardStyles.actions}>
          {image.status !== "saved" && (
            <>
              <TouchableOpacity
                style={[
                  cardStyles.actionButton,
                  { backgroundColor: colors.surfaceElevated },
                ]}
                onPress={onGenerate}
                disabled={isGenerating || isSaving}
              >
                {isGenerating ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text
                    style={[
                      cardStyles.actionButtonText,
                      { color: colors.text },
                    ]}
                  >
                    Generate
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  cardStyles.actionButton,
                  {
                    backgroundColor: hasAltText
                      ? colors.success || "#22c55e"
                      : colors.surfaceElevated,
                  },
                ]}
                onPress={onSave}
                disabled={!hasAltText || isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text
                    style={[
                      cardStyles.actionButtonText,
                      { color: hasAltText ? "#fff" : colors.textTertiary },
                    ]}
                  >
                    Save
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  cardStyles.actionButton,
                  { backgroundColor: colors.surfaceElevated },
                ]}
                onPress={onSkip}
                disabled={isSaving}
              >
                <Text
                  style={[
                    cardStyles.actionButtonText,
                    { color: colors.textSecondary },
                  ]}
                >
                  Skip
                </Text>
              </TouchableOpacity>
            </>
          )}

          {image.status === "saved" && (
            <View style={cardStyles.savedBadge}>
              <Text style={cardStyles.savedBadgeText}>Saved</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      flex: 1,
    },
    statsBar: {
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    statsText: {
      color: colors.textSecondary,
      fontSize: 14,
    },
    batchActions: {
      flexDirection: "row",
      gap: 12,
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    batchButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: "center",
    },
    batchButtonText: {
      fontSize: 15,
      fontWeight: "600",
    },
    loadingContainer: {
      padding: 40,
      alignItems: "center",
      gap: 12,
    },
    loadingText: {
      fontSize: 14,
    },
    loadMoreButton: {
      padding: 16,
      alignItems: "center",
    },
    loadMoreText: {
      fontSize: 15,
      fontWeight: "600",
    },
    emptyState: {
      padding: 40,
      alignItems: "center",
      gap: 8,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "600",
    },
    emptySubtitle: {
      fontSize: 14,
      textAlign: "center",
    },
  });
}

function createCardStyles(colors: any) {
  return StyleSheet.create({
    card: {
      flexDirection: "row",
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 12,
    },
    image: {
      width: 80,
      height: 80,
      borderRadius: 8,
      backgroundColor: colors.surfaceElevated,
    },
    cardContent: {
      flex: 1,
    },
    postText: {
      color: colors.text,
      fontSize: 13,
      marginBottom: 4,
    },
    timestamp: {
      color: colors.textTertiary,
      fontSize: 12,
      marginBottom: 8,
    },
    errorText: {
      color: colors.danger || "#ef4444",
      fontSize: 12,
      marginBottom: 4,
    },
    altTextInput: {
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderRadius: 6,
      padding: 8,
      fontSize: 13,
      color: colors.text,
      minHeight: 50,
      textAlignVertical: "top",
      backgroundColor: colors.background,
    },
    charCount: {
      color: colors.textTertiary,
      fontSize: 11,
      textAlign: "right",
      marginTop: 2,
      marginBottom: 6,
    },
    actions: {
      flexDirection: "row",
      gap: 8,
    },
    actionButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
      alignItems: "center",
      justifyContent: "center",
      minWidth: 60,
    },
    actionButtonText: {
      fontSize: 13,
      fontWeight: "600",
    },
    savedBadge: {
      backgroundColor: colors.success || "#22c55e",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
    },
    savedBadgeText: {
      color: "#fff",
      fontSize: 13,
      fontWeight: "600",
    },
  });
}
