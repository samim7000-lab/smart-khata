import React, { useState } from 'react';
import { BusinessMediaItem, SAMPLE_MEDIA_ITEMS, uploadBusinessMedia } from '../lib/mediaUtils';
import { Language, Shop } from '../types';
import { translations } from '../i18n/translations';
import {
  FolderOpen,
  X,
  Upload,
  Plus,
  Trash2,
  Check,
  FileText,
  Image as ImageIcon,
  Video,
  Search,
  CheckCircle2,
  Loader2,
  ShieldCheck
} from 'lucide-react';

interface Props {
  shop: Shop;
  language: Language;
  onClose: () => void;
  onSelectMedia: (media: BusinessMediaItem) => void;
}

export const MediaLibraryModal: React.FC<Props> = ({
  shop,
  language,
  onClose,
  onSelectMedia,
}) => {
  const t = translations[language];
  const [mediaList, setMediaList] = useState<BusinessMediaItem[]>(SAMPLE_MEDIA_ITEMS);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingState, setUploadingState] = useState(false);

  // New Media Form state
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<BusinessMediaItem['category']>('poster');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [successMsg, setSuccessMsg] = useState('');

  const filteredMedia = mediaList.filter((m) => {
    const matchesCat = selectedCategory === 'all' || m.category === selectedCategory;
    const matchesQuery = !searchQuery || m.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesQuery;
  });

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !newTitle.trim()) return;

    try {
      setUploadingState(true);
      const newMedia = await uploadBusinessMedia(selectedFile, shop.id, newTitle.trim(), newCategory);
      setMediaList([newMedia, ...mediaList]);
      setSuccessMsg(`Uploaded "${newTitle}" to Cloud Media Library!`);
      setNewTitle('');
      setSelectedFile(null);
      setIsUploading(false);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      alert('Failed to upload media asset: ' + err.message);
    } finally {
      setUploadingState(false);
    }
  };

  const handleDelete = (id: string) => {
    setMediaList(mediaList.filter((m) => m.id !== id));
    setSuccessMsg('Deleted asset from Media Library.');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-white/10 rounded-2xl backdrop-blur-md">
              <FolderOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-black text-xl tracking-tight">Business Media Library</h3>
              <p className="text-xs text-blue-100 font-medium mt-0.5">
                Cloud media repository for product photos, posters, and digital PDF catalogues
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 transition-colors text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Success Alert */}
        {successMsg && (
          <div className="bg-emerald-50 dark:bg-emerald-950/80 border-b border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 px-4 py-3 text-xs font-bold flex items-center space-x-2 animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-5 max-h-[75vh] overflow-y-auto space-y-4">
          {!isUploading ? (
            <>
              {/* Top Controls: Search + Category Filter Tabs */}
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search media assets..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold outline-none"
                  />
                </div>

                <button
                  onClick={() => setIsUploading(true)}
                  className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold shadow-md shadow-blue-600/30 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Upload Media Asset</span>
                </button>
              </div>

              {/* Category Filter Chips */}
              <div className="flex space-x-1.5 overflow-x-auto pb-1">
                {['all', 'poster', 'product', 'catalogue', 'banner', 'video'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold uppercase tracking-wide transition-all shrink-0 ${
                      selectedCategory === cat
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Media Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {filteredMedia.length === 0 ? (
                  <div className="col-span-full p-8 text-center text-slate-400 text-xs font-bold bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800">
                    No media items match your search.
                  </div>
                ) : (
                  filteredMedia.map((item) => (
                    <div
                      key={item.id}
                      className="group relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                    >
                      <div className="h-32 bg-slate-100 dark:bg-slate-700 relative overflow-hidden flex items-center justify-center">
                        {item.file_type === 'image' ? (
                          <img
                            src={item.media_url}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : item.file_type === 'pdf' ? (
                          <div className="flex flex-col items-center justify-center p-3 text-red-500">
                            <FileText className="w-12 h-12 mb-1" />
                            <span className="text-[10px] font-black uppercase text-slate-500">PDF Catalogue</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center p-3 text-purple-500">
                            <Video className="w-12 h-12 mb-1" />
                            <span className="text-[10px] font-black uppercase text-slate-500">Video</span>
                          </div>
                        )}

                        <span className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-md text-white font-black text-[9px] uppercase px-2 py-0.5 rounded-md">
                          {item.category}
                        </span>
                      </div>

                      <div className="p-3 space-y-2">
                        <h5 className="font-extrabold text-slate-900 dark:text-white text-xs truncate">
                          {item.title}
                        </h5>

                        <div className="flex items-center justify-between pt-1">
                          <button
                            onClick={() => {
                              onSelectMedia(item);
                              onClose();
                            }}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[11px] font-extrabold shadow-xs transition-colors flex items-center space-x-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Attach</span>
                          </button>

                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            /* Upload Form */
            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-slate-900 dark:text-white text-sm uppercase tracking-wide">
                  Upload Asset to Supabase Storage
                </h4>
                <button
                  type="button"
                  onClick={() => setIsUploading(false)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Asset Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. New Year Special Discount Banner"
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-xl border border-gray-300 dark:border-slate-600 font-bold text-sm outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Category
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as any)}
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-xl border border-gray-300 dark:border-slate-600 font-bold text-sm outline-none"
                >
                  <option value="poster">Poster / Offer Banner 🖼️</option>
                  <option value="product">Product Photo 🛍️</option>
                  <option value="catalogue">PDF Catalogue / Price List 📄</option>
                  <option value="banner">Store Promotional Banner 📢</option>
                  <option value="video">Product Video 🎥</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Select File (Image, Video, or PDF) <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  required
                  accept="image/*,video/*,application/pdf"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200"
                />
              </div>

              <button
                type="submit"
                disabled={uploadingState || !selectedFile}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
              >
                {uploadingState ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Upload & Compress Asset</span>
                  </>
                )}
              </button>
            </form>
          )}

          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl text-center text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center justify-center space-x-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Supabase Cloud Storage • Auto Image Compression & Thumbnail Generation</span>
          </div>
        </div>
      </div>
    </div>
  );
};
