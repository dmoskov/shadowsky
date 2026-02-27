import { useCallback, useState } from "react";
import { Alert } from "react-native";
import { useEmojiPicker } from "../../../hooks/useEmojiPicker";
import type { ImageAsset } from "../../../hooks/useImagePicker";
import { generateAltText } from "../../../services/ai-service";
import type { TenorGif } from "../../../services/tenor";
import { triggerHaptic } from "../../../utils/haptics";
import { createLogger } from "../../../utils/logger";

const logger = createLogger("ComposeMedia");

interface UseComposeMediaParams {
  imagePicker: any;
  videoPicker: any;
  gifPicker: any;
  preferences: any;
  setText: (fn: (prev: string) => string) => void;
}

export function useComposeMedia({
  imagePicker,
  videoPicker,
  gifPicker,
  preferences,
  setText,
}: UseComposeMediaParams) {
  // Image editor state
  const [imageEditorVisible, setImageEditorVisible] = useState(false);
  const [imagesToEdit, setImagesToEdit] = useState<ImageAsset[]>([]);

  // Alt text modal state
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(
    null,
  );
  const [altTextModalVisible, setAltTextModalVisible] = useState(false);
  const [tempAltText, setTempAltText] = useState("");

  // Emoji picker
  const emojiPicker = useEmojiPicker();

  // Image picker handlers
  const handleImagePicker = () => {
    if (videoPicker.selectedVideo) {
      Alert.alert(
        "Media Type Conflict",
        "You can attach either images or a video, not both. Remove the video first to add images.",
      );
      return;
    }

    Alert.alert("Add Image", "Choose an option", [
      { text: "Take Photo", onPress: handleTakePhoto },
      { text: "Choose from Library", onPress: handleChooseFromLibrary },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleTakePhoto = async () => {
    const image = await imagePicker.pickFromCamera(false);
    if (image) {
      setImagesToEdit([image]);
      setImageEditorVisible(true);
    }
  };

  const handleChooseFromLibrary = async () => {
    const images = await imagePicker.pickFromLibrary(false);
    if (images && images.length > 0) {
      setImagesToEdit(images);
      setImageEditorVisible(true);
    }
  };

  const handleSaveEditedImages = async (
    editedImages: Array<{ originalAsset: ImageAsset; editedAsset: ImageAsset }>,
  ) => {
    const assetsToAdd = editedImages.map((img) => img.editedAsset);
    imagePicker.addImages(assetsToAdd);
    setImageEditorVisible(false);
    setImagesToEdit([]);

    if (preferences?.autoGenerateAltText) {
      for (let i = 0; i < assetsToAdd.length; i++) {
        const asset = assetsToAdd[i];
        if (!asset.altText || asset.altText.trim() === "") {
          try {
            const altText = await generateAltText(asset.uri);
            const imageIndex = imagePicker.selectedImages.findIndex(
              (img: ImageAsset) => img.uri === asset.uri,
            );
            if (imageIndex !== -1) {
              imagePicker.updateAltText(imageIndex, altText);
            }
          } catch (error) {
            logger.error("Failed to auto-generate alt text:", error);
          }
        }
      }
    }
  };

  const handleCancelImageEditor = () => {
    setImageEditorVisible(false);
    setImagesToEdit([]);
  };

  // Video picker handlers
  const handleVideoPicker = () => {
    if (imagePicker.selectedImages.length > 0) {
      Alert.alert(
        "Media Type Conflict",
        "You can attach either images or a video, not both. Remove the images first to add a video.",
      );
      return;
    }

    Alert.alert("Add Video", "Choose an option", [
      { text: "Record Video", onPress: () => videoPicker.recordVideo() },
      {
        text: "Choose from Library",
        onPress: () => videoPicker.pickFromLibrary(),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleRemoveVideo = () => {
    Alert.alert("Remove Video", "Are you sure you want to remove this video?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          videoPicker.removeVideo();
        },
      },
    ]);
  };

  const handleRemoveImage = (index: number) => {
    Alert.alert("Remove Image", "Are you sure you want to remove this image?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => imagePicker.removeImage(index),
      },
    ]);
  };

  // Alt text handlers
  const handleAddAltText = (index: number) => {
    setSelectedImageIndex(index);
    setTempAltText(imagePicker.selectedImages[index].altText);
    setAltTextModalVisible(true);
  };

  const handleSaveAltText = (altText: string) => {
    if (selectedImageIndex !== null) {
      imagePicker.updateAltText(selectedImageIndex, altText);
    }
    setAltTextModalVisible(false);
    setSelectedImageIndex(null);
    setTempAltText("");
  };

  const handleGenerateAltText = async (): Promise<string> => {
    if (selectedImageIndex === null) return "";

    try {
      const imageUri = imagePicker.selectedImages[selectedImageIndex].uri;
      const generatedText = await generateAltText(imageUri);
      triggerHaptic("success");
      return generatedText;
    } catch (error) {
      logger.error("Failed to generate alt text:", error);
      Alert.alert(
        "Generation Failed",
        error instanceof Error
          ? error.message
          : "Failed to generate alt text. Please try again.",
        [{ text: "OK" }],
      );
      triggerHaptic("error");
      throw error;
    }
  };

  // GIF picker handlers
  const handleGifPicker = () => {
    if (imagePicker.selectedImages.length > 0 || videoPicker.selectedVideo) {
      Alert.alert(
        "Media Already Attached",
        "Remove images or video first to add a GIF. GIFs are embedded as external links.",
      );
      return;
    }

    if (gifPicker.selectedGif) {
      Alert.alert(
        "GIF Already Added",
        "You already have a GIF attached. Remove it first to add a new one.",
      );
      return;
    }

    gifPicker.open();
  };

  const handleSelectGif = useCallback(
    (gif: TenorGif) => {
      gifPicker.selectGif(gif);
      gifPicker.close();
      triggerHaptic("success");
    },
    [gifPicker],
  );

  const handleRemoveGif = () => {
    Alert.alert("Remove GIF", "Are you sure you want to remove this GIF?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => gifPicker.clearSelection(),
      },
    ]);
  };

  // Emoji picker handlers
  const handleEmojiPicker = () => {
    emojiPicker.open();
  };

  const handleSelectEmoji = useCallback((emoji: string) => {
    setText((prevText: string) => prevText + emoji);
    triggerHaptic("selection");
  }, []);

  return {
    // Image editor
    imageEditorVisible,
    imagesToEdit,
    handleImagePicker,
    handleSaveEditedImages,
    handleCancelImageEditor,

    // Image management
    handleRemoveImage,
    handleRemoveVideo,

    // Alt text
    selectedImageIndex,
    altTextModalVisible,
    setAltTextModalVisible,
    tempAltText,
    handleAddAltText,
    handleSaveAltText,
    handleGenerateAltText,

    // Video
    handleVideoPicker,

    // GIF
    handleGifPicker,
    handleSelectGif,
    handleRemoveGif,

    // Emoji
    emojiPicker,
    handleEmojiPicker,
    handleSelectEmoji,
  };
}
