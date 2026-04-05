import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, AlertCircle, CheckCircle, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import toast from 'react-hot-toast';

interface ProductImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

interface ImportPreview {
  row: number;
  name: string;
  category: string;
  price: string;
  status: 'pending' | 'success' | 'error';
  error?: string;
}

export const ProductImportModal: React.FC<ProductImportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFileSelect = useCallback((selectedFile: File) => {
    setError(null);
    setPreview([]);

    if (!selectedFile.name.endsWith('.csv')) {
      setError('Please select a CSV file');
      return;
    }

    setFile(selectedFile);

    // Read and parse CSV for preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      if (lines.length <= 1) {
        setError('CSV file appears to be empty');
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
      const required = ['name', 'category', 'price'];
      const missing = required.filter(col => !headers.includes(col));

      if (missing.length > 0) {
        setError(`Missing required columns: ${missing.join(', ')}`);
        return;
      }

      // Get column indices
      const idx: Record<string, number> = {};
      headers.forEach((h, i) => idx[h] = i);

      // Parse first 5 rows for preview
      const previewRows: ImportPreview[] = [];
      for (let i = 1; i < Math.min(6, lines.length); i++) {
        if (!lines[i].trim()) continue;
        const values = lines[i].split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
        const name = values[idx.name] || '';
        const category = values[idx.category] || '';
        const price = values[idx.price] || '';

        // Validate
        let status: 'pending' | 'success' | 'error' = 'pending';
        let errorMsg: string | undefined;
        if (!name || !category || !price) {
          status = 'error';
          errorMsg = 'Missing required fields';
        }

        previewRows.push({
          row: i,
          name: name.substring(0, 30),
          category,
          price,
          status,
          error: errorMsg,
        });
      }
      setPreview(previewRows);
    };
    reader.readAsText(selectedFile);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }, [handleFileSelect]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/products/import', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Import failed');
      }

      // Success
      toast.success(data.message || `Imported ${data.results.imported} products successfully`);
      onImportComplete();
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Failed to import products');
      toast.error(err.message || 'Import failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPreview([]);
    setError(null);
    setIsUploading(false);
    onClose();
  };

  const isValid = file && preview.length > 0 && preview.every(p => p.status !== 'error');

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="bg-dark-900 border border-dark-800 rounded-xl shadow-2xl max-w-2xl w-full p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-white">Import Products</h3>
                <p className="text-sm text-dark-400 mt-1">Upload a CSV file to import products</p>
              </div>
              <button onClick={handleClose} className="text-dark-400 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              {/* CSV Format Requirements */}
              <div className="p-4 bg-dark-800 border border-dark-700 rounded-lg">
                <h4 className="text-sm font-medium text-white mb-2">Required CSV Format</h4>
                <p className="text-xs text-dark-400 mb-2">Your CSV file must include these columns (case-insensitive):</p>
                <code className="text-xs text-green-400 block bg-dark-900 p-2 rounded">
                  name, category, price
                </code>
                <p className="text-xs text-dark-400 mt-2 mb-1">Optional columns:</p>
                <code className="text-xs text-blue-400 block bg-dark-900 p-2 rounded">
                  description, image, rating, reviews, status
                </code>
              </div>

              {/* File Drop Zone */}
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragOver
                    ? 'border-primary-500 bg-primary-500/10'
                    : file
                    ? 'border-green-500 bg-green-500/10'
                    : 'border-dark-700 hover:border-dark-600'
                }`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                {file ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileSpreadsheet className="text-green-400" size={32} />
                    <div className="text-left">
                      <p className="text-white font-medium">{file.name}</p>
                      <p className="text-sm text-dark-400">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button
                      onClick={() => setFile(null)}
                      className="text-red-400 hover:text-red-300 ml-2"
                    >
                      <X size={20} />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload size={48} className="mx-auto text-dark-500 mb-3" />
                    <p className="text-dark-300 mb-1">Drag and drop your CSV file here</p>
                    <p className="text-sm text-dark-500 mb-3">or</p>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleInputChange}
                      className="hidden"
                      id="csv-upload"
                    />
                    <label
                      htmlFor="csv-upload"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg cursor-pointer transition-colors"
                    >
                      <Upload size={18} />
                      Choose File
                    </label>
                  </>
                )}
              </div>

              {/* Error Display */}
              {error && (
                <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <AlertCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-red-400">Error</h4>
                    <p className="text-sm text-red-300 mt-1">{error}</p>
                  </div>
                </div>
              )}

              {/* Preview Table */}
              {preview.length > 0 && (
                <div className="border border-dark-800 rounded-lg overflow-hidden">
                  <div className="p-3 bg-dark-800 border-b border-dark-700">
                    <h4 className="text-sm font-medium text-white">Preview (first {preview.length} rows)</h4>
                  </div>
                  <div className="overflow-x-auto max-h-64 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-dark-800 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left text-dark-400 font-medium">Row</th>
                          <th className="px-4 py-2 text-left text-dark-400 font-medium">Name</th>
                          <th className="px-4 py-2 text-left text-dark-400 font-medium">Category</th>
                          <th className="px-4 py-2 text-left text-dark-400 font-medium">Price</th>
                          <th className="px-4 py-2 text-left text-dark-400 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dark-800">
                        {preview.map((p) => (
                          <tr key={p.row} className={p.status === 'error' ? 'bg-red-500/10' : ''}>
                            <td className="px-4 py-3 text-dark-400">{p.row}</td>
                            <td className="px-4 py-3 text-white truncate max-w-xs">{p.name || '-'}</td>
                            <td className="px-4 py-3 text-dark-300">{p.category || '-'}</td>
                            <td className="px-4 py-3 text-primary-500">{p.price || '-'}</td>
                            <td className="px-4 py-3">
                              {p.status === 'error' ? (
                                <span className="text-red-400 text-xs flex items-center gap-1">
                                  <AlertCircle size={12} /> {p.error}
                                </span>
                              ) : (
                                <span className="text-green-400 text-xs flex items-center gap-1">
                                  <CheckCircle size={12} /> Ready
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Instructions */}
              {!preview.length && !error && (
                <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg flex gap-3">
                  <AlertCircle size={20} className="text-blue-500 shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-200">
                    <p className="font-medium mb-1">CSV Import Tips:</p>
                    <ul className="list-disc list-inside space-y-1 text-blue-300/80">
                      <li>Use commas to separate columns</li>
                      <li>Include header row with column names (name, category, price)</li>
                      <li>Price should be a number (e.g., 299.99 or "299.99 KSh")</li>
                      <li>Status can be: draft, published, or archived (defaults to draft)</li>
                      <li>Rating: 0-5, Reviews: integer</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-3 justify-end">
              <Button variant="ghost" onClick={handleClose} disabled={isUploading}>
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                disabled={!isValid() || isUploading}
                className="gap-2"
              >
                {isUploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload size={18} />
                    Import {preview.length > 0 && `(${preview.filter(p => p.status !== 'error').length} products)`}
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
