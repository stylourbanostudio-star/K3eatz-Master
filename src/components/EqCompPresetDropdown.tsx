import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  SlidersHorizontal, 
  ChevronDown, 
  Check, 
  Sparkles, 
  RotateCcw, 
  Search, 
  Waves, 
  Zap, 
  AlignJustify, 
  Volume2,
  Bookmark,
  Info
} from 'lucide-react';
import { useMastering } from '../context/MasteringContext';
import { EQ_COMP_PRESETS, EqCompPreset, PresetCategory, isPresetActive } from '../data/eqCompPresets';

interface EqCompPresetDropdownProps {
  variant?: 'compact' | 'full';
  className?: string;
  onPresetApplied?: (presetName: string) => void;
}

export default function EqCompPresetDropdown({ 
  variant = 'full', 
  className = '',
  onPresetApplied 
}: EqCompPresetDropdownProps) {
  const { settings, updateSettings, presets: userCustomPresets } = useMastering();
  
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<PresetCategory | 'User Bank'>('All');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Autofocus search when dropdown opens
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Determine currently active preset if matched
  const activePreset = useMemo(() => {
    return EQ_COMP_PRESETS.find(p => isPresetActive(settings, p)) || null;
  }, [settings]);

  // Categories list
  const categories: (PresetCategory | 'User Bank')[] = useMemo(() => {
    const list: (PresetCategory | 'User Bank')[] = [
      'All', 
      'Punch & Bass', 
      'Tone & Air', 
      'Dynamic Glue', 
      'Genre Polish', 
      'Utility'
    ];
    if (userCustomPresets && userCustomPresets.length > 0) {
      list.push('User Bank');
    }
    return list;
  }, [userCustomPresets]);

  // Filtered presets
  const filteredPresets = useMemo(() => {
    if (selectedCategory === 'User Bank') {
      return [];
    }

    return EQ_COMP_PRESETS.filter(preset => {
      const matchesCategory = selectedCategory === 'All' || preset.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        preset.name.toLowerCase().includes(q) || 
        preset.description.toLowerCase().includes(q) ||
        preset.genreTag.toLowerCase().includes(q) ||
        preset.category.toLowerCase().includes(q);

      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  // Apply a curated EQ & Compression preset
  const handleApplyPreset = async (preset: EqCompPreset) => {
    await updateSettings({
      eq: {
        ...settings.eq,
        hpf: preset.eq.hpf,
        low: { ...preset.eq.low },
        lowMid: { ...preset.eq.lowMid },
        mid: { ...preset.eq.mid },
        highMid: { ...preset.eq.highMid },
        high: { ...preset.eq.high },
        lpf: preset.eq.lpf
      },
      compression: preset.compression,
      dynamics: {
        low: { ...preset.dynamics.low },
        mid: { ...preset.dynamics.mid },
        high: { ...preset.dynamics.high }
      }
    });

    setToastMessage(`Applied "${preset.name}"`);
    setTimeout(() => setToastMessage(null), 2500);
    setIsOpen(false);
    onPresetApplied?.(preset.name);
  };

  // Apply a user custom preset from their saved bank
  const handleApplyUserPreset = async (userPreset: any) => {
    if (!userPreset.settings) return;
    
    // Apply EQ and compression from the saved user preset
    const newSettings: any = {};
    if (userPreset.settings.eq) newSettings.eq = userPreset.settings.eq;
    if (typeof userPreset.settings.compression === 'number') newSettings.compression = userPreset.settings.compression;
    if (userPreset.settings.dynamics) newSettings.dynamics = userPreset.settings.dynamics;
    
    await updateSettings(newSettings);

    setToastMessage(`Applied User Preset "${userPreset.name}"`);
    setTimeout(() => setToastMessage(null), 2500);
    setIsOpen(false);
    onPresetApplied?.(userPreset.name);
  };

  // Quick reset to flat EQ & bypassed compression
  const handleResetToFlat = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const flatPreset = EQ_COMP_PRESETS.find(p => p.id === 'flat-zeroed');
    if (flatPreset) {
      await handleApplyPreset(flatPreset);
    }
  };

  // Formatting live EQ summary
  const lowGainVal = settings.eq?.low?.gain ?? 0;
  const highGainVal = settings.eq?.high?.gain ?? 0;
  const lowGainStr = `${lowGainVal > 0 ? '+' : ''}${lowGainVal.toFixed(1)} dB`;
  const highGainStr = `${highGainVal > 0 ? '+' : ''}${highGainVal.toFixed(1)} dB`;
  const glueStr = `${Math.round(settings.compression ?? 0)}%`;

  return (
    <div ref={containerRef} className={`relative select-none ${className}`}>
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute -top-10 left-1/2 -translate-x-1/2 z-50 px-3 py-1 bg-primary text-obsidian rounded-full font-mono text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-lg shadow-primary/20 pointer-events-none whitespace-nowrap"
          >
            <Check className="w-3 h-3 stroke-[3]" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Trigger Button */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`group flex items-center justify-between gap-3 p-2.5 rounded-xl border transition-all cursor-pointer ${
          isOpen 
            ? 'bg-black/90 border-primary/50 shadow-[0_0_20px_rgba(29,185,84,0.15)] ring-1 ring-primary/30' 
            : activePreset 
              ? 'bg-black/60 border-primary/30 hover:border-primary/50' 
              : 'bg-black/40 border-white/10 hover:border-white/20 hover:bg-black/60'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
            activePreset ? 'bg-primary/20 text-primary' : 'bg-white/5 text-white/40 group-hover:text-white/70'
          }`}>
            <SlidersHorizontal className="w-4 h-4" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-white/40">EQ & Compression Preset</span>
              {activePreset ? (
                <span className="px-1.5 py-0.2 rounded-xs bg-primary/20 text-primary font-mono text-[7.5px] font-bold uppercase tracking-wider">
                  {activePreset.genreTag}
                </span>
              ) : (
                <span className="px-1.5 py-0.2 rounded-xs bg-white/5 text-white/30 font-mono text-[7.5px] uppercase tracking-wider">
                  Custom Console Curve
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-mono text-[11px] font-bold text-white truncate group-hover:text-primary transition-colors">
                {activePreset ? activePreset.name : 'Custom / Unsaved Mix'}
              </span>
            </div>
          </div>
        </div>

        {/* Live metrics indicator badges */}
        <div className="hidden sm:flex items-center gap-1.5 font-mono text-[8.5px]">
          <span className="px-2 py-0.5 rounded bg-white/5 border border-white/5 text-white/60">
            Low <strong className={lowGainVal !== 0 ? 'text-primary' : 'text-white/40'}>{lowGainStr}</strong>
          </span>
          <span className="px-2 py-0.5 rounded bg-white/5 border border-white/5 text-white/60">
            High <strong className={highGainVal !== 0 ? 'text-amber' : 'text-white/40'}>{highGainStr}</strong>
          </span>
          <span className="px-2 py-0.5 rounded bg-white/5 border border-white/5 text-white/60">
            Glue <strong className={settings.compression > 0 ? 'text-primary font-bold' : 'text-white/40'}>{glueStr}</strong>
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 pl-2 border-l border-white/10">
          <button
            type="button"
            onClick={handleResetToFlat}
            title="Reset EQ & Compression to Zeroed / Flat"
            className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <motion.div 
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="text-white/40 group-hover:text-white/80"
          >
            <ChevronDown className="w-4 h-4" />
          </motion.div>
        </div>
      </div>

      {/* Expanded Preset Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute z-50 left-0 right-0 mt-2 p-3 bg-obsidian-light/95 border border-white/15 rounded-2xl shadow-2xl backdrop-blur-xl max-h-[480px] flex flex-col overflow-hidden ring-1 ring-white/10"
            style={{ width: '100%', minWidth: '320px' }}
          >
            {/* Search & Filter Header */}
            <div className="space-y-2.5 pb-2.5 border-b border-white/10">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter EQ & compression styles (punch, warm, air, trap, clean)..."
                  className="w-full bg-black/50 text-white font-mono text-[10px] pl-9 pr-3 py-2 rounded-xl border border-white/10 focus:outline-hidden focus:border-primary/50 focus:ring-1 focus:ring-primary/30 placeholder:text-white/25"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 text-white/40 hover:text-white font-mono text-[9px] px-1"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Category Pills */}
              <div className="flex gap-1 overflow-x-auto no-scrollbar py-0.5">
                {categories.map((cat) => {
                  const isSelected = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-2.5 py-1 rounded-lg font-mono text-[8px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                        isSelected
                          ? 'bg-primary text-obsidian shadow-sm shadow-primary/20'
                          : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white border border-white/5'
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Presets List Scroll Area */}
            <div className="overflow-y-auto custom-scrollbar pt-2 space-y-1.5 flex-1 pr-1">
              {selectedCategory === 'User Bank' ? (
                /* User Custom Saved Presets */
                userCustomPresets.length === 0 ? (
                  <div className="py-8 text-center text-white/30 font-mono text-[10px]">
                    <Bookmark className="w-5 h-5 mx-auto mb-1.5 opacity-40" />
                    <p>No user presets saved yet.</p>
                    <p className="text-[8px] text-white/20 mt-1">Save a custom preset in the User Presets section below.</p>
                  </div>
                ) : (
                  userCustomPresets.map((preset) => (
                    <div
                      key={preset.id}
                      onClick={() => handleApplyUserPreset(preset)}
                      className="group p-2.5 rounded-xl border border-white/5 bg-black/40 hover:bg-white/5 hover:border-primary/40 transition-all cursor-pointer flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5">
                        <Bookmark className="w-4 h-4 text-primary" />
                        <div>
                          <div className="font-mono text-[10.5px] font-bold text-white group-hover:text-primary transition-colors">
                            {preset.name}
                          </div>
                          <div className="font-mono text-[8px] text-white/40">
                            Custom User Preset
                          </div>
                        </div>
                      </div>
                      <button className="px-2.5 py-1 rounded bg-primary/20 group-hover:bg-primary text-primary group-hover:text-obsidian font-mono text-[8px] font-bold uppercase tracking-widest transition-all">
                        Load
                      </button>
                    </div>
                  ))
                )
              ) : filteredPresets.length === 0 ? (
                <div className="py-8 text-center text-white/30 font-mono text-[10px]">
                  <p>No matching presets found for "{searchQuery}".</p>
                  <button 
                    onClick={() => { setSearchQuery(''); setSelectedCategory('All'); }}
                    className="mt-2 text-primary underline text-[9px]"
                  >
                    View all presets
                  </button>
                </div>
              ) : (
                filteredPresets.map((preset) => {
                  const isCurrent = isPresetActive(settings, preset);
                  return (
                    <div
                      key={preset.id}
                      onClick={() => handleApplyPreset(preset)}
                      className={`group p-2.5 rounded-xl border transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-primary/10 border-primary/60 shadow-[0_0_15px_rgba(29,185,84,0.1)]'
                          : 'bg-black/35 border-white/5 hover:border-white/20 hover:bg-white/5'
                      }`}
                    >
                      {/* Top Row: Name, Category, Active Checkmark */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] font-bold text-white group-hover:text-primary transition-colors">
                            {preset.name}
                          </span>
                          <span className="font-mono text-[7.5px] px-1.5 py-0.2 rounded bg-white/5 border border-white/5 text-white/40">
                            {preset.genreTag}
                          </span>
                        </div>

                        {isCurrent ? (
                          <span className="flex items-center gap-1 font-mono text-[8px] font-bold text-primary uppercase tracking-widest bg-primary/20 px-2 py-0.5 rounded-full border border-primary/30">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity font-mono text-[8px] text-white/40 uppercase tracking-widest">
                            Apply ↵
                          </span>
                        )}
                      </div>

                      {/* Description */}
                      <p className="font-mono text-[8.5px] text-white/50 leading-relaxed mt-1">
                        {preset.description}
                      </p>

                      {/* Specs Row */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-2 pt-2 border-t border-white/5 font-mono text-[8px]">
                        <span className="px-1.5 py-0.5 rounded bg-black/40 text-white/60">
                          Low: <strong className="text-primary">{preset.highlightParams.lowGain}</strong>
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-black/40 text-white/60">
                          High: <strong className="text-amber">{preset.highlightParams.highGain}</strong>
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-black/40 text-white/60">
                          Glue: <strong className="text-white">{preset.highlightParams.glueCompression}</strong>
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-black/40 text-white/40 ml-auto italic">
                          {preset.highlightParams.char}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Dropdown Footer */}
            <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between font-mono text-[8px] text-white/30">
              <span>{EQ_COMP_PRESETS.length} Studio Configurations Available</span>
              <button
                onClick={handleResetToFlat}
                className="hover:text-primary transition-colors flex items-center gap-1 text-white/40"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>Reset to Flat</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
