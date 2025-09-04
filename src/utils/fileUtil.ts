/** File save configuration */
export interface FileSaveOptions {
  name?: string; // File name (without extension)
  ext?: string; // File extension (e.g. '.json')
  mimeType?: string; // Specify MIME type, priority use
  description?: string; // File type description in the save dialog
  forceFallback?: boolean; // Whether to force the use of traditional download methods
  existStrategy?: 'prompt' | 'overwrite' | 'new'; // How to handle when the file exists
}

export interface FileSaveResult {
  success: boolean; // Whether the save was successful
  fileHandle?: FileSystemFileHandle | null; // File handle in FSA mode
  error?: Error; // Error object
  message?: string; // Prompt message
}

// Mapping table of common extension names and MIME types
const mimeMap: Record<string, string> = {
  '.txt': 'text/plain',
  '.json': 'application/json',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.csv': 'text/csv',
  '.xml': 'application/xml',
  '.js': 'application/javascript',
  '.ts': 'application/typescript',
  '.css': 'text/css',
  '.md': 'text/markdown',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.zip': 'application/zip',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4'
};

/**
 * FileSaver file saving tool
 *  - Supports the File System Access API of modern browsers (can only be used in a secure context https|localhost)
 *  - Supports traditional download methods
 *  - Supports automatic identification of MIME types based on extension names
 */
class FileSaver {
  static async save(content: string | Blob | ArrayBuffer, options: FileSaveOptions = {}): Promise<FileSaveResult> {
    const {
      // Default file name is 'untitled'
      name = 'untitled',
      // Default extension is empty
      ext = '',
      // If the user passes in mimeType, use it
      mimeType,
      // The file type description is 'File' by default
      description = 'File',
      // Whether to force the use of fallback (that is, the original save method, create a tag)
      forceFallback = false,
      // The default prompt asks the user whether to overwrite
      existStrategy = 'prompt'
    } = options;

    // Automatically infer MIME type based on extension (if not provided)
    const inferredMime = mimeType || mimeMap[ext.toLowerCase()] || 'application/octet-stream';

    try {
      // If the File System Access API is supported and fallback is not forced, the modern method is preferred
      if (!forceFallback && this.isFSAvailable()) {
        return await this.saveWithFSA(content, {
          name,
          ext,
          mimeType: inferredMime,
          description,
          existStrategy
        });
      }

      // Otherwise, use the traditional download method (a tag method)
      return this.saveWithFallback(content, {
        name: this.ensureExtension(name, ext),
        mimeType: inferredMime
      });
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        message: 'File save failed'
      };
    }
  }

  /**
   * Use the File System Access API to save the file
   * @param content
   * @param options
   * @returns
   */
  private static async saveWithFSA(
    content: string | Blob | ArrayBuffer,
    options: {
      name: string;
      ext: string;
      mimeType: string;
      description: string;
      existStrategy: 'prompt' | 'overwrite' | 'new';
    }
  ): Promise<FileSaveResult> {
    try {
      // Make sure the file name has an extension
      const fileName = this.ensureExtension(options.name, options.ext);
      let fileHandle: FileSystemFileHandle | null = null;

      // If you are not forced to create a new file, you can select an existing file
      if (options.existStrategy !== 'new') {
        try {
          [fileHandle] = await window.showOpenFilePicker({
            types: [
              {
                description: options.description,
                accept: { [options.mimeType]: [options.ext] }
              }
            ]
          });

          // If the policy is to prompt and the user refuses to overwrite, cancel the operation
          if (options.existStrategy === 'prompt' && !confirm(`File "${fileHandle.name}" already exists, do you want to overwrite it?`)) {
            return {
              success: false,
              fileHandle: null,
              message: 'User canceled overwrite'
            };
          }
        } catch {
          // No file selected or user canceled, continue with the new process
        }
      }

      // When there is no file handle, create a new file
      if (!fileHandle) {
        fileHandle = await window.showSaveFilePicker({
          suggestedName: fileName,
          types: [
            {
              description: options.description,
              accept: { [options.mimeType]: [options.ext] }
            }
          ]
        });
      }
      // Get writable stream
      const writable = await fileHandle.createWritable();
      // Convert content to Blob
      const blob = this.normalizeContentToBlob(content, options.mimeType);
      // Write content
      await writable.write(blob);
      // Close stream
      await writable.close();

      return {
        success: true,
        fileHandle,
        message: 'File saved successfully'
      };
    } catch (error) {
      // Handling of user cancellation
      if ((error as Error).name === 'AbortError') {
        return {
          success: false,
          fileHandle: null,
          message: 'User canceled operation'
        };
      }
      throw error;
    }
  }

  /**
   * Save file in the traditional way
   * @param content
   * @param options
   * @returns
   */
  private static saveWithFallback(
    content: string | Blob | ArrayBuffer,
    options: { name: string; mimeType: string }
  ): FileSaveResult {
    try {
      // Convert content to Blob
      const blob = this.normalizeContentToBlob(content, options.mimeType);
      // Create temporary URL
      const url = URL.createObjectURL(blob);
      // Create <a> tag
      const a = document.createElement('a');
      // Set download link
      a.href = url;
      // Set download file name
      a.download = options.name;
      // Hide tag
      a.style.display = 'none';
      // Add to page
      document.body.appendChild(a);
      // Trigger download
      a.click();
      // Clean up tags
      document.body.removeChild(a);
      // Release URL
      URL.revokeObjectURL(url);

      return {
        success: true,
        fileHandle: null,
        message: 'File download started'
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        message: 'Traditional download method failed'
      };
    }
  }

  // Determine whether the current browser supports the File System Access API
  private static isFSAvailable(): boolean {
    return 'showSaveFilePicker' in window && 'showOpenFilePicker' in window && 'FileSystemFileHandle' in window;
  }

  // Make sure the file name has an extension
  private static ensureExtension(filename: string, ext: string): string {
    return filename.endsWith(ext) ? filename : `${filename}${ext}`;
  }

  // Convert content to a standard Blob object for easy writing or downloading
  private static normalizeContentToBlob(content: string | Blob | ArrayBuffer, mimeType: string): Blob {
    if (typeof content === 'string') {
      return new Blob([content], { type: mimeType }); // Text to Blob
    }
    if (content instanceof Blob) {
      return content; // Already a Blob, return directly
    }
    if (content instanceof ArrayBuffer) {
      return new Blob([new Uint8Array(content)], { type: mimeType }); // Binary to Blob
    }
    throw new Error('Unsupported content type'); // Unsupported type
  }
}

export default FileSaver;
