import { Download, Share2, X } from "lucide-react";
import QRCode from "qrcode";
import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "../contexts/ToastContext";
import {
  canShareFiles,
  isFileShareSupported,
  isWebShareSupported,
} from "../services/share-service";

interface ProfileQRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  handle: string;
  displayName?: string;
  avatar?: string;
}

export function ProfileQRCodeModal({
  isOpen,
  onClose,
  handle,
  displayName,
  avatar,
}: ProfileQRCodeModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const profileUrl = `https://bsky.app/profile/${handle}`;

  // Generate QR code
  useEffect(() => {
    if (!isOpen) return;

    QRCode.toDataURL(profileUrl, {
      width: 280,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
      errorCorrectionLevel: "H", // High correction to support avatar overlay
    }).then((url) => {
      setQrDataUrl(url);
    });
  }, [isOpen, profileUrl]);

  // Render the QR card to a canvas for export
  const renderCardToCanvas = useCallback(async (): Promise<Blob | null> => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx || !qrDataUrl) return null;

    const scale = 2; // Retina quality
    const cardWidth = 320;
    const cardHeight = 420;
    canvas.width = cardWidth * scale;
    canvas.height = cardHeight * scale;
    ctx.scale(scale, scale);

    // White card background with rounded corners
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect(0, 0, cardWidth, cardHeight, 16);
    ctx.fill();

    // Draw QR code
    const qrImg = new Image();
    qrImg.crossOrigin = "anonymous";
    await new Promise<void>((resolve) => {
      qrImg.onload = () => resolve();
      qrImg.onerror = () => resolve();
      qrImg.src = qrDataUrl;
    });

    const qrSize = 240;
    const qrX = (cardWidth - qrSize) / 2;
    const qrY = 24;
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

    // Draw avatar in center of QR code
    if (avatar) {
      const avatarImg = new Image();
      avatarImg.crossOrigin = "anonymous";
      await new Promise<void>((resolve) => {
        avatarImg.onload = () => resolve();
        avatarImg.onerror = () => resolve();
        avatarImg.src = avatar;
      });

      if (avatarImg.complete && avatarImg.naturalWidth > 0) {
        const avatarSize = 52;
        const avatarX = cardWidth / 2 - avatarSize / 2;
        const avatarY = qrY + qrSize / 2 - avatarSize / 2;

        // White border around avatar
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(
          avatarX + avatarSize / 2,
          avatarY + avatarSize / 2,
          avatarSize / 2 + 4,
          0,
          Math.PI * 2,
        );
        ctx.fill();

        // Clip to circle for avatar
        ctx.save();
        ctx.beginPath();
        ctx.arc(
          avatarX + avatarSize / 2,
          avatarY + avatarSize / 2,
          avatarSize / 2,
          0,
          Math.PI * 2,
        );
        ctx.clip();
        ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
        ctx.restore();
      }
    }

    // Display name
    const nameY = qrY + qrSize + 28;
    ctx.fillStyle = "#000000";
    ctx.font = "bold 18px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "center";
    if (displayName) {
      ctx.fillText(displayName, cardWidth / 2, nameY, cardWidth - 32);
    }

    // Handle
    const handleY = displayName ? nameY + 24 : nameY;
    ctx.fillStyle = "#666666";
    ctx.font = "14px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText(`@${handle}`, cardWidth / 2, handleY, cardWidth - 32);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    });
  }, [qrDataUrl, avatar, displayName, handle]);

  const handleSave = useCallback(async () => {
    const blob = await renderCardToCanvas();
    if (!blob) {
      showToast("Failed to generate QR image", { type: "error" });
      return;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${handle}-qr-code.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast("QR code saved", { type: "success", duration: 2000 });
  }, [renderCardToCanvas, handle, showToast]);

  const handleShare = useCallback(async () => {
    const blob = await renderCardToCanvas();
    if (!blob) {
      showToast("Failed to generate QR image", { type: "error" });
      return;
    }

    const file = new File([blob], `${handle}-qr-code.png`, {
      type: "image/png",
    });

    if (
      isWebShareSupported() &&
      isFileShareSupported() &&
      canShareFiles([file])
    ) {
      try {
        await navigator.share({
          title: `${displayName || `@${handle}`} on Bluesky`,
          files: [file],
        });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
      }
    }

    // Fallback: copy profile URL to clipboard
    try {
      await navigator.clipboard.writeText(profileUrl);
      showToast("Profile link copied to clipboard", {
        type: "success",
        duration: 2000,
      });
    } catch {
      showToast("Failed to share", { type: "error" });
    }
  }, [renderCardToCanvas, handle, displayName, profileUrl, showToast]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-container modal-auto-height modal-sm"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-asph-border-primary px-4 py-3">
          <h2
            className="text-lg font-semibold"
            style={{ color: "var(--asph-text-primary)" }}
          >
            QR Code
          </h2>
          <button
            onClick={onClose}
            className="touch-target-icon rounded-full p-1.5 transition-colors hover:bg-asph-bg-hover"
            style={{ color: "var(--asph-text-secondary)" }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* QR Card */}
        <div className="flex flex-col items-center px-6 py-6">
          <div
            ref={cardRef}
            className="flex flex-col items-center rounded-2xl bg-white p-6 shadow-md"
            style={{ minWidth: 280 }}
          >
            {qrDataUrl ? (
              <div className="relative">
                <img
                  src={qrDataUrl}
                  alt={`QR code for @${handle}`}
                  className="h-[240px] w-[240px]"
                />
                {/* Avatar overlay in center */}
                {avatar && (
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                    <div className="rounded-full border-4 border-white bg-white">
                      <img
                        src={avatar}
                        alt=""
                        className="h-[48px] w-[48px] rounded-full object-cover"
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex h-[240px] w-[240px] items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
              </div>
            )}

            {/* Name and handle */}
            <div className="mt-4 text-center">
              {displayName && (
                <p className="text-lg font-bold text-gray-900">{displayName}</p>
              )}
              <p className="text-sm text-gray-500">@{handle}</p>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 border-t border-asph-border-primary px-6 py-4">
          <button
            onClick={handleSave}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
            style={{
              backgroundColor: "var(--asph-bg-hover)",
              color: "var(--asph-text-primary)",
            }}
          >
            <Download className="h-4 w-4" />
            Save Image
          </button>
          <button
            onClick={handleShare}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors"
            style={{
              backgroundColor: "var(--asph-primary)",
            }}
          >
            <Share2 className="h-4 w-4" />
            Share
          </button>
        </div>
      </div>
    </div>
  );
}
