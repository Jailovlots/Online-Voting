import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, X, Loader2, Camera } from "lucide-react";
import { toast } from "sonner";

interface ImageUploadProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  uploadImageFn: (args: { data: { base64Data: string; fileName: string } }) => Promise<{ url: string }>;
}

const compressImage = (file: File, fallbackBase64: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(fallbackBase64);
        return;
      }

      // Resize logic (limit to maximum 800px width or height)
      const MAX_WIDTH = 800;
      const MAX_HEIGHT = 800;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width = Math.round((width * MAX_HEIGHT) / height);
          height = MAX_HEIGHT;
        }
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      // Preserve alpha for PNG/SVG, otherwise export as compressed JPEG
      const outputType = file.type === "image/png" || file.type === "image/svg+xml" ? "image/png" : "image/jpeg";
      const compressedDataUrl = canvas.toDataURL(outputType, 0.75);
      resolve(compressedDataUrl);
    };
    img.onerror = () => {
      resolve(fallbackBase64);
    };
  });
};

export function ImageUpload({
  value,
  onChange,
  label = "Photo",
  uploadImageFn,
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be under 5MB");
      return;
    }

    // Validate image type
    if (!file.type.startsWith("image/")) {
      toast.error("Selected file must be an image");
      return;
    }

    setIsUploading(true);
    const toastId = toast.loading("Uploading image...");

    try {
      let base64Data: string;

      if (file.type === "image/svg+xml") {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
        });
        reader.readAsDataURL(file);
        base64Data = await base64Promise;
      } else {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
        });
        reader.readAsDataURL(file);
        const rawBase64 = await base64Promise;

        try {
          base64Data = await compressImage(file, rawBase64);
        } catch {
          base64Data = rawBase64;
        }
      }

      const res = await uploadImageFn({
        data: {
          base64Data,
          fileName: file.name,
        },
      });

      onChange(res.url);
      toast.success("Image uploaded successfully", { id: toastId });
    } catch (err: any) {
      toast.error(err.message || "Failed to upload image", { id: toastId });
    } finally {
      setIsUploading(false);
      // Clear file input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removeImage = () => {
    onChange("");
  };

  return (
    <div className="space-y-2">
      {label && <Label className="text-sm font-medium">{label}</Label>}
      <div className="flex items-center gap-4">
        {/* Avatar/Preview container with micro-animations */}
        <div 
          onClick={() => !isUploading && fileInputRef.current?.click()}
          className="relative size-16 rounded-full overflow-hidden border border-border bg-muted flex items-center justify-center cursor-pointer transition-all duration-300 hover:scale-105 hover:border-primary/50 group"
        >
          {value ? (
            <img src={value} alt="Preview" className="w-full h-full object-cover" />
          ) : (
            <Camera className="size-6 text-muted-foreground transition-colors group-hover:text-primary" />
          )}
          
          {/* Overlay on hover/loading */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
            <Camera className="size-5 text-white" />
          </div>

          {isUploading && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
              <Loader2 className="size-5 text-white animate-spin" />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              <Upload className="size-3.5 mr-1.5" />
              Upload Image
            </Button>
            {value && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                onClick={removeImage}
                disabled={isUploading}
              >
                <X className="size-3.5 mr-1.5" />
                Remove
              </Button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            PNG, JPG, WEBP or SVG (Max 5MB)
          </p>
        </div>
      </div>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />
    </div>
  );
}
